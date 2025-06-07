from fastapi import FastAPI, Request, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # ✅ 추가
from tts_generator import generate_tts
import os

app = FastAPI()

# ✅ CORS 허용 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 중이므로 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ static 폴더 연결
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/synthesize")
async def synthesize(text: str = Form(...)):
    print(f"🌀 TTS 요청 수신: {text}")
    filename = "temp_test.mp3"
    
    generate_tts(text, filename)
    
    filepath = f"static/audio/{filename}"
    if not os.path.exists(filepath):
        return {"error": "TTS 생성 실패"}

    return FileResponse(filepath, media_type="audio/mpeg")