document.addEventListener("DOMContentLoaded", () => {

  const questionEl = document.getElementById("question");
  const questionNumberEl = document.getElementById("question-number");
  const responseEl = document.getElementById("responseText");

  const progressBar = document.getElementById("progressBar");

  const checkboxEls = [
    document.getElementById("checkbox-1"),
    document.getElementById("checkbox-2"),
    document.getElementById("checkbox-3"),
    document.getElementById("checkbox-4"),
  ];

  const ws = new WebSocket(`ws://${location.host}/ws/adhd-short`);

  let currentQuestionIndex = 0;
  let questions = [];

  ws.onopen = () => {
    console.log("✅ WebSocket 연결됨");
    // 사용자 이름을 sessionStorage에서 받아서 서버에 전달
    const username = sessionStorage.getItem("username") || "사용자";
    ws.send(JSON.stringify({ type: "start", username }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "init") {
      questions = data.questions;
    } else if (data.type === "question") {
      showQuestion(data.text);
      currentQuestionIndex++;
    } else if (data.type === "response") {
      handleResponse(data.text);
    }
  };

  function showQuestion(text) {
    // 사용자 이름 치환
    const username = sessionStorage.getItem("username") || "사용자";
    const personalizedText = text.replace("{name}", username);
    const ttsText = `문제 ${currentQuestionIndex + 1}. ${personalizedText}`;
    questionEl.textContent = ttsText;
    // 서버에 TTS 재생용 텍스트 전송
    ws.send(JSON.stringify({ type: "tts", text: ttsText }));
    responseEl.textContent = "🗣️ 응답을 기다리는 중...";
    checkboxEls.forEach(cb => cb.checked = false);
    // Update progress bar
    const totalQuestions = questions.length || 20; // Fallback if questions not initialized
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function handleResponse(text) {
    responseEl.textContent = text;

    const scoreMap = {
      1: ["1", "일", "전혀", "1점"],
      2: ["2", "이", "약간", "2점"],
      3: ["3", "삼", "꽤", "3점"],
      4: ["4", "사", "아주", "4점"],
    };

    const normalized = text.trim();
    for (let [val, keywords] of Object.entries(scoreMap)) {
      if (keywords.some(k => normalized.includes(k))) {
        const idx = parseInt(val) - 1;
        if (checkboxEls[idx]) checkboxEls[idx].checked = true;
        break;
      }
    }
  }

  // 오디오 제어 함수들
  window.pauseAudio = () => ws.send("pause");
  window.resumeAudio = () => ws.send("resume");
  window.replayAudio = () => ws.send("replay");
  window.skipQuestion = () => ws.send("skip");
  window.restartDiagnosis = () => ws.send("restart");
});