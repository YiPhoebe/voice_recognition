# 핵심 
# /GET : HTML 리턴 -> JS에서 WebSocket 열림
# /ws/adhd-short : WebSocket으로 질문 주고, 음성 받고 Whisper 돌리고, 응답 반환
# whisper.transcibe() : .wav -> 텍스트 변환 핵심 함수

from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
import whisper
import os

app = FastAPI()

# Whisper base 모델 로드 (GPU 사용)
model = whisper.load_model("base", device="cuda:0")

# ADHD 간이 문항 (2개)
QUESTIONS = [
    "당신은 주의가 산만하다는 말을 자주 듣습니까?",
    "가만히 앉아 있는 것이 어렵다고 느끼나요?"
]

@app.get("/")
def home():
    return HTMLResponse("""
    <html>
    <head>
      <title>ADHD 음성 진단</title>
    </head>
    <body>
      <h2><b>ADHD</b> 음성 진단 테스트 (2문항)</h2>
      <button onclick="startWebSocket()">진단 시작</button>
      <div id="messages"></div>
      <div id="status" style="margin-top: 10px; font-weight: bold; color: darkred;"></div>

      <script>
        let socket;
        let mediaRecorder;
        let audioChunks = [];
        
        function startWebSocket() {
          const host = window.location.host;
          socket = new WebSocket(`ws://${host}/ws/adhd-short`);
        
          socket.onmessage = async function(event) {
            const msg = event.data;
            const messagesDiv = document.getElementById("messages");
            const statusDiv = document.getElementById("status");
        
            const message = document.createElement("p");
            message.textContent = msg;
            messagesDiv.appendChild(message);
        
            if (msg.trim().startsWith("문항")) {
              statusDiv.textContent = "🎙️ 녹음 중입니다... 응답을 말씀해 주세요.";
        
              // 마이크 녹음 시작
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              audioChunks = [];
              mediaRecorder = new MediaRecorder(stream);
        
              mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
              };
        
              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                const arrayBuffer = await audioBlob.arrayBuffer();
                socket.send(arrayBuffer);
              };
        
              mediaRecorder.start();
        
              // 3초 뒤 자동 종료 및 전송
              setTimeout(() => {
                mediaRecorder.stop();
              }, 3000);
            }
        
            if (
              msg.trim().startsWith("인식된 응답") ||
              msg.includes("진단을 시작합니다") ||
              msg.includes("완료")
            ) {
              statusDiv.textContent = "";
            }
          };
        
          socket.onclose = function() {
            const message = document.createElement("p");
            message.textContent = "진단이 종료되었습니다.";
            document.getElementById("messages").appendChild(message);
            document.getElementById("status").textContent = "";
          };
        }
      </script>
    </body>
    </html>
    """)

@app.websocket("/ws/adhd-short")
async def adhd_short(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("진단을 시작합니다. 마이크로 응답을 녹음해 주세요.")

    for i, question in enumerate(QUESTIONS):
        await websocket.send_text(f"문항 {i+1}: {question}")

        # 클라이언트로부터 음성 데이터 수신 (.wav 형식)
        audio_bytes = await websocket.receive_bytes()
        print(f"[DEBUG] 받은 오디오 byte 수: {len(audio_bytes)}") # 내가 추가한 코드
        audio_path = f"temp_question_{i}.wav"
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)

        # Whisper 실행 전
        print(f"[DEBUG] 질문 {i+1}번 음성 파일 저장 완료 → STT 시작")

        # Whisper를 통해 STT 수행
        result = model.transcribe(audio_path, language="ko")
        transcript = result["text"].strip()

        # 응답 반환
        await websocket.send_text(f"인식된 응답: {transcript}")

        # 임시 파일 삭제
        os.remove(audio_path)

    await websocket.send_text("진단이 완료되었습니다. 감사합니다.")
    await websocket.close()