// diagnosis.js
const audio = new Audio();

let socket;
let currentQuestionIndex = 0;
let retryCount = 0;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isPaused = false;


function startDiagnosis() {
  document.getElementById("input-form").classList.add("hidden");
  document.getElementById("intro-step").classList.remove("hidden");

  showIntroStep();

  // 4초 후 회색 문구 표시
  setTimeout(() => {
    document.getElementById("click-to-continue").classList.remove("hidden");
  }, 2000);
}


function startWebSocket() {
  const host = window.location.host;
  socket = new WebSocket(`ws://${host}/ws/adhd-short`);

  socket.onopen = () => console.log("🟢 WebSocket 연결됨");
  socket.onclose = () => console.log("🔴 WebSocket 종료됨");

  socket.onmessage = async (event) => {
    console.log("📨 서버 응답:", event.data);

    if (event.data.startsWith("{")) {
      await delay(3000);
      const data = JSON.parse(event.data);
      currentQuestionIndex = data.question_num;
      updateQuestionUI(data.text);
      playAudio(data.audio_path);
    } else {
      await updateResponseUI(event.data);
    }
  };
}

function updateQuestionUI(text) {
  const lowerText = text.toLowerCase();
  document.getElementById("question").innerText = lowerText;
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
    return;
  }

  const scoreMap = [
    [4, ["4", "사", "아주 많이", "4점", "4번", "4전", "사전"]],
    [3, ["3", "삼", "꽤", "3점", "3번", "3전", "삼전"]],
    [2, ["2", "이", "약간", "2점", "2번", "2전", "이전"]],
    [1, ["1", "일", "전혀 그렇", "1점", "1번", "1전", "일전"]],
  ];

  const lowerText = text.toLowerCase();
  let foundScore = null;
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
  audio.play().catch(error => console.warn("🔇 오디오 재생 실패:", error));
  audio.onended = () => {
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
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    isRecording = false;
    isPaused = false;
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    socket.send(audioBlob);
  };

  mediaRecorder.onerror = e => console.error("❌ MediaRecorder 오류 발생:", e);

  mediaRecorder.start();
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
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



const genderSelect = document.getElementById("gender");

function checkGenderPlaceholder() {
  if (genderSelect.value === "") {
    genderSelect.classList.remove("selected");
  } else {
    genderSelect.classList.add("selected");
  }
}

genderSelect.addEventListener("change", checkGenderPlaceholder);
window.addEventListener("load", checkGenderPlaceholder); // 새로고침 대비


function showIntroStep() {
  const introStep = document.getElementById("intro-step");
  const guideLines = document.querySelectorAll(".guide-line");
  const icon = document.querySelector(".intro-icon");
  const clickText = document.getElementById("click-to-continue");

  introStep.classList.remove("hidden");
  introStep.style.display = "flex";

  // 아이콘 등장
  icon.classList.remove("hidden");
  setTimeout(() => icon.classList.add("fade-text-fixed"), 200);

  // 문장 디졸브
  guideLines.forEach((line, i) => {
    line.classList.remove("hidden");
    setTimeout(() => {
      line.classList.add("fade-text-fixed");
    }, 600 + i * 400);
  });

  // 클릭 유도 문구 디졸브
  setTimeout(() => {
    clickText.classList.remove("hidden");
    setTimeout(() => clickText.classList.add("fade-text-fixed"), 100);

    // 클릭 시 진단 시작
    document.body.addEventListener("click", () => {
      introStep.classList.add("hidden");
      clickText.classList.add("hidden");
      startWebSocket();  // 이걸로 진단 진행 시작
    }, { once: true });
  }, 1500);
}


window.startDiagnosis = startDiagnosis; 