# Vision analysis service for site photograph inspection.
# Uses the Ollama local server to run a visual analysis on uploaded photos.

import base64
import httpx
import logging
import io
from PIL import Image
import pillow_heif

pillow_heif.register_heif_opener()

logger = logging.getLogger(__name__)

# How long to wait for the vision analysis to complete (seconds)
_VISION_TIMEOUT = 180.0

async def analyze_image(file_path: str, engine: str, model_name: str, api_url: str) -> str:
    """
    Analyse a site photograph and return a written description of
    visible conditions, materials, damage, and areas needing attention.
    """
    logger.info(f"Analysing image from {file_path} using engine={engine}")

    if engine == "mock":
        return ("Visual inspection of the living room photo: A vertical hairline "
                "crack is visible on the drywall. Near the bottom-left window frame, "
                "paint is peeling and showing minor signs of dampness.")

    elif engine == "ollama":
        # Read the photo and encode it for the API. We convert it to JPEG to ensure compatibility.
        img = Image.open(file_path)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=85)
        image_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        prompt = (
            "You are a renovation site inspector. Describe this photo in detail. "
            "Note the condition of walls, floors, ceilings, fixtures, and fittings. "
            "Identify any visible damage such as cracks, stains, peeling paint, "
            "water damage, mould, or structural concerns. Mention the materials "
            "visible (tile, wood, plaster, etc.) and any areas that clearly need "
            "repair or replacement. Be specific and concise."
            "Include a suggestion pricing for the works done as well."
            "Do not exceed 80 words for each analysis."
        )

        payload = {
            "model": model_name,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=_VISION_TIMEOUT) as client:
            response = await client.post(f"{api_url}/api/generate", json=payload)
            response.raise_for_status()

        result = response.json()
        analysis = result.get("response", "").strip()
        logger.info(f"Image analysis complete: {len(analysis)} characters")
        return analysis

    else:
        raise ValueError(f"Unsupported vision engine: {engine}")
