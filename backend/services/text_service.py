# Text synthesis service for generating structured renovation scope items.
# Takes transcription + visual analysis and produces categorised work items.

import json
import httpx
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# How long to wait for text generation to complete (seconds)
_TEXT_TIMEOUT = 180.0

def _build_scope_prompt(transcription: str, vision_analysis: str) -> str:
    """Construct the prompt that asks for structured scope-of-work items."""
    return f"""You are a professional renovation contractor drafting a scope of work.

    Below are spoken descriptions from a site visit and written analyses of site photographs.
    Using ALL sources provided, produce a JSON array of work items. Each item must have these fields:
    - "category": the trade category (e.g. Masonry, Painting, Electrical, Plumbing, Carpentry, Flooring, Waterproofing, Demolition, Tiling, General)
    - "description": a clear one-line description of the work to be done
    - "quantity": an estimated numeric quantity
    - "unit": the unit of measurement (e.g. sqm, sqft, lot, nos, metres)
    - "unit_cost": an estimated cost per unit in dollars (integer)
    - "total_cost": the total cost in dollars (quantity * unit_cost) (integer)

    Return ONLY the JSON array, no other text.

    --- SPOKEN DESCRIPTIONS ---
    {transcription}

    --- SITE PHOTO ANALYSES ---
    {vision_analysis}
"""


def _parse_scope_items(raw_text: str) -> List[Dict[str, Any]]:
    """Parse the generated text into a list of scope items with validation."""
    # Clean up common formatting issues
    cleaned = raw_text.strip()

    # Try to find JSON array in the response
    start = cleaned.find("[")
    end = cleaned.rfind("]") + 1
    if start == -1 or end == 0:
        logger.warning("Could not find JSON array in response, using fallback")
        return _fallback_scope()

    try:
        items = json.loads(cleaned[start:end])
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON: {e}, using fallback")
        return _fallback_scope() 

    # Validate and sanitise each item
    required_keys = {"category", "description", "quantity", "unit", "unit_cost", "total_cost"}
    def _safe_float(val, default=0.0):
        if val is None:
            return float(default)
        try:
            return float(val)
        except (ValueError, TypeError):
            return float(default)

    validated = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if not required_keys.issubset(item.keys()):
            # Fallback for older formats or missing keys: compute if one is missing
            cost_val = item.get("cost") or item.get("total_cost") or 0
            item["unit_cost"] = item.get("unit_cost") or cost_val
            item["total_cost"] = item.get("total_cost") or cost_val
            item["category"] = item.get("category") or "General"
            item["description"] = item.get("description") or "Unknown"
            item["quantity"] = item.get("quantity") or 1
            item["unit"] = item.get("unit") or "lot"
            
        validated.append({
            "category": str(item.get("category") or "General"),
            "description": str(item.get("description") or "Unknown"),
            "quantity": _safe_float(item.get("quantity"), 1.0),
            "unit": str(item.get("unit") or "lot"),
            "unit_cost": _safe_float(item.get("unit_cost"), 0.0),
            "total_cost": _safe_float(item.get("total_cost"), 0.0),
        })

    if not validated:
        logger.warning("No valid scope items parsed, using fallback")
        return _fallback_scope()

    return validated


def _fallback_scope() -> List[Dict[str, Any]]:
    """Return a sensible default when parsing fails so the user can still edit."""
    return [{
        "category": "General",
        "description": "Scope could not be auto-generated — please fill in manually",
        "quantity": 1,
        "unit": "lot",
        "unit_cost": 0,
        "total_cost": 0,
    }]


async def generate_scope(
    transcription: str,
    vision_analysis: str,
    engine: str,
    model_name: str,
    api_url: str
) -> List[Dict[str, Any]]:
    """
    Combine the spoken description and photo analysis into
    a structured list of renovation work items.
    """
    logger.info(f"Generating scope using engine={engine}")

    if engine == "mock":
        return [
            {
                "category": "Masonry",
                "description": "Plaster hairline cracks on living room wall",
                "quantity": 1,
                "unit": "lot",
                "unit_cost": 150,
                "total_cost": 150,
            },
            {
                "category": "Painting",
                "description": "Scrape off peeling paint and repaint living room wall (matching colour)",
                "quantity": 12,
                "unit": "sqm",
                "unit_cost": 20,
                "total_cost": 240,
            },
            {
                "category": "Waterproofing",
                "description": "Apply damp-proof treatment around living room window frame",
                "quantity": 1,
                "unit": "lot",
                "unit_cost": 300,
                "total_cost": 300,
            }
        ]

    elif engine == "ollama":
        prompt = _build_scope_prompt(transcription, vision_analysis)

        # map human-readable name to the actual ollama tag downloaded by the user
        ollama_tag = "llama3:latest" if "llama3" in model_name.lower() else model_name

        payload = {
            "model": ollama_tag,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "keep_alive": 0,
        }

        async with httpx.AsyncClient(timeout=_TEXT_TIMEOUT) as client:
            response = await client.post(f"{api_url}/api/generate", json=payload)
            response.raise_for_status()

        result = response.json()
        raw_text = result.get("response", "")
        logger.info(f"Raw scope text received: {len(raw_text)} characters")

        return _parse_scope_items(raw_text)

    else:
        raise ValueError(f"Unsupported text engine: {engine}")
