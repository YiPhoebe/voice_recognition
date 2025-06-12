from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import os, uuid, shutil, asyncio, json
from pydub import AudioSegment
import speech_recognition as sr

router = APIRouter()

with open("static/questions_list.json", "r", encoding="utf-8") as f:
    QUESTIONS = json.load(f)

@router.websocket("/ws/adhd-short")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({
        "type": "init",
        "questions": QUESTIONS
    })
    print("✅ WebSocket 연결 완료")

    question_index = 0
    retry_count = 0

    async def send_question():
        print(f"[질문 전송] ▶ {QUESTIONS[question_index]['audio']}")
        await websocket.send_json({
            "question_num": question_index + 1,
            "text": QUESTIONS[question_index]["text"],
            "audio_path": QUESTIONS[question_index]["audio"]
        })

    print(f"🧠 시작 질문 정보: {QUESTIONS[question_index]}")
    await send_question()

    try:
        while True:
            message = await websocket.receive()

            if websocket.client_state.name != "CONNECTED":
                print("🚫 클라이언트 연결 끊김")
                break

            if "text" in message:
                command = message["text"]

                if command == "SKIP":
                    print(f"⏭️ 질문 {question_index+1} 건너뜀")
                    retry_count = 0
                    question_index += 1
                    if question_index < len(QUESTIONS):
                        await send_question()
                    else:
                        await websocket.send_text("✅ 모든 질문이 완료되었습니다. 수고하셨습니다!")
                        await websocket.close()
                        break
                    continue

                elif command == "RESTART":
                    print("🔄 진단 재시작")
                    question_index = 0
                    retry_count = 0
                    await send_question()
                    continue


            elif "bytes" in message:
                audio_data = message["bytes"]
                session_id = str(uuid.uuid4())
                session_dir = f"tmp/{session_id}"
                os.makedirs(session_dir, exist_ok=True)
                wav_path = os.path.join(session_dir, "response.wav")

                with open(wav_path, "wb") as f:
                    f.write(audio_data)

                AudioSegment.from_file(wav_path).export(wav_path, format="wav")
                recognizer = sr.Recognizer()

                try:
                    with sr.AudioFile(wav_path) as source:
                        audio = recognizer.record(source)

                    text = recognizer.recognize_google(audio, language="ko-KR")
                    print(f"[STT {question_index+1}] ▶ {text}")

                    if not text.strip():
                        raise sr.UnknownValueError()

                    await websocket.send_text(text)
                    await asyncio.sleep(0.5)

                    retry_count = 0
                    question_index += 1

                    if question_index < len(QUESTIONS):
                        await send_question()
                    else:
                        await websocket.send_text("✅ 모든 질문이 완료되었습니다. 수고하셨습니다!")
                        await websocket.close()
                        break

                except sr.UnknownValueError:
                    print(f"[STT ERROR {question_index+1}] 빈 응답")
                    retry_count += 1
                    if retry_count >= 3:
                        await websocket.send_text("🤖 3회 동안 응답이 없어 진단을 종료합니다.")
                        await websocket.close()
                        break
                    else:
                        await websocket.send_text("🤖 인식된 내용이 없습니다.")
                        await asyncio.sleep(0.5)
                        await send_question()

                finally:
                    shutil.rmtree(session_dir, ignore_errors=True)

    except WebSocketDisconnect:
        print("❌ WebSocket 연결 끊김")
    except Exception as e:
        print("❗ 예외 발생:", e)
        await websocket.close()