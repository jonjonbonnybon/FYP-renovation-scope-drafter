import json
import asyncio
import logging
import time
from typing import List

from config import settings
from services.audio_service import transcribe_audio
from services.vision_service import analyze_image
from services.text_service import generate_scope

logger = logging.getLogger(__name__)

async def process_room_pipeline(aud_paths: List[str], img_paths: List[str]):
    """
    orchestrates the sequential processing of audio, vision, and text synthesis.
    yields sse-compatible json strings to report progress to the frontend.
    """
    start_time = time.time()
    
    def get_elapsed():
        return int(time.time() - start_time)
        
    try:
        # 1. handle audio transcription
        if not aud_paths:
            yield f"data: {{'status': 'progress', 'message': 'No audio files provided [{get_elapsed()}s]...'}}\n\n".replace("'", '"')
            raw_transcription = "No audio transcriptions provided."
            await asyncio.sleep(0.5)  # small buffer for frontend to catch up
        else:
            yield f"data: {json.dumps({'status': 'progress', 'message': f'Transcribing audio [{get_elapsed()}s]...'})}\n\n"
            
            transcriptions = []
            for path in aud_paths:
                t = await transcribe_audio(
                    file_path=path,
                    engine=settings.AUDIO_ENGINE,
                    model_name=settings.WHISPER_MODEL
                )
                transcriptions.append(t)
            
            raw_transcription = "\n\n".join([f"--- AUDIO RECORDING {i+1} ---\n{t}" for i, t in enumerate(transcriptions)])
            if not raw_transcription.strip():
                raw_transcription = "No audio transcriptions provided."
                
            yield f"data: {json.dumps({'status': 'progress', 'message': f'Audio transcription complete [{get_elapsed()}s].'})}\n\n"

        # 2. handle vision analysis
        if not img_paths:
            yield f"data: {json.dumps({'status': 'progress', 'message': f'No photos provided [{get_elapsed()}s]...'})}\n\n"
            raw_vision = "No visual analyses provided."
            await asyncio.sleep(0.5)
        else:
            yield f"data: {json.dumps({'status': 'progress', 'message': f'Analysing site photograph [{get_elapsed()}s]...'})}\n\n"
            
            visions = []
            for path in img_paths:
                v = await analyze_image(
                    file_path=path,
                    engine=settings.VISION_ENGINE,
                    model_name=settings.OLLAMA_VISION_MODEL,
                    api_url=settings.OLLAMA_API_URL,
                    transcription=raw_transcription
                )
                visions.append(v)
                
            raw_vision = "\n\n".join([f"--- PHOTO ANALYSIS {i+1} ---\n{v}" for i, v in enumerate(visions)])
            if not raw_vision.strip():
                raw_vision = "No visual analyses provided."
                
            yield f"data: {json.dumps({'status': 'progress', 'message': f'Vision analysis complete [{get_elapsed()}s].'})}\n\n"

        # 3. synthesise scope
        yield f"data: {json.dumps({'status': 'progress', 'message': f'Structuring scope items [{get_elapsed()}s]...'})}\n\n"
        
        scope_items = await generate_scope(
            transcription=raw_transcription,
            vision_analysis=raw_vision,
            engine=settings.TEXT_ENGINE,
            model_name=settings.OLLAMA_TEXT_MODEL,
            api_url=settings.OLLAMA_API_URL
        )
        
        # 4. send final result
        final_payload = {
            "status": "success",
            "raw_transcription": raw_transcription,
            "raw_vision": raw_vision,
            "scope_of_work": scope_items
        }
        yield f"data: {json.dumps(final_payload)}\n\n"
        
    except Exception as e:
        logger.error(f"pipeline failed: {e}", exc_info=True)
        # return a graceful error state to the frontend
        error_payload = {
            "status": "error",
            "message": str(e)
        }
        yield f"data: {json.dumps(error_payload)}\n\n"
