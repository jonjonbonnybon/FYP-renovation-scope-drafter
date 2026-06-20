import logging

logger = logging.getLogger(__name__)

async def transcribe_audio(file_path: str, engine: str, model_name: str) -> str:
    """
    Transcribes audio from the given file_path using the specified engine.
    """
    logger.info(f"Transcribing audio from {file_path} using engine={engine}, model={model_name}")
    
    if engine == "mock":
        return "The living room wall has several hairline cracks and the paint is peeling near the window. We need to plaster the cracks and repaint the wall."
        
    elif engine == "whisper":
        # This is where the real Whisper execution will go.
        raise NotImplementedError(
            f"Whisper engine is not implemented yet. Set AUDIO_ENGINE='mock' in config.py to evaluate."
        )
        
    else:
        raise ValueError(f"Unsupported audio engine: {engine}")
