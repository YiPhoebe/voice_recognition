from fastapi import FastAPI, Form
from fastapi.responses import StreamingResponse
from io import BytesIO
from tts_generator import generate_tts_bytes  # gTTS 기반 함수

app = FastAPI()

@app.post("/synthesize")
async def synthesize(text: str = Form(...)):
    audio_bytes = generate_tts_bytes(text)
    audio_stream = BytesIO(audio_bytes)
    audio_stream.seek(0)
    return StreamingResponse(audio_stream, media_type="audio/mpeg")
