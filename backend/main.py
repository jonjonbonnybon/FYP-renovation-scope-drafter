# FastAPI Endpoint Router for multipart uploads and temp file handling.
# References:
# - FastAPI Request Files: https://fastapi.tiangolo.com/tutorial/request-files/
# - FastAPI CORS Middleware: https://fastapi.tiangolo.com/tutorial/cors/

import os
import shutil
import tempfile
import pathlib
import logging
import datetime
from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()

import warnings

# Suppress harmless resource_tracker warnings from PyTorch MPS background threads
warnings.filterwarnings('ignore', category=UserWarning, module='multiprocessing.resource_tracker')

from config import settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Renovation Scope Drafter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/process-room")
async def process_room_endpoint(
    audios: List[UploadFile] = File(default=[]),
    images: List[UploadFile] = File(default=[])
):
    logger.info(f"received request at /api/process-room with {len(audios)} audio(s) and {len(images)} image(s)")
    aud_paths = []
    img_paths = []
    
    # quick check to skip dummy files or empty uploads
    def is_valid_file(f, dummy_name):
        return f.size > 0 and not (f.filename == dummy_name and f.size < 100)

    # stash audios to temp files
    for audio in audios:
        if not is_valid_file(audio, "rec.wav"):
            continue
        aud_suffix = pathlib.Path(audio.filename).suffix if audio.filename else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=aud_suffix) as aud_temp:
            shutil.copyfileobj(audio.file, aud_temp)
            aud_paths.append(aud_temp.name)

    # stash images to temp files
    for image in images:
        if not is_valid_file(image, "photo.png"):
            continue
        img_suffix = pathlib.Path(image.filename).suffix if image.filename else ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=img_suffix) as img_temp:
            shutil.copyfileobj(image.file, img_temp)
            img_paths.append(img_temp.name)

    # wrap the pipeline in a generator to clean up temp files once the stream is done
    async def event_generator():
        try:
            from services.process_service import process_room_pipeline
            async for event in process_room_pipeline(aud_paths, img_paths):
                yield event
        finally:
            # always clean up temp files
            for p in aud_paths + img_paths:
                if os.path.exists(p):
                    os.remove(p)
                    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/convert-heic")
async def convert_heic_endpoint(file: UploadFile = File(...)):
    """Convert HEIC to JPEG for frontend previews to bypass browser limitations"""
    try:
        content = await file.read()
        img = Image.open(BytesIO(content))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out = BytesIO()
        img.save(out, format="JPEG", quality=85)
        out.seek(0)
        return StreamingResponse(out, media_type="image/jpeg")
    except Exception as e:
        logger.error(f"Error converting HEIC: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Conversion failed")

class ScopeItem(BaseModel):
    category: str
    description: str
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float

class RoomData(BaseModel):
    room: str
    raw_transcription: Optional[str] = ""
    raw_vision: Optional[str] = ""
    scope_of_work: List[ScopeItem]

class PdfRequest(BaseModel):
    rooms: List[RoomData]
    grand_total: float

@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(request: PdfRequest):
    """
    Generate a professional A4 PDF for the renovation scope of work.
    """
    logger.info("Received request at /api/generate-pdf")
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    elements = []
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    room_style = styles['Heading2']
    normal_style = styles['Normal']
    
    elements.append(Paragraph("Renovation Scope of Work", title_style))
    elements.append(Paragraph(f"Date: {datetime.datetime.now().strftime('%Y-%m-%d')}", normal_style))
    elements.append(Spacer(1, 10*mm))
    
    for room in request.rooms:
        elements.append(Paragraph(f"Room: {room.room}", room_style))
        elements.append(Spacer(1, 5*mm))
        
        data = [["Category", "Description", "Qty", "Unit", "Unit Cost", "Total Cost"]]
        for item in room.scope_of_work:
            data.append([
                item.category,
                Paragraph(item.description, normal_style),
                str(item.quantity),
                item.unit,
                f"S${item.unit_cost}",
                f"S${item.total_cost}"
            ])
            
        t = Table(data, colWidths=[25*mm, 75*mm, 15*mm, 15*mm, 20*mm, 20*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 10*mm))
        
    elements.append(Paragraph(f"Grand Total: S${request.grand_total}", title_style))
    elements.append(Spacer(1, 10*mm))
    
    elements.append(Paragraph("Disclaimer: These are estimated costs and quantities subject to site verification.", normal_style))
    
    doc.build(elements)
    
    buffer.seek(0)
    return StreamingResponse(
        buffer, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=renovation_scope.pdf"}
    )

