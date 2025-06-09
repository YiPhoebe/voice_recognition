from fastapi import FastAPI, Request, File, UploadFile
from utils import stt  # stt.py 모듈 import
from fastapi.responses import JSONResponse
import requests
from io import BytesIO
import asyncio

from fastapi.responses import Response
import os
from dotenv import load_dotenv

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
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

# Add send_email router import
from routers import send_email

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    try:
        result = stt.transcribe_audio(audio_bytes)
        return JSONResponse(content={
            "text": result["text"],
            "segments": result["segments"],
            "language": result["language"],
            "no_speech_prob": result["no_speech_prob"]
        })
    except Exception as e:
        print(f"❌ STT 처리 중 오류: {e}")
        return JSONResponse(
            content={"status": "error", "message": str(e)},
            status_code=500
        )

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

# Jinja2 template engine
templates = Jinja2Templates(directory="tem")

# Include the send_email router
app.include_router(send_email.router)

from fastapi import WebSocket
import json

@app.websocket("/ws/adhd-short")
async def adhd_short_ws(websocket: WebSocket):
    print("🌀 WebSocket 접속 시도됨")
    await websocket.accept()
    print("✅ WebSocket 연결 완료")

    with open("static/questions_list.json", "r", encoding="utf-8") as f:
        questions = json.load(f)
    await websocket.send_json({"type": "init", "questions": questions})
    await websocket.send_json({
        "type": "question",
        "text": questions[0]["text"].replace("{name}", "사용자"),
        "index": 0
    })
    print("📤 질문 전송됨")

    websocket.state.current_index = 0

    while True:
        try:
            print("🧭 메시지 수신 대기 중...")
            data = await websocket.receive_json()
            print("📩 받은 데이터:", data)
            await asyncio.sleep(0.5)
            if data.get("type") == "response":
                text = data.get("text", "")
                client_index = data.get("currentIndex", 0)
                print("📥 응답 수신:", text, "| 클라이언트 currentIndex:", client_index)
                print("🔁 응답 타입: response → 질문 인덱스 증가 예정 (currentIndex + 1)")

                next_index = client_index + 1

                if next_index < len(questions):
                    await websocket.send_json({
                        "type": "question",
                        "text": questions[next_index]["text"].replace("{name}", "사용자"),
                        "index": next_index
                    })
                    print(f"📤 다음 질문 전송: {questions[next_index]['text']}")
                else:
                    await asyncio.sleep(1)
                    await websocket.send_json({
                        "type": "end",
                        "message": "모든 질문이 완료되었습니다."
                    })
                    print("🏁 모든 질문 완료")
            elif data.get("type") == "skip":
                client_index = data.get("currentIndex", 0)
                next_index = client_index + 1
                print(f"⏭️ [SKIP] 다음 질문을 건너뜀 → 현재 index: {next_index}")
                print("🔁 응답 타입: skip → 질문 인덱스 증가됨 (currentIndex + 1)")

                if next_index < len(questions):
                    await websocket.send_json({
                        "type": "question",
                        "text": questions[next_index]["text"].replace("{name}", "사용자"),
                        "index": next_index
                    })
                    print(f"📤 다음 질문 전송: {questions[next_index]['text']}")
                else:
                    await asyncio.sleep(1)
                    await websocket.send_json({
                        "type": "end",
                        "message": "모든 질문이 완료되었습니다."
                    })
                    print("🏁 모든 질문 완료")
        except Exception as e:
            print("❌ WebSocket error:", e)
            break


# Serve the result page using Jinja2 template
@app.get("/result", response_class=HTMLResponse)
async def show_result_page(request: Request):
    return templates.TemplateResponse("result.html", {"request": request})

load_dotenv()

@app.get("/config.js")
def get_config_js():
    ws_host = os.getenv("WS_HOST", "localhost:5981")
    tts_host = os.getenv("TTS_HOST", "http://localhost:10081")
    tts_endpoint = os.getenv("TTS_ENDPOINT", f"{tts_host}/synthesize")
    stt_path = os.getenv("STT_WEBSOCKET_PATH", "/ws/general")
    stt_short_path = os.getenv("STT_SHORT_WEBSOCKET_PATH", "/ws/general")

    js_content = f"""const CONFIG = {{
  WS_HOST: "{ws_host}",
  TTS_HOST: "{tts_host}",
  TTS_ENDPOINT: "{tts_endpoint}",
  STT_WEBSOCKET_PATH: "{stt_path}",
  STT_SHORT_WEBSOCKET_PATH: "{stt_short_path}"
}};"""

    return Response(content=js_content, media_type="application/javascript")
