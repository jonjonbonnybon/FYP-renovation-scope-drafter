import whisper
import asyncio
import logging
import torch

logger = logging.getLogger(__name__)

# Lazy-loaded transcription engine, kept in memory after first use
_whisper_engine = None

def _get_whisper_engine(model_name: str):
    """Load the transcription engine once and cache it for reuse."""
    global _whisper_engine
    if _whisper_engine is None:
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        logger.info(f"Loading transcription engine (size: {model_name}) on {device}, this may take a moment...")
        _whisper_engine = whisper.load_model(model_name, device=device)
    return _whisper_engine

def _run_transcription(file_path: str, model_name: str) -> str:
    """Runs the transcription synchronously — called from a background thread."""
    engine = _get_whisper_engine(model_name)
    result = engine.transcribe(file_path)
    return result["text"].strip()

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
        # Run in a separate thread to keep the event loop responsive
        transcription = await asyncio.to_thread(_run_transcription, file_path, model_name)
        logger.info(f"Transcription complete: {len(transcription)} characters")
        return transcription

    else:
        raise ValueError(f"Unsupported audio engine: {engine}")
