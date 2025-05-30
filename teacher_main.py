# 핵심 
# /GET : HTML 리턴 -> JS에서 WebSocket 열림
# /ws/adhd-short : WebSocket으로 질문 주고, 음성 받고 Whisper 돌리고, 응답 반환
# whisper.transcibe() : .wav -> 텍스트 변환 핵심 함수

from fastapi import FastAPI, WebSocket
# FastAPI - 서버 전체를 만드는 핵심 클래스
# WebSocket - 실시간 데이터 송수신용 통신 방식 객체 (질문-응답 주고받기용)
# 이 두개가 API 서버 + 실시간 연걸의 기둥

from fastapi.responses import HTMLResponse
# 서버에서 HTML 코드 자체를 반환할 수 있게 해주는 객체
# (즉, .html 파일 없이도 파이썬 코드 안에서 UI까지 포함하는 구조 만들 수 있음)

import whisper
# whisper.load_model()로 모델 불러오고
# model.transcribe()로 음성 -> 텍스트 변환
# 주의 : pip install git+https://github.com/openal/whisper.git 해야함

import os
# 파일 저장, 삭제 등 파일 시스템 조작용
# 오디오 파일 .wav 저장하고
# 사용 후 os.remove()로 삭제할 때 사용

app = FastAPI()
# FastAPI 앱을 생성하는 핵심 선언문
# -> 모든 라우팅, WebSocket, 서버 설정은 이 객체를 통해 연결됨
# @app.get("/") ~~ 여기가 API 경로 지정하는 부분

# Whisper base 모델 로드 (GPU 사용)
model = whisper.load_model("base", device="cuda:0")
# Whisper STT 모델을 불러오고 GPU에 올리는 과정
# whisper.load_model() : Whisper 모델을 메모리에 불러옴 (OpenAI가 만든 음성 인식 모델)
# base : 사용할 모델의 사이즈 지정 -> 작은 모델 부터 'tiny', 'base', 'small', 'medium', 'large'
# device=cuda:0 : GPU 0번 디바이스에 올려서 속도 빠르게 하기

## 코드 실행되면 'model'객체는 이렇게 쓰임 !
# result = model.transcribe("temp_question_1.wav", language="ko")
# transcript = result["text"].strip()
# -> .wav 파일 하나 -> 텍스트 결과 뽑아냄


# ADHD 간이 문항 (2개)
QUESTIONS = [
    "당신은 주의가 산만하다는 말을 자주 듣습니까?",
    "가만히 앉아 있는 것이 어렵다고 느끼나요?"
] # 리스트 형태로 저장한 질문 리스트, 아래 for i, question in enumerate(QUESTIONS): 반복문에서 쓰임
'''QUESTIONS = [
    {"id": 1, "text": "주의가 산만하다는 말을 자주 듣습니까?"},
    {"id": 2, "text": "가만히 앉아 있는 것이 어렵다고 느끼나요?"},
    ...
]'''

@app.get("/")   # FaskAPI의 라우터 데코레이터
# 의미 : 브라우저에서 http://localhost:5981/로 접속했을 때 실행할 함수 정의

def home(): # 위에서 지정한 경로 /로 들어오면 실행될 함수 이름
    return HTMLResponse("""   # 함수 실행 시 HTML 코드 문자열을 응답으로 돌려줌
                              # 즉 이 서버는 브라우저에 접속하면 HTML 페이지 전체를 바로 던져줌
                              # 내부에 JS, CSS, WebSocket 코드 다 들어있음. 올인원 HTML 문자열 구조
    <html>    # html 코드 시작, 늘 <html>로 시작해서 </html>로 끝나야함 그 안에 순서는 아래 처럼
    <head>    # 머리
      <title>ADHD 음성 진단</title>   # 타이틀
    </head>
    <body>    # 몸통
      <h2><b>ADHD</b> 음성 진단 테스트 (2문항)</h2>   # h2로 큰 제목으로 표시하시오
      <button onclick="startWebSocket()">진단 시작</button>   # button 생성 안에 내용은 진단 시작인데 거기에 startWebSocket 포함시킴
      <div id="messages"></div>   # 질문과 응답 출력
      <div id="status" style="margin-top: 10px; font-weight: bold; color: darkred;"></div>  # 현재 상태 메세지는 이런식으로 나온다~ 는 것

      <script>
        let socket;
        let mediaRecorder;
        let audioChunks = [];
        
        function startWebSocket() {
          const host = window.location.host;
          socket = new WebSocket(`ws://${host}/ws/adhd-short`);
          # 이게 핵심 코드 /ws/adhd-short 경로로 WebSocket 연결 시작 !
          # 연결되면 FastAPI 서버의 @app.websocket("/ws/adhd-short") 함수가 호출됨
          # WebSocket이 연결되면 밑에 @app.websocket 함수 실행됨
          # await websocket.accept() 핸드셰이크 수락
        
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