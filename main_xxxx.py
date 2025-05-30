# 핵심 
# /GET : HTML 리턴 -> JS에서 WebSocket 열림
# /ws/adhd-short : WebSocket으로 질문 주고, 음성 받고 Whisper 돌리고, 응답 반환
# whisper.transcibe() : .wav -> 텍스트 변환 핵심 함수

import json

from fastapi.staticfiles import StaticFiles

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

app.mount("/static", StaticFiles(directory="static"), name="static")

# Whisper base 모델 로드 (GPU 사용)
model = whisper.load_model("small", device="cuda:0")
# Whisper STT 모델을 불러오고 GPU에 올리는 과정
# whisper.load_model() : Whisper 모델을 메모리에 불러옴 (OpenAI가 만든 음성 인식 모델)
# base : 사용할 모델의 사이즈 지정 -> 작은 모델 부터 'tiny', 'base', 'small', 'medium', 'large'
# device=cuda:0 : GPU 0번 디바이스에 올려서 속도 빠르게 하기

## 코드 실행되면 'model'객체는 이렇게 쓰임 !
# result = model.transcribe("temp_question_1.wav", language="ko")
# transcript = result["text"].strip()
# -> .wav 파일 하나 -> 텍스트 결과 뽑아냄


# # ADHD 간이 문제 (2개)
# QUESTIONS = [
#     "당신은 주의가 산만하다는 말을 자주 듣습니까?",
#     "가만히 앉아 있는 것이 어렵다고 느끼나요?"
# ] # 리스트 형태로 저장한 질문 리스트, 아래 for i, question in enumerate(QUESTIONS): 반복문에서 쓰임
# '''QUESTIONS = [
#     {"id": 1, "text": "주의가 산만하다는 말을 자주 듣습니까?"},
#     {"id": 2, "text": "가만히 앉아 있는 것이 어렵다고 느끼나요?"},
#     ...
# ]'''

@app.get("/")   # FaskAPI의 라우터 데코레이터
# 의미 : 브라우저에서 http://localhost:5981/로 접속했을 때 실행할 함수 정의

def home(): # 위에서 지정한 경로 /로 들어오면 실행될 함수 이름
    return HTMLResponse("""   <!-- 함수 실행 시 HTML 코드 문자열을 응답으로 돌려줌 -->
                              <!-- 즉 이 서버는 브라우저에 접속하면 HTML 페이지 전체를 바로 던져줌 -->
                              <!-- 내부에 JS, CSS, WebSocket 코드 다 들어있음. 올인원 HTML 문자열 구조 -->
    <html>    <!-- html 코드 시작, 늘 <html>로 시작해서 </html>로 끝나야함 그 안에 순서는 아래 처럼 -->
    <head>    <!-- 머리, 페이지의 메타정보, 스타일, 스크립트, 제목 등을 정의하는 영역 (눈에 안보이는 설정 정보 들어감) -->
      <title>ADHD 음성 진단</title>   <!-- 타이틀 <head> 안에서만 사용 -->
    </head>  <!-- 헤드 끝
    <body>    <!-- 몸통, 버튼, 텍스트, 이미지, JS로 제어되는 요소들 다 여기에 나옴 (사용자 눈에 실제 보이는 영역) -->
      <h2><b>ADHD</b> 음성 진단 테스트 (20문제)</h2>   <!-- h2로 큰 제목으로 표시하시오 (h1이 제일 크고 h6까지 있음), <b>는 굵게 -->
      <button onclick="startWebSocket()">진단 시작</button>   <!-- button 클릭하면 startWebSocket() 함수 실행, 즉, WebSocket 연결 + 질문 시작이 여기서 시작됨 -->
      <div id="messages"></div>   <!-- 질문과 응답 출력 (appendChild()로 계속 추가함), HTML에서 id="messages"로 지정 -> JS에서 쉽게 선택 가능 -->
      <div id="status" style="margin-top: 10px; font-weight: bold; color: darkred;"></div>  <!-- 현재 상태 메세지는 이런식으로 나온다~ 는 것 -->
        <!-- font-weight : bold (글씨 굵게), color : darkred (어두운 빨강), JS에서 .textContent = "..."로 내용 동적 변경 -->

      <script>  // HTML 안에서 JS 코드를 쓰기 위한 영역 (여기서 부터는 JavaScript)
        let socket;     // WebSocket 객체 저장용
        let mediaRecorder;      // 마이크 녹음 기능 담당 (MediaRecorder API)
        let audioChunks = [];   // 음성 조각들 저장 배열
        let questions = [];     // 서버에서 받은 질문 리스트 저장용 (fetch로 채움)
                        
        fetch("/static/questions_list.json")    // 파일 받아옴
        .then(response => response.json())      // response.json()으로 파싱 -> data.questions에 배열 들어있음
        .then(data => {
            questions = data;
            // startWebSocket() 함수 호출 준비 완료!
        });     // 결과는 전역변수 questions에 저장됨, 이걸로 서버가 질문 안 보내고, 프론트가 질문 띄울 준비 완료 !
        
        function startWebSocket() {     // button 누르면 호출되는 함수, 67번 줄, WebSocket열고 질문->응답->전송 순서의 메인 로직 시작
          const host = window.location.host;    // 현재 브라우저의 호스트 주소
          socket = new WebSocket(`ws://${host}/ws/adhd-short`);
          // 이게 핵심 코드 /ws/adhd-short 경로로 WebSocket 연결 시작 !
          // 연결되면 FastAPI 서버의 @app.websocket("/ws/adhd-short") 함수가 호출됨
          // WebSocket이 연결되면 밑에 @app.websocket 함수 실행됨
          // await websocket.accept() 핸드셰이크 수락
        
          socket.onmessage = async function(event) {    // 서버에서 메세지를 받을 때마다 자동 실행되는 콜백
                                                        // event.data에 서버가 보낸 텍스트가 들어있음
                                                        // 질문 메세지, 응답 결과, 진단 종료 안내 등을 모두 여기서 처리함
            const msg = event.data;    
            const messagesDiv = document.getElementById("messages");
            const statusDiv = document.getElementById("status");
        
            const message = document.createElement("p");
            message.textContent = msg;
            messagesDiv.appendChild(message);
            // 위 6줄의 코드 해설 : 메세지를 <p> 태그로 만들어서 #massages에 추가
            // 질문, 응답, 안내 문구 등 모든 텍스트 출력은 여기에 추가됨
        
            if (msg.trim().startsWith("문제")) {
            // 메시지가 "문제 ..." 으로 시작하면 -> 녹음 시작 신호
            // 즉 서버가 "문한 1 : ... " 이런 텍스트 보냈다는 뜻
              statusDiv.textContent = "🎙️ 녹음 중입니다... 응답을 말씀해 주세요.";
                // 상태 표시항 (id="status")에 녹음 안내 텍스트 띄움
                        
              // ✅ 문제 번호 추출 (ex: "문제 3: ..." → 3)
              const questionNumber = parseInt(msg.match(/문제\s*(\d+)/)[1]);

              // ✅ 해당 질문의 mp3 경로 추출
              const audioPath = questions[questionNumber - 1].audio;

              // ✅ 오디오 재생
              const audio = new Audio(audioPath);
              audio.play();
        
              // 마이크 녹음 시작
              audio.play();  // 오디오 먼저 재생

              audio.onended = async () => {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              audioChunks = [];
              mediaRecorder = new MediaRecorder(stream, {
                        mimeType:"audio/webm",
                        audioBitsPerSecond: 128000});

              mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
              };

              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                const arrayBuffer = await audioBlob.arrayBuffer();
                socket.send(arrayBuffer);
              };

              mediaRecorder.start();

              setTimeout(() => {
                mediaRecorder.stop();
              }, 3000);
              };
              // 브라우저에서 마이크 사용 권한 요청하고 오디오 스트림 받아옴
              audioChunks = [];
              mediaRecorder = new MediaRecorder(stream);
              // 음성 조각 담을 배열을 초기화, MediaRecorder 생성 -> 마이크로부터 녹음 시작할 준비
        
              mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
              };    // 음성 데이터가 들어올 때마다 배열에 push
        
              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                const arrayBuffer = await audioBlob.arrayBuffer();
                socket.send(arrayBuffer);
              };    // 녹음 끝나면 Blob 객체로 .wav 형식 오디오 생성
                    // 서버가 byte 받아야 하니깐 ArrayBuffer로 변환
                    // WebSocket으로 음성 전송
        
              mediaRecorder.start();
        
              // 3초 뒤 자동 종료 및 전송
              setTimeout(() => {
                mediaRecorder.stop();
              }, 3000);
            }   // 녹음 시작하고 3초 후 자동 정지 (이건 타임을 좀 조정해보자)
        
            if (
              msg.trim().startsWith("인식된 응답") ||
              msg.includes("진단을 시작합니다") ||
              msg.includes("완료")
            ) {
              statusDiv.textContent = "";
            }   // 서버가 결과 응답 또는 안내 메시지 보낼 경우 상태창(statusDiv) 비움
          };
        
          socket.onclose = function() {
            const message = document.createElement("p");
            message.textContent = "진단이 종료되었습니다.";
            document.getElementById("messages").appendChild(message);
            document.getElementById("status").textContent = "";
          };    // WebSocket 종료되면, 사용자에게 종료 메시지 듸움, 상태창도 비움
        }
      </script>
      <!--  스크립트 전체 요약
       1. fetch()로 질문 리스트 가져옴
       2. 버튼 누르면 startWebSocket()으로 연결 시작
       3. 서버가 "문제 n" 전송 -> 마이크 녹음 시작
       4. 3초 녹음 -> 서버로 전송 -> Wisper로 STT -> 텍스트 응답
       5. 결과 메시지 출력
       종료되면 진단 완료 안내 -->
    </body>
    </html>
    """)

