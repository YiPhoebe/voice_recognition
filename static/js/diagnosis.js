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
  window.checkboxEls = checkboxEls;

  checkboxEls.forEach(cb => {
    cb.checked = false;
    cb.classList.add("locked");
  });

  function handleSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log("📥 서버 응답 도착:", data);

    if (data.type === "init") {
      questions = data.questions;
    } else if (data.type === "question") {
      showQuestion(data.text);
    } else if (data.type === "response") {
      console.log("✅ handleResponse 호출 준비됨!");
      handleResponse(data.text);
    }
  }

  const socket = new WebSocket(`ws://${location.host}/ws/adhd-short`);
  socket.onmessage = handleSocketMessage;

  let currentQuestionIndex = 0;
  let questions = [];

  socket.onopen = () => {
    console.log("✅ WebSocket 연결됨");
    // 사용자 이름을 sessionStorage에서 받아서 서버에 전달
    const username = sessionStorage.getItem("username") || "사용자";
    socket.send(JSON.stringify({ type: "start", username }));
  };

  function convertToKoreanNumber(n) {
    const digit = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    if (n <= 9) return digit[n];
    if (n === 10) return "십";
    if (n < 20) return "십" + digit[n % 10];
    if (n === 20) return "이십";
    return n.toString(); // fallback
  }

  function showQuestion(text, increment = true, questionNumber = null) {
    // 사용자 이름 치환
    const username = sessionStorage.getItem("username") || "사용자";
    const personalizedText = text.replace("{name}", username);
    const numberToUse = questionNumber ?? currentQuestionIndex + 1;
    const nativeNumber = convertToKoreanNumber(numberToUse);
    const ttsText = `문제 ${nativeNumber}번. ${personalizedText}`;
    questionEl.textContent = `문제 ${numberToUse}. ${personalizedText}`;
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
    window.requestAnimationFrame(() => {
      responseEl.textContent = "🗣️ 응답을 기다리는 중...";
    });
    checkboxEls.forEach(cb => cb.checked = false);
    // Update progress bar
    const totalQuestions = questions.length || 20; // Fallback if questions not initialized
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressBar.style.width = `${progress}%`;
    if (increment) currentQuestionIndex++;
  }

  function handleResponse(text) {
    window.requestAnimationFrame(() => {
      responseEl.textContent = text;
      responseEl.style.opacity = 1;
    });

    const scoreMap = {
      1: ["전혀 그렇지 않다", "1번", "일번", "1", "일"],
      2: ["약간 그렇다", "2번", "이번", "2", "이"],
      3: ["꽤 그렇다", "3번", "삼번", "3", "삼"],
      4: ["아주 많이 그렇다", "4번", "사번", "4", "사"],
    };

    const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
    console.log("🧪 normalized (length " + normalized.length + "):", JSON.stringify(normalized));

    // 🔎 DEBUG: Compare each keyword to normalized text in detail
    for (const [score, keywords] of Object.entries(scoreMap)) {
      for (const k of keywords) {
        const nk = k.trim().toLowerCase().replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
        const normalizedForMatch = normalized.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
        const match = nk === normalizedForMatch;
        console.log(`🔍 비교 [score ${score}]: "${nk}" === "${normalizedForMatch}" →`, match);
      }
    }

    let matchScore = null;

    for (const [score, keywords] of Object.entries(scoreMap)) {
      if (keywords.some(k => k.trim().toLowerCase().replace(/\s+/g, " ") === normalized)) {
        matchScore = parseInt(score);
        break;
      }
    }

    if (matchScore !== null) {
      const idx = matchScore - 1;
      if (checkboxEls[idx]) {
        checkboxEls[idx].checked = true;
        checkboxEls[idx].classList.add("locked");
        checkboxEls[idx].style.outline = "3px solid red"; // ✅ 시각 디버그 표시
        console.log("✅ 체크박스", idx + 1, "강제 체크됨", checkboxEls[idx]);
      } else {
        console.warn("❌ 체크박스 null!", idx, matchScore);
      }
    } else {
      console.warn("❌ 일치하는 응답 없음:", normalized);
    }
    setTimeout(() => {
      if (currentQuestionIndex < questions.length) {
        showQuestion(questions[currentQuestionIndex]);
      } else {
        console.log("✅ 모든 질문 완료");
      }
    }, 1000);
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
        console.log("🛑 녹음 종료됨");
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log("📦 녹음된 Blob 생성 완료:", audioBlob);
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

    console.log("📨 FormData 준비 완료");
    console.log("📤 STT 요청 전송 시작");

    fetch("/stt", {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        console.log("📥 STT 응답 수신 완료");
        const text = data.text || "(응답 없음)";
        console.log("📝 STT 텍스트 결과:", text);
        
        // 📝 응답을 sessionStorage에 임시 저장
        let tempResponses = JSON.parse(sessionStorage.getItem("diagnosisResponses") || "[]");
        tempResponses.push({ questionIndex: currentQuestionIndex, response: text });
        sessionStorage.setItem("diagnosisResponses", JSON.stringify(tempResponses));

        if (text === "[인식 실패]") {
          console.warn("⚠️ 인식 실패 - 다음 질문으로 넘어갑니다");
          socket.send(JSON.stringify({ type: "skip" }));
          return;
        }
        console.log("📝 STT 결과:", text);
        if (socket.readyState === WebSocket.OPEN) {
          console.log("📡 WebSocket 상태 확인됨: OPEN → 응답 전송");
          socket.send(JSON.stringify({ type: "response", text, currentIndex: currentQuestionIndex }));
        } else {
          console.warn("⚠️ WebSocket이 열려있지 않음 → 응답 전송 실패");
        }
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

  window.skipQuestion = () => socket.send(JSON.stringify({ type: "skip" }));
  window.restartDiagnosis = () => socket.send(JSON.stringify({ type: "restart" }));
});