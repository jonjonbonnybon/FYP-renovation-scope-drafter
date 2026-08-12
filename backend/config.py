# Configuration settings for the processing pipeline.
# References:
# - FastAPI Configuration: https://fastapi.tiangolo.com/
# - Ollama Local API Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

import os

class Settings:
    # Set engines to "mock" for testing logic, or their respective implementation
    AUDIO_ENGINE: str = os.getenv("AUDIO_ENGINE", "whisper")  # Options: "mock", "whisper"
    VISION_ENGINE: str = os.getenv("VISION_ENGINE", "ollama") # Options: "mock", "ollama"
    TEXT_ENGINE: str = os.getenv("TEXT_ENGINE", "ollama")   # Options: "mock", "ollama"
    
    # Model parameters
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "medium")
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "llava")
    OLLAMA_TEXT_MODEL: str = os.getenv("OLLAMA_TEXT_MODEL", "llama3")
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://localhost:11434")

settings = Settings()
