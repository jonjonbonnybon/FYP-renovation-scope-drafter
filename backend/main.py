import os
import shutil
import tempfile
import pathlib
import logging
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

@app.post("/api/generate-scope")
async def generate_scope_endpoint(image: UploadFile, audio: UploadFile):
    """
    Accept an image and audio file, run them sequentially through the configured
    AI engines (mock or real models), and return the renovation scope-of-work.
    """
    logger.info("Received request at /api/generate-scope")
    logger.info(f"Image file: {image.filename}, Audio file: {audio.filename}")

    # Create temporary files to hold the uploads models can read them
    img_suffix = pathlib.Path(image.filename).suffix if image.filename else ".jpg"
    aud_suffix = pathlib.Path(audio.filename).suffix if audio.filename else ".wav"

    # NamedTemporaryFile requires delete=False so can open and read it multiple times
    with tempfile.NamedTemporaryFile(delete=False, suffix=img_suffix) as img_temp:
        shutil.copyfileobj(image.file, img_temp)
        img_path = img_temp.name

    with tempfile.NamedTemporaryFile(delete=False, suffix=aud_suffix) as aud_temp:
        shutil.copyfileobj(audio.file, aud_temp)
        aud_path = aud_temp.name

    try:
        # Step 1: Speech-to-Text Transcription
        logger.info(f"Step 1: Running audio transcription via {settings.AUDIO_ENGINE}...")
        raw_transcription = await transcribe_audio(
            file_path=aud_path,
            engine=settings.AUDIO_ENGINE,
            model_name=settings.WHISPER_MODEL
        )

        # Step 2: Visual Analysis
        logger.info(f"Step 2: Running visual analysis via {settings.VISION_ENGINE}...")
        raw_vision = await analyze_image(
            file_path=img_path,
            engine=settings.VISION_ENGINE,
            model_name=settings.OLLAMA_VISION_MODEL,
            api_url=settings.OLLAMA_API_URL
        )

        # Step 3: Structured Scope Generation
        logger.info(f"Step 3: Running text synthesis via {settings.TEXT_ENGINE}...")
        scope_items = await generate_scope(
            transcription=raw_transcription,
            vision_analysis=raw_vision,
            engine=settings.TEXT_ENGINE,
            model_name=settings.OLLAMA_TEXT_MODEL,
            api_url=settings.OLLAMA_API_URL
        )

        logger.info("Pipeline processing completed successfully.")
        return {
            "status": "success",
            "raw_transcription": raw_transcription,
            "raw_vision": raw_vision,
            "scope_of_work": scope_items
        }

    except NotImplementedError as nie:
        logger.error(f"Unimplemented engine path: {nie}")
        raise HTTPException(
            status_code=501, 
            detail=f"This engine configuration is not yet implemented: {str(nie)}"
        )
    except Exception as e:
        logger.error(f"Error processing files in pipeline: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the renovation files: {str(e)}"
        )

    finally:
        # Ensure temporary files are cleaned up from disk regardless of success or failure
        try:
            if os.path.exists(img_path):
                os.remove(img_path)
                logger.info(f"Cleaned up temporary image: {img_path}")
        except Exception as e:
            logger.error(f"Failed to delete temp image file {img_path}: {e}")

        try:
            if os.path.exists(aud_path):
                os.remove(aud_path)
                logger.info(f"Cleaned up temporary audio: {aud_path}")
        except Exception as e:
            logger.error(f"Failed to delete temp audio file {aud_path}: {e}")
