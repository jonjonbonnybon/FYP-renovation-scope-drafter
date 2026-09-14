import whisper
import asyncio
import logging
import torch
import gc

logger = logging.getLogger(__name__)

def _run_transcription(file_path: str, model_name: str) -> str:
    """Run transcription synchronously and clear memory afterwards to free VRAM."""
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    logger.info(f"Loading transcription engine (size: {model_name}) on {device}...")
    
    # Handle distil-whisper models via transformers
    if model_name.startswith("distil-whisper"):
        try:
            from transformers import pipeline
        except ImportError:
            raise ImportError("Please install transformers and accelerate to use distil-whisper models: pip install transformers accelerate")
            
        repo_name = "distil-whisper/" + model_name.replace("distil-whisper-", "distil-")
        pipe = pipeline(
            "automatic-speech-recognition",
            model=repo_name,
            device=device,
            torch_dtype=torch.float16 if device == "mps" else torch.float32,
            chunk_length_s=25,
            batch_size=8,
            ignore_warning=True
        )
        result = pipe(file_path, return_timestamps=True)
        text = result["text"].strip()
        del pipe
        
    else:
        # load model fresh for each run to control memory lifecycle
        engine = whisper.load_model(model_name, device=device)
        # transcribe
        result = engine.transcribe(file_path, language="en")
        text = result["text"].strip()
        del engine

    gc.collect()
    if device == "mps":
        torch.mps.empty_cache()
    elif device == "cuda":
        torch.cuda.empty_cache()
        
    return text

async def transcribe_audio(file_path: str, engine: str, model_name: str) -> str:
    """
    Transcribe spoken audio from the given file path.
    Supports mock data for testing or real speech-to-text processing.
    """
    logger.info(f"Transcribing audio from {file_path} using engine={engine}")

    if engine == "mock":
        return ("The living room wall has several hairline cracks and the paint "
                "is peeling near the window. We need to plaster the cracks and "
                "repaint the wall.")

    elif engine == "whisper":
        try:
            # push to thread to avoid blocking the main event loop
            transcription = await asyncio.to_thread(_run_transcription, file_path, model_name)
            logger.info(f"Transcription complete: {len(transcription)} characters")
            return transcription
        except Exception as e:
            # gracefully degrade on audio failure so vision data can still be used
            logger.error(f"Audio transcription failed: {str(e)}")
            return "Audio transcription failed or was unreadable."
    else:
        raise ValueError(f"Unsupported audio engine: {engine}")