base_dir = os.path.dirname(__file__)
json_path = os.path.join(base_dir, "static", "questions_list.json")

with open("static/questions_list.json", "r", encoding="utf-8") as f:
    QUESTIONS = json.load(f)

@app.websocket("/ws/adhd-short")
async def adhd_short(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("진단을 시작합니다. 마이크로 응답을 녹음해 주세요.")

    responses = []  # 응답 저장 리스트

    for i, q in enumerate(QUESTIONS):
        # 질문은 이제 JS가 화면에 출력함 (서버가 안 보냄)
        await websocket.send_text(f"{q['text']}")
        audio_bytes = await websocket.receive_bytes()

        # 클라이언트로부터 음성 데이터 수신 (.wav 형식)
        audio_bytes = await websocket.receive_bytes()

        save_dir = "recordings"
        os.makedirs(save_dir, exist_ok=True)  # recordings 폴더 없으면 만듦

        audio_path = os.path.join(save_dir, f"q{i+1}_answer.wav")
        with open(audio_path, "wb") as f:
            f.write(audio_bytes)
        # audio_path = f"temp_question_{i}.wav"
        # with open(audio_path, "wb") as f:
        #     f.write(audio_bytes)

        # Whisper 실행 전
        print(f"[DEBUG] 질문 {i+1}번 음성 파일 저장 완료 → STT 시작")

        # Whisper를 통해 STT 수행
        result = model.transcribe(audio_path, language="ko")
        transcript = result["text"].strip()

        # 응답 반환
        await websocket.send_text(f"인식된 응답: {transcript}")

        # 임시 파일 삭제
        # os.remove(audio_path)

    # 모든 문항 끝난 후 응답 저장
    with open("responses.json", "w", encoding="utf-8") as f:
        json.dump(responses, f, ensure_ascii=False, indent=2)

    await websocket.send_text("진단이 완료되었습니다. 감사합니다.")
    await websocket.close()