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
    } else if (data.type === "response") {
      handleResponse(data.text);
    }
  };

  function showQuestion(text, increment = true, questionNumber = null) {
    // 사용자 이름 치환
    const username = sessionStorage.getItem("username") || "사용자";
    const personalizedText = text.replace("{name}", username);
    const numberToUse = questionNumber ?? currentQuestionIndex + 1;
    const ttsText = `문제 ${numberToUse}. ${personalizedText}`;
    questionEl.textContent = ttsText;
    // 서버에 TTS 재생용 텍스트 전송 및 오디오 재생
    console.log("📤 TTS 요청 보냄:", ttsText);
    const backendUrl = "http://localhost:10081/synthesize";
    const formData = new URLSearchParams();
    formData.append("text", ttsText);

    fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error("응답 실패: " + res.statusText);
        return res.blob();
      })
      .then(blob => {
        console.log("📥 TTS 응답 수신 - blob:", blob);
        const url = URL.createObjectURL(blob);
        console.log("🔗 생성된 오디오 URL:", url);
        playAudio(url);
      })
      .catch(err => {
        console.error("🔴 TTS fetch 오류:", err);
      });
    responseEl.textContent = "🗣️ 응답을 기다리는 중...";
    checkboxEls.forEach(cb => cb.checked = false);
    // Update progress bar
    const totalQuestions = questions.length || 20; // Fallback if questions not initialized
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressBar.style.width = `${progress}%`;
    if (increment) currentQuestionIndex++;
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

  // 오디오 제어 함수들 - 클라이언트에서 직접 오디오 제어
  let currentAudio = null;

  window.playAudio = (url) => {
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio(url);
    console.log("🎧 Audio 객체 생성 완료");
    if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
      const audioCtx = new (AudioContext || webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);
    }
    currentAudio.onended = () => { startRecording(); };
    currentAudio.play()
      .then(() => {
        console.log("▶️ 오디오 재생 시작:", url);
      })
      .catch((err) => {
        console.warn("⛔ 오디오 자동 재생 차단됨. 사용자 상호작용 필요:", err);
      });
  };

  // 음성 녹음 및 STT 전송 함수들
  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        sendAudioToSTT(audioBlob);
      };

      mediaRecorder.start();
      console.log("🎙️ 녹음 시작됨");

      setTimeout(() => {
        mediaRecorder.stop();
      }, 4000);
    });
  }

  function sendAudioToSTT(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    fetch("/stt", {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        const text = data.text || "(응답 없음)";
        console.log("📝 STT 결과:", text);
        ws.send(JSON.stringify({ type: "response", text }));
      })
      .catch(err => {
        console.error("🔴 STT 오류:", err);
      });
  }

  window.pauseAudio = () => {
    if (currentAudio) currentAudio.pause();
    console.log("⏸️ 오디오 일시정지");
  };
  window.resumeAudio = () => {
    if (currentAudio) currentAudio.play();
    console.log("▶️ 오디오 이어 재생");
  };
  window.replayAudio = () => {
    if (questions.length === 0 || currentQuestionIndex === 0) {
      console.warn("❌ 질문 리스트가 아직 초기화되지 않았거나, 1번 문제 이전입니다");
      return;
    }

    const q = questions[currentQuestionIndex - 1];
    if (q && typeof q.text === "string") {
      showQuestion(q.text, false, q.id);
      console.log("🔁 오디오 다시 재생 (질문 다시 요청)");
    } else {
      console.warn("❌ 다시 재생할 질문을 찾을 수 없음");
    }
  };

  window.skipQuestion = () => ws.send(JSON.stringify({ type: "skip" }));
  window.restartDiagnosis = () => ws.send(JSON.stringify({ type: "restart" }));
});