// diagnosis.js
const audio = new Audio();

let socket;
let currentQuestionIndex = 0;
let retryCount = 0;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isPaused = false;
let foundScore = null;
const lowerText = text.toLowerCase();



function startDiagnosis() {
  document.getElementById("start-btn").disabled = true;
  startWebSocket();
}
window.startDiagnosis = startDiagnosis; 

function startWebSocket() {
  const host = window.location.host;
  socket = new WebSocket(`ws://${host}/ws/adhd-short`);

  socket.onopen = () => console.log("🟢 WebSocket 연결됨");
  socket.onclose = () => console.log("🔴 WebSocket 종료됨");

  socket.onmessage = async (event) => {
    console.log("📨 서버 응답:", event.data);

    if (event.data.startsWith("{")) {
      // ✅ 서버로부터 새로운 질문이 왔을 때
      // ⏸️ 응답 체크박스가 너무 빨리 꺼지는 걸 방지하기 위해 약간 기다림
      await delay(3000);

      const data = JSON.parse(event.data);  // 질문 번호, 텍스트, 오디오 경로 포함
      currentQuestionIndex = data.question_num;

      updateQuestionUI(data.text);           // 질문 텍스트 UI에 표시
      playAudio(data.audio_path);            // 질문 오디오 재생 후 녹음 시작

    } else {
      // ✅ 서버가 보낸 응답 텍스트 (예: 🤖 인식된 내용, ✅ 점수 결과 등)
      await updateResponseUI(event.data);    // 체크박스 자동 표시 및 텍스트 출력
    }
  };
}

function updateQuestionUI(text) {
  console.log("🔍 [updateQuestionUI 호출됨]:", text);
  document.getElementById("question").innerText = `${text}`;
  document.getElementById("response").innerText = "답변 듣는 중:";
  document.getElementById("responseText").innerText = "";
  document.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
}

function updateResponseUI(text) {
  const knownBotResponses = [
    "인식된 내용이 없습니다.",
    "3회 동안 응답이 없어 진단을 종료합니다.",
    "모든 질문이 완료되었습니다. 수고하셨습니다!"
  ];

  if (knownBotResponses.includes(text.trim())) {
    document.getElementById("responseText").innerText = "🗣️ " + text;
    return; // ⛔️ 더 이상 체크박스 분석하지 않음
  }

  // 여기는 실제 STT로 인식된 텍스트인 경우만 실행
  const scoreMap = [
    [4, ["4", "사", "아주 많이", "4점", "4번","4전", "사전"]],
    [3, ["3", "삼", "꽤", "3점", "3번", "3전", "삼전"]],
    [2, ["2", "이", "약간", "2점", "2번", "2전", "이전"]],
    [1, ["1", "일", "전혀 그렇", "1점", "1번", "1전", "일전"]],
  ];

  let foundScore = null;
  const lowerText = text.toLowerCase();
  for (const [score, phrases] of scoreMap) {
    if (phrases.some(p => lowerText.includes(p))) {
      foundScore = score;
      break;
    }
  }

  if (foundScore) {
    const checkbox = document.getElementById(`checkbox-${foundScore}`);
    if (checkbox) checkbox.checked = true;
  }

  document.getElementById("responseText").innerText = "🗣️ " + text;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showListening() {
  document.getElementById("response").innerText = "답변 듣는 중:";
}

function playAudio(url) {
  audio.pause();
  audio.currentTime = 0;
  audio.src = url;
  audio.load();
  audio.play().catch((error) => {
    console.warn("🔇 오디오 재생 실패:", error);
  });
  audio.onended = () => {
    console.log("🎤 오디오 재생 완료 → 녹음 시작");
    showListening();
    startRecording();
  };
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  isRecording = true;
  isPaused = false;

  mediaRecorder.ondataavailable = e => {
    console.log("🟠 ondataavailable 호출됨");
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    console.log("🔴 onstop 호출됨");
    isRecording = false;
    isPaused = false;
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    console.log("🎙️ 녹음 완료 → 서버 전송");
    socket.send(audioBlob);
  };

  mediaRecorder.onerror = (e) => {
    console.error("❌ MediaRecorder 오류 발생:", e);
  };

  mediaRecorder.start();
  console.log("🎙️ 녹음 시작");

  setTimeout(() => {
    console.log("⏳ 6초 경과, mediaRecorder.stop() 호출 시도");
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    } else {
      console.warn("⚠️ mediaRecorder가 녹음 상태가 아님:", mediaRecorder.state);
    }
  }, 3000);
}

  mediaRecorder.onstop = () => {
    isRecording = false;
    isPaused = false;
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    console.log("🎙️ 녹음 완료 → 서버 전송");
    socket.send(audioBlob);
  };

  mediaRecorder.start();
  isRecording = true;
  isPaused = false;

  console.log("🎙️ 녹음 시작");

function pauseAudio() {
  audio.pause();  // 오디오도 같이 멈추자!

  if (isRecording && !isPaused) {
    mediaRecorder.pause();
    isPaused = true;
    console.log("⏸️ 녹음 일시정지 + 오디오 정지");
  } else if (isRecording && isPaused) {
    console.log("⏸️ 이미 녹음이 일시정지 상태야");
  } else if (!isRecording) {
    console.log("⏸️ 녹음이 진행 중이 아냐 (오디오는 정지함)");
  }
}

function resumeAudio() {
  if (audio.paused) {
    audio.play();
    console.log("▶️ 오디오 이어듣기");

    if (isRecording && isPaused && mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      isPaused = false;
      console.log("▶️ 녹음도 이어서 재개");
    }
  }
}

function replayAudio() {
  audio.pause();
  audio.currentTime = 0;
  audio.play();
  audio.onended = () => {
    console.log("🎤 오디오 재생 완료 → 녹음 시작");
    startRecording();
  };
}

function skipQuestion() {
  audio.pause();
  audio.currentTime = 0;
  if (audio.onended) audio.onended();
  socket.send("SKIP");
}

function restartDiagnosis() {
  audio.pause();
  audio.currentTime = 0;
  if (socket) socket.close();
  updateQuestionUI("테스트를 다시 시작합니다.");
  document.getElementById("responseText").innerText = "";
  document.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
  currentQuestionIndex = 0;
  retryCount = 0;
  setTimeout(() => {
    startWebSocket();
    setTimeout(() => socket.send("RESTART"), 300);
  }, 300);
}