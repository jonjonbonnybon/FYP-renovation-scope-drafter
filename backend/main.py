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

from config import settings
from services.audio_service import transcribe_audio
from services.vision_service import analyze_image
from services.text_service import generate_scope

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

@app.post("/api/transcribe-audio")
async def transcribe_audio_endpoint(audios: List[UploadFile] = File(default=[])):
    logger.info(f"Received request at /api/transcribe-audio with {len(audios)} files")
    aud_paths = []
    
    for audio in audios:
        if audio.size == 0 or audio.filename == "rec.wav" and audio.size < 100:
            continue
        aud_suffix = pathlib.Path(audio.filename).suffix if audio.filename else ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=aud_suffix) as aud_temp:
            shutil.copyfileobj(audio.file, aud_temp)
            aud_paths.append(aud_temp.name)

    try:
        logger.info(f"Running audio transcription sequentially via {settings.AUDIO_ENGINE}...")
        transcriptions = []
        for aud_path in aud_paths:
            t = await transcribe_audio(
                file_path=aud_path,
                engine=settings.AUDIO_ENGINE,
                model_name=settings.WHISPER_MODEL
            )
            transcriptions.append(t)
        
        raw_transcription = "\n\n".join([f"--- AUDIO RECORDING {i+1} ---\n{t}" for i, t in enumerate(transcriptions)])
        if not raw_transcription:
            raw_transcription = "No audio transcriptions provided."
            
        return {"raw_transcription": raw_transcription}

    except Exception as e:
        logger.error(f"Error in transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in aud_paths:
            if os.path.exists(p):
                os.remove(p)

@app.post("/api/analyze-vision")
async def analyze_vision_endpoint(images: List[UploadFile] = File(default=[])):
    logger.info(f"Received request at /api/analyze-vision with {len(images)} files")
    img_paths = []
    
    for image in images:
        if image.size == 0 or image.filename == "photo.png" and image.size < 100:
            continue
        img_suffix = pathlib.Path(image.filename).suffix if image.filename else ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=img_suffix) as img_temp:
            shutil.copyfileobj(image.file, img_temp)
            img_paths.append(img_temp.name)

    try:
        logger.info(f"Running visual analysis sequentially via {settings.VISION_ENGINE}...")
        visions = []
        for img_path in img_paths:
            v = await analyze_image(
                file_path=img_path,
                engine=settings.VISION_ENGINE,
                model_name=settings.OLLAMA_VISION_MODEL,
                api_url=settings.OLLAMA_API_URL
            )
            visions.append(v)
            
        raw_vision = "\n\n".join([f"--- PHOTO ANALYSIS {i+1} ---\n{v}" for i, v in enumerate(visions)])
        if not raw_vision:
            raw_vision = "No visual analyses provided."
            
        return {"raw_vision": raw_vision}

    except Exception as e:
        logger.error(f"Error in vision analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in img_paths:
            if os.path.exists(p):
                os.remove(p)

class SynthesizeRequest(BaseModel):
    raw_transcription: str
    raw_vision: str

@app.post("/api/synthesize-scope")
async def synthesize_scope_endpoint(req: SynthesizeRequest):
    logger.info("Received request at /api/synthesize-scope")
    try:
        scope_items = await generate_scope(
            transcription=req.raw_transcription,
            vision_analysis=req.raw_vision,
            engine=settings.TEXT_ENGINE,
            model_name=settings.OLLAMA_TEXT_MODEL,
            api_url=settings.OLLAMA_API_URL
        )
        return {"scope_of_work": scope_items}
    except Exception as e:
        logger.error(f"Error in text synthesis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Text generation failed")


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

