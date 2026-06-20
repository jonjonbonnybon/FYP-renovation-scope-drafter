import asyncio
import io
import os
from fastapi import UploadFile
from main import generate_scope_endpoint

async def test_endpoint():
    print("--- STARTING PIPELINE TEST ---")
    
    # Create fake upload files in memory
    image_file = UploadFile(
        file=io.BytesIO(b"fake image data representing a room photo"),
        filename="test_room_photo.jpg"
    )
    audio_file = UploadFile(
        file=io.BytesIO(b"fake audio data representing a voice note"),
        filename="test_voice_memo.wav"
    )
    
    print("Invoking generate_scope_endpoint...")
    result = await generate_scope_endpoint(image=image_file, audio=audio_file)
    
    print("\n--- PIPELINE OUTPUT ---")
    print(f"Status: {result.get('status')}")
    print(f"Raw Transcription: {result.get('raw_transcription')}")
    print(f"Raw Vision Description: {result.get('raw_vision')}")
    print("Scope of Work Items:")
    for idx, item in enumerate(result.get("scope_of_work", []), 1):
        print(f"  {idx}. [{item.get('category')}] {item.get('description')} "
              f"| Qty: {item.get('quantity')} {item.get('unit')} | Cost: ${item.get('cost')}")
    
    # Assertions to ensure code functions as expected
    assert result["status"] == "success"
    assert "raw_transcription" in result
    assert "raw_vision" in result
    assert len(result["scope_of_work"]) == 3
    
    print("\nVerification: Assertions passed!")
    print("--- PIPELINE TEST PASSED ---")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
