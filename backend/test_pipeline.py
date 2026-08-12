"""
Integration test for the renovation scope pipeline.

Usage:
    Ensure the backend server is running on port 8000, then:
    python test_pipeline.py

Note:
    For a meaningful test, place a real site photo at ./test_photo.jpg
    and a real voice recording at ./test_audio.wav in the backend directory.
    Without real files, the test sends placeholder data which may not
    produce useful results from the processing engines.
"""
import asyncio
import os
import io
from main import transcribe_audio_endpoint, analyze_vision_endpoint, synthesize_scope_endpoint, SynthesizeRequest


async def test_endpoint():
    print("--- STARTING PIPELINE TEST ---")

    # Use real files if available, otherwise fall back to placeholder bytes
    if os.path.exists("test_photo.jpg"):
        with open("test_photo.jpg", "rb") as f:
            img_bytes = f.read()
        print("Using real test photo: test_photo.jpg")
    else:
        img_bytes = b"placeholder image data"
        print("Warning: No test_photo.jpg found, using placeholder data")

    if os.path.exists("test_audio.wav"):
        with open("test_audio.wav", "rb") as f:
            aud_bytes = f.read()
        print("Using real test audio: test_audio.wav")
    else:
        aud_bytes = b"placeholder audio data"
        print("Warning: No test_audio.wav found, using placeholder data")

    image_file = UploadFile(
        file=io.BytesIO(img_bytes),
        filename="test_room_photo.jpg"
    )
    audio_file = UploadFile(
        file=io.BytesIO(aud_bytes),
        filename="test_voice_memo.wav"
    )

    print("Invoking transcribe_audio_endpoint...")
    audio_res = await transcribe_audio_endpoint(audios=[audio_file])
    
    print("Invoking analyze_vision_endpoint...")
    vision_res = await analyze_vision_endpoint(images=[image_file])

    print("Invoking synthesize_scope_endpoint...")
    req = SynthesizeRequest(
        raw_transcription=audio_res["raw_transcription"],
        raw_vision=vision_res["raw_vision"]
    )
    scope_res = await synthesize_scope_endpoint(req)

    print("\n--- PIPELINE OUTPUT ---")
    print(f"Transcription: {audio_res.get('raw_transcription')}")
    print(f"Vision Analysis: {vision_res.get('raw_vision')}")
    print("Scope Items:")
    scope_items = scope_res.get("scope_of_work", [])
    for idx, item in enumerate(scope_items, 1):
        print(f"  {idx}. [{item.get('category')}] {item.get('description')} "
              f"| Qty: {item.get('quantity')} {item.get('unit')} | Unit Cost: ${item.get('unit_cost')} | Total Cost: ${item.get('total_cost')}")

    assert "raw_transcription" in audio_res
    assert "raw_vision" in vision_res
    assert len(scope_items) > 0

    print("\nAll checks passed.")
    print("--- PIPELINE TEST COMPLETE ---")


if __name__ == "__main__":
    asyncio.run(test_endpoint())
