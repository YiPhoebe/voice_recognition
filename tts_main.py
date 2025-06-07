from fastapi import FastAPI, Form
from fastapi.responses import FileResponse
import os
import uuid

from tts_generator import generate_tts  # 기존 TTS 함수 import

app = FastAPI()

@app.post("/synthesize")
async def synthesize(text: str = Form(...)):
    filename = f"/tmp/{uuid.uuid4().hex}.mp3"
    generate_tts(text, filename)
    return FileResponse(filename, media_type="audio/mpeg", filename="speech.mp3")

def generate_tts_bytes(text):
    from gtts import gTTS
    from io import BytesIO

    buffer = BytesIO()
    tts = gTTS(text, lang='ko')
    tts.write_to_fp(buffer)
    return buffer.getvalue()
