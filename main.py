from fastapi import FastAPI, Request, File, UploadFile
from utils import stt  # stt.py 모듈 import
from fastapi.responses import JSONResponse
import requests
from io import BytesIO


app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import PlainTextResponse

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    result = stt.transcribe_audio(audio_bytes)
    return JSONResponse(content={"text": result})

from fastapi.responses import StreamingResponse

@app.get("/synthesize")
def synthesize_get():
    return JSONResponse(content={"status": "ok", "message": "GET 요청 정상"})

@app.post("/synthesize")
async def synthesize(request: Request):
    data = await request.form()
    text = data.get("text", "")
    try:
        tts_response = requests.post("http://192.168.3.19:10081/synthesize", data={"text": text})
        if tts_response.status_code != 200:
            raise Exception("TTS 서버 응답 오류")

        return StreamingResponse(
            BytesIO(tts_response.content),
            media_type="audio/mpeg"
        )
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

from fastapi.responses import FileResponse

@app.get("/")
def root():
    return FileResponse("tem/index.html")

@app.get("/intro")
def intro():
    return FileResponse("tem/intro.html")

@app.get("/mic_test")
def mic_test():
    return FileResponse("tem/mic_test.html")

@app.get("/diagnosis")
def diagnosis():
    return FileResponse("tem/diagnosis.html")

from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static"), name="static")

from fastapi import WebSocket
import json

@app.websocket("/ws/adhd-short")
async def adhd_short_ws(websocket: WebSocket):
    await websocket.accept()
    with open("static/questions_list.json", "r", encoding="utf-8") as f:
        questions = json.load(f)
    await websocket.send_json({"type": "init", "questions": questions})
    await websocket.send_json({"type": "question", "text": questions[0]["text"]})
