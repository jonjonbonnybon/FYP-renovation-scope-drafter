import os

class Settings:
    # Set engines to "mock" to evaluate frontend logic,
    # swapping models later after evaluation has been completed
    AUDIO_ENGINE: str = os.getenv("AUDIO_ENGINE", "mock")  # Options: "mock", "whisper"
    VISION_ENGINE: str = os.getenv("VISION_ENGINE", "mock") # Options: "mock", "ollama"
    TEXT_ENGINE: str = os.getenv("TEXT_ENGINE", "mock")   # Options: "mock", "ollama"
    
    # Model parameters for evaluation
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "base")             # "tiny", "base", "small"
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "moondream")  # "moondream2", "llava 1.5", "llama3.2-vision"
    OLLAMA_TEXT_MODEL: str = os.getenv("OLLAMA_TEXT_MODEL", "llama3.2")     # "llama3", "mistral v0.2"
    OLLAMA_API_URL: str = os.getenv("OLLAMA_API_URL", "http://localhost:11434")

settings = Settings()
