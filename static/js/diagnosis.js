// diagnosis.js

let audio;
audio = new Audio();
let introAudio = null;
let introAudio2 = null;

// 사용자 정보 저장용 변수
let userInfo = {
  name: "",
  email: "",
  gender: "",
  birth: ""
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 DOMContentLoaded 실행됨");
  introAudio = document.getElementById("introAudio");
  introAudio2 = document.getElementById("introAudio2");

  console.log("🎯 DOM 로드됨. introAudio:", introAudio);
  console.log("🎯 DOM 로드됨. introAudio2:", introAudio2);

  if (!introAudio) {
    console.warn("⚠️ introAudio 요소를 찾을 수 없습니다.");
  }
  if (!introAudio2) {
    console.warn("⚠️ introAudio2 요소를 찾을 수 없습니다.");
  }
});

let socket;
let currentQuestionIndex = 0;
let retryCount = 0;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let isPaused = false;

function startDiagnosis() {
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const genderInput = document.getElementById("gender");
  const yearInput = document.getElementById("year");
  const monthInput = document.getElementById("month");
  const dayInput = document.getElementById("day");

  if (!nameInput || !emailInput || !genderInput || !yearInput || !monthInput || !dayInput) {
    alert("입력 폼 요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.");
    return;
  }

  // 입력 값 가져오기
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const gender = genderInput.value;
  const year = yearInput.value.trim();
  const month = monthInput.value.trim();
  const day = dayInput.value.trim();
  const birth = `${year}-${month}-${day}`;

  // 유효성 검사
  if (!name || !email || !gender || !year || !month || !day) {
    alert("모든 정보를 입력해주세요.");
    return;
  }

  // 사용자 정보 저장
  userInfo = { name, email, gender, birth };
  console.log("✅ 사용자 정보 저장됨:", userInfo);

  fetch('/save-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userInfo)
  })
  .then(response => {
    if (!response.ok) throw new Error("서버 저장 실패");
    console.log("✅ 사용자 정보가 서버에 저장되었습니다.");
  })
  .catch(err => {
    console.error("❌ 사용자 정보 저장 실패:", err);
  });

  document.getElementById("input-form").classList.add("hidden");
  document.getElementById("intro-step").classList.remove("hidden");

  showIntroStep(); // ✅ 오디오 + 디졸브 + 클릭 이벤트 포함
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

function showIntroStep() {
  if (!introAudio || !introAudio2) {
    introAudio = document.getElementById("introAudio1");
    introAudio2 = document.getElementById("introAudio2");
    console.log("🧠 DOM 재탐색: introAudio / introAudio2", introAudio, introAudio2);
  }
  const introStep = document.getElementById("intro-step");
  const guideLines = document.querySelectorAll(".guide-line");
  const icon = document.querySelector(".intro-icon");
  const clickText = document.getElementById("click-to-continue");

  console.log("📌 introAudio2 ID 존재 여부 확인:", introAudio2);
  console.log("🎯 DOM에서 재선택된 introAudio:", introAudio);
  console.log("🎯 DOM에서 재선택된 introAudio2:", introAudio2);

  introStep.classList.remove("hidden");
  introStep.style.display = "flex";

  // 인트로 오디오 자동 재생 (두 개를 순차적으로 재생)
  console.log("🔍 첫 번째 오디오 요소:", introAudio);
  if (introAudio) {
    introAudio.muted = true;
    setTimeout(() => {
      introAudio.play().then(() => {
        console.log("🎯 첫 번째 introAudio.play() 시도");
        introAudio.muted = false;
        introAudio.currentTime = 0;
        introAudio.onended = () => {
          console.log("📎 두 번째 인트로 오디오 엘리먼트:", introAudio2);
          const secondAudio = introAudio2;
          if (secondAudio) {
            secondAudio.muted = true;
            secondAudio.currentTime = 0;
            setTimeout(() => {
              secondAudio.play().then(() => {
                secondAudio.muted = false;
                console.log("🔊 두 번째 인트로 오디오 재생 성공");
              }).catch(e => console.error("🧨 두 번째 오디오 자동 재생 실패:", e));
            }, 1000);
          } else {
            console.warn("⚠️ 두 번째 인트로 오디오 엘리먼트를 찾을 수 없습니다.");
          }
        };

        console.log("🔊 첫 번째 인트로 오디오 재생 성공");
      }).catch(err => {
        console.warn("❌ 자동 재생 실패:", err);
        document.body.addEventListener("click", () => {
          introAudio.play().catch(e => console.error("🧨 재시도 실패:", e));
          if (introAudio2) {
            introAudio2.play().catch(e => console.error("🧨 두 번째 intro 재시도 실패:", e));
          }
        }, { once: true });
      });
    }, 800);
  }

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

    document.body.addEventListener("click", () => {
      if (introAudio) {
        introAudio.pause();
        introAudio.currentTime = 0;
      }
      if (introAudio2) {
        introAudio2.pause();
        introAudio2.currentTime = 0;
      }

      const introStep = document.getElementById("intro-step");
      const clickText = document.getElementById("click-to-continue");

      if (introStep) introStep.classList.add("hidden");
      if (clickText) clickText.classList.add("hidden");

      const questionContainer = document.getElementById("question-container");
      if (questionContainer) questionContainer.classList.remove("hidden");

      startWebSocket();
    }, { once: true });
  }, 1500);
}

window.startDiagnosis = startDiagnosis;

// 사용자 정보를 CSV 문자열로 변환
function convertUserInfoToCSV(user) {
  const header = ["Name", "Email", "Gender", "Birth"];
  const values = [user.name, user.email, user.gender, user.birth];
  return `${header.join(",")}\n${values.join(",")}`;
}

// CSV 파일 다운로드 함수
function downloadUserInfoAsCSV() {
  const csvContent = convertUserInfoToCSV(userInfo);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "user_info.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 이메일 전송용 JSON 반환 (예: 백엔드에 POST 요청으로 보낼 경우)
function getUserInfoJSON() {
  return JSON.stringify(userInfo);
}

window.downloadUserInfoAsCSV = downloadUserInfoAsCSV;
window.getUserInfoJSON = getUserInfoJSON;