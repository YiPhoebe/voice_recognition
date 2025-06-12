import os
from dotenv import load_dotenv

load_dotenv()
print("📢 .env 파일 로드됨:", os.getenv("ENV"))
ENV = os.getenv("ENV", "academy")
if ENV == "aws":
    from utils import stt  # 집에서만 Whisper 쓸 때 import
from fastapi import FastAPI, Request, File, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import requests
from io import BytesIO
import asyncio

from fastapi.responses import Response

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

# Add send_email and save_result router imports
from routers import send_email
from routers import save_result
from routers import user

if ENV == "aws":
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
        env = os.getenv("ENV", "academy")
        if env == "aws":
            # 내부 환경: 직접 gTTS 처리
            from utils.gtts import synthesize_text
            output_path = synthesize_text(text)
            return FileResponse(output_path, media_type="audio/mpeg")
        elif env == "academy":
            # 학원 환경: 외부 TTS 서버에 요청
            tts_host = os.getenv("ACADEMY_TTS_ENDPOINT")
            if not tts_host:
                raise RuntimeError("❌ TTS Endpoint 환경변수가 설정되어 있지 않습니다.")
            tts_response = requests.post(f"{tts_host}/synthesize", data={"text": text})
            if tts_response.status_code != 200:
                raise Exception("TTS 서버 응답 오류")
            return StreamingResponse(BytesIO(tts_response.content), media_type="audio/mpeg")
        else:
            raise RuntimeError("❌ ENV 값이 잘못 설정됨")
    except Exception as e:
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

from fastapi.responses import FileResponse

#
# 정적 파일과 템플릿 설정
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="tem")

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/intro")
def intro():
    return FileResponse("tem/intro.html")

@app.get("/mic_test")
def mic_test():
    return FileResponse("tem/mic_test.html")

@app.get("/diagnosis")
def diagnosis():
    return FileResponse("tem/diagnosis.html")

# Include the send_email and save_result routers
app.include_router(send_email.router)
app.include_router(save_result.router)
app.include_router(user.router)

# Conditional router registration based on ENV variable
from routers import websocket
from routers import stt_router


if ENV == "academy":
    app.include_router(websocket.router)
elif ENV == "aws":
    app.include_router(stt_router.router)

from fastapi import WebSocket
import json

@app.websocket("/ws/adhd")
async def adhd_short_ws(websocket: WebSocket):
    print("🌀 WebSocket 접속 시도됨")
    await websocket.accept()
    print("✅ WebSocket 연결 완료")

    with open("static/questions_list.json", "r", encoding="utf-8") as f:
        questions = json.load(f)
    await websocket.send_json({"type": "init", "questions": questions})
    await websocket.send_json({
        "type": "question",
        "question_num": 1,
        "text": questions[0]["text"].replace("{name}", "사용자"),
        "index": 0
    })
    print("📤 질문 전송됨")

    websocket.state.current_index = 0

    while True:
        try:
            print("🧭 메시지 수신 대기 중...")
            data = await websocket.receive_json()
            print(f"[서버 수신] {data}")
            print("📩 받은 데이터:", data)
            await asyncio.sleep(0.5)
            if data.get("type") == "response":
                text = data.get("text", "")
                client_index = data.get("currentIndex", 0)
                print("📥 응답 수신:", text, "| 클라이언트 currentIndex:", client_index)
                print("🔁 응답 타입: response → 질문 인덱스 증가 예정 (currentIndex + 1)")
                # Removed next_index calculation and sending next question
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
            elif data.get("type") == "ready":
                client_index = data.get("currentIndex", 0)
                next_index = client_index
                print(f"✅ [READY] 클라이언트로부터 다음 질문 요청 수신 → 현재 index: {client_index}, 다음 index: {next_index}")

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
            elif data.get("type") == "question":
                client_index = data.get("currentIndex", 0)
                print(f"📥 [QUESTION 요청] index={client_index}")
                if client_index < len(questions):
                    await websocket.send_json({
                        "type": "question",
                        "text": questions[client_index]["text"].replace("{name}", "사용자"),
                        "index": client_index
                    })
                    print(f"📤 [QUESTION 응답] {questions[client_index]['text']}")
                else:
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


# .env의 값을 읽어서 -> /config.js로 JS가 읽을 수 있게 변환해서 제공함
@app.get("/config.js")
async def get_config_js():
    stt_host = os.getenv("STT_HOST", "")
    tts_host = os.getenv("TTS_HOST", "")
    environment = os.getenv("ENVIRONMENT", "dev")

    config_js = f"""
    const CONFIG = {{
        STT_HOST: "{stt_host}",
        TTS_HOST: "{tts_host}",
        ENVIRONMENT: "{environment}"
    }};
    """
    return Response(content=config_js, media_type="application/javascript")
