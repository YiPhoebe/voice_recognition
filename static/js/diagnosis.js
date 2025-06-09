document.addEventListener("DOMContentLoaded", () => {

  let endSignalReceived = false;

  let retryCount = 0;

  let isQuestionInProgress = false;
  let alreadyScored = false;

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

  // 진단 시작될 때 체크박스 다시 보이도록 (show checkboxes again)
  checkboxEls.forEach(cb => {
    cb.classList.remove("locked");
    cb.style.display = "inline-block";
    cb.checked = false;
  });

  let sttText = "";
  let responses = {};

  function handleSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log("📥 서버 응답 도착:", data);

    if (data.type === "init") {
      questions = data.questions;
    } else if (data.type === "question") {
      const qIndex = data.index ?? currentQuestionIndex;
      currentQuestionIndex = qIndex;

      if (isQuestionInProgress) {
        console.warn("🚧 질문 진행 중인데 새 질문 도착 → 무시 (index는 갱신됨)");
        return;
      }

      isQuestionInProgress = true;
      showQuestion(data.text, false, qIndex + 1);
    } else if (data.type === "response") {
      console.log("✅ handleResponse 호출 준비됨!");
      const actualText = typeof data.text === "object" && data.text.text ? data.text.text : data.text;
      handleResponse(actualText);
    } else if (data.type === "end") {
      console.log("🎉 서버에서 모든 질문 완료 신호 받음");
      // Show result button immediately on end signal
      const resultButton = document.getElementById("result-button");
      if (resultButton) {
        resultButton.classList.remove("hidden");
        resultButton.classList.add("fade-text-fixed");
        resultButton.style.opacity = "1";

        resultButton.addEventListener("click", () => {
          try {
            const currentRecords = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
            const totalScore = currentRecords.reduce((acc, item) => acc + item.score, 0);
            sessionStorage.setItem("totalScore", totalScore);
            console.log("✅ 진단 완료 시 최종 점수 저장됨:", totalScore);
          } catch (err) {
            console.error("🔥 최종 점수 저장 중 오류 발생:", err);
          }
          setTimeout(() => {
            location.assign("/result");
          }, 100);
        });
      }
      endSignalReceived = true;
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
    if (currentQuestionIndex === 0) {
      console.log("🧼 첫 질문 시작 - 점수 초기화");
      sessionStorage.setItem("scoreRecords", JSON.stringify([]));
      sessionStorage.setItem("totalScore", "0");
    }
    if (typeof text !== "string" && typeof text?.text === "string") text = text.text;
    isQuestionInProgress = true;
    alreadyScored = false;
    console.log("🔄 alreadyScored 초기화됨");
    // 사용자 이름 치환
    const username = sessionStorage.getItem("username") || "사용자";
    const personalizedText = text.replace("{name}", username);
    const numberToUse = questionNumber ?? currentQuestionIndex + 1;
    const nativeNumber = convertToKoreanNumber(numberToUse);
    const ttsText = `문제 ${nativeNumber}번. ${personalizedText}`;
    questionEl.textContent = `문제 ${numberToUse}. ${personalizedText}`;

    // Clear previous answer UI before starting TTS
    checkboxEls.forEach(cb => {
      cb.classList.remove("locked");
      cb.style.outline = "none";
      cb.checked = false;
    });
    sttText = "";

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
    // Update progress bar
    const totalQuestions = questions.length || 20; // Fallback if questions not initialized
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressBar.style.width = `${progress}%`;
    if (increment && !alreadyScored) {
      // index 증가는 응답 처리 후 하도록 보류
    }
  }

  function handleScoring(score) {
    if (alreadyScored) {
      console.warn("⚠️ 점수 중복 처리 방지됨");
      return;
    }

    alreadyScored = true;
    console.log("🧩 handleScoring() 들어옴:", score);

    const questionObj = questions[currentQuestionIndex] || {};
    const questionId = questionObj.id ?? currentQuestionIndex;
    console.log("📊 질문", questionId, "번 점수:", score);
    responses[questionId] = { question: questionId, score: score };
    // sessionStorage에 scoreRecords 업데이트
    let existing = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
    existing.push({ question: questionId, score: score });
    sessionStorage.setItem("scoreRecords", JSON.stringify(existing));

    // 총합
    const totalScore = Object.values(responses).reduce((acc, val) => acc + val.score, 0);
    console.log("🎯 총합 점수:", totalScore);
  }

  function handleResponse(text) {
    const expectedIndex = Number(sessionStorage.getItem("expectedQuestionIndex") || currentQuestionIndex);
    if (expectedIndex !== currentQuestionIndex) {
      console.warn("❌ 현재 질문 번호가 바뀜 → retry 중단");
      return;
    }
    window.requestAnimationFrame(() => {
      responseEl.textContent = text;
      responseEl.style.opacity = 1;
    });

    const scoreMap = {
      1: ["전혀 그렇지 않다", "전혀 그렇지 않다.", "전혀 그렇진 않다", "전혀 그렇진 않다.",
        "그렇지 않다", "그렇지 않다.", "전혀", "않다", "1번", "일번", "1", "일", "아니요", "노"],
      2: ["약간 그렇다", "2번", "이번", "2", "이","약간", "조금", "그런 편", "그렇다"],
      3: ["꽤 그렇다", "꽤", "3번", "삼번", "3", "삼", "보통", "중간"],
      4: ["아주 많이 그렇다","아주", "많이", "4번", "사번", "4", "사", "매우", "완전 그렇다"]
    };

    const normalized = text.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/\s+/g, " ");
    const cleanedNormalized = normalized.replace(/[.,!?]/g, "").trim();
    sessionStorage.setItem("latestNormalized", normalized);
    console.log("🧪 normalized (length " + cleanedNormalized.length + "):", JSON.stringify(cleanedNormalized));
    console.log(`🔢 현재 질문 번호: ${currentQuestionIndex} (표시: ${currentQuestionIndex + 1}번)`);

    // 🔎 DEBUG: Compare each keyword to cleanedNormalized text in detail
    for (const [score, keywords] of Object.entries(scoreMap)) {
      for (const k of keywords) {
        const nk = k.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/\s+/g, " ");
        if (nk === cleanedNormalized) {
          console.log(`✅ 매칭됨! [score ${score}]: "${nk}" === "${cleanedNormalized}"`);
        }
      }
    }

    let matchScore = null;

    for (const [score, keywords] of Object.entries(scoreMap)) {
      for (const keyword of keywords) {
        const normKeyword = keyword.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/\s+/g, " ");
        const normInput = cleanedNormalized;

        if (normKeyword === cleanedNormalized) {
          matchScore = parseInt(score);
          break;
        }
      }
      if (matchScore !== null) break;
    }

    if (matchScore !== null) {
      console.log(`✅ 응답 "${normalized}" → 점수 ${matchScore} 매칭 완료`);
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
      responseEl.textContent = `😕 매칭 실패: "${normalized}"`;
      responseEl.style.color = "gray";
      console.warn("❌ 일치하는 응답 없음:", normalized);
    }
    console.log("📌 matchScore 최종값:", matchScore);
    if (matchScore !== null) {
      handleScoring(matchScore);
      isQuestionInProgress = false;
      retryCount = 0;  // 성공 시 재시도 카운터 초기화
      // currentQuestionIndex 증가는 서버에서 관리
    } else {
      console.warn("❌ 점수 매칭 실패 → 재시도 진행 중");
      responseEl.textContent = "😕 인식되지 않았습니다. 다시 한 번 말씀해주세요.";
      responseEl.style.color = "gray";
      retryCount++;
      if (retryCount < 3) {
        console.warn(`🔁 ${retryCount}회차 재시도`);
        replayAudio();
      } else {
        console.warn("⚠️ 3회 실패 → 다음 질문으로 넘어감");
        retryCount = 0;
        isQuestionInProgress = false;
        alreadyScored = true; // ⛔ prevent repeat skip
        socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));
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
    currentAudio.onended = () => { 
      startRecording(); 
      if (endSignalReceived) {
        console.log("🏁 오디오 재생 완료 → end 처리 시작");

        const resultButton = document.getElementById("result-button");
        if (resultButton) {
          resultButton.classList.remove("hidden");
          resultButton.classList.add("fade-text-fixed");
          resultButton.style.opacity = "1";

          resultButton.addEventListener("click", () => {
            try {
              const currentRecords = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
              const totalScore = currentRecords.reduce((acc, item) => acc + item.score, 0);
              sessionStorage.setItem("totalScore", totalScore);
              console.log("✅ 진단 완료 시 최종 점수 저장됨:", totalScore);
            } catch (err) {
              console.error("🔥 최종 점수 저장 중 오류 발생:", err);
            }
            setTimeout(() => {
              location.assign("/result");
            }, 100);
          });
        }

        endSignalReceived = false; // 한번만 실행되도록 초기화
      }
    };
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
        const raw = data.raw || null; // 🔍 원본 출력용
        console.log("📝 STT 원본 응답(raw):", raw);   // 🔥 추가 로그
        console.log("📥 STT 응답 수신 완료");
        const text = data.text || "(응답 없음)";
        
        // 📝 응답을 sessionStorage에 임시 저장
        let tempResponses = JSON.parse(sessionStorage.getItem("diagnosisResponses") || "[]");
        tempResponses.push({ questionIndex: currentQuestionIndex, response: text });
        sessionStorage.setItem("diagnosisResponses", JSON.stringify(tempResponses));

        let cleanText = typeof text === "string" ? text.trim() : (text.text || "").trim();
        if (cleanText === "[인식 실패]") {
          console.warn("⚠️ 인식 실패 처리 - 점수 매칭 시도");
        }
        sessionStorage.setItem("expectedQuestionIndex", currentQuestionIndex);
        handleResponse(cleanText);
        console.log("📝 STT 결과:", text);
        if (socket.readyState === WebSocket.OPEN && alreadyScored) {
          console.log("📡 WebSocket 상태 확인됨: OPEN → 응답 전송 (유효 응답만 전송)");
          const finalText = typeof text === "object" && text.text ? text.text : text;
          socket.send(JSON.stringify({ type: "response", text: finalText, currentIndex: currentQuestionIndex }));
        } else {
          console.warn("⚠️ 응답 조건 불충족 → 서버 전송 생략");
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
    if (questions.length === 0) {
      console.warn("❌ 질문 리스트가 아직 초기화되지 않았습니다.");
      return;
    }

    const expectedIndex = currentQuestionIndex;
    const q = questions[expectedIndex];
    if (q && typeof q.text === "string") {
      showQuestion(q.text, false, expectedIndex + 1);
      console.log("🔁 오디오 다시 재생 (현재 질문 기준)");
    } else {
      console.warn("❌ 다시 재생할 질문을 찾을 수 없음");
    }
  };

  window.skipQuestion = () => {
    console.log("⏩ 사용자 건너뛰기 요청");

    // 1. 오디오 멈춤
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      console.log("⏹️ 오디오 강제 중단됨 (skip)");
    }

    // 2. 질문 상태 초기화
    isQuestionInProgress = false;
    alreadyScored = false;
    retryCount = 0;

    // 3. 서버에 skip 요청
    socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));

    // 4. 다음 질문 인덱스 강제 증가
    currentQuestionIndex++;
  };

  // 진단 재시작: 기록 초기화, 체크박스 초기화, 서버에 restart 신호
  window.restartDiagnosis = () => {
    console.log("♻️ 다시 시작 버튼 클릭됨");
    sessionStorage.removeItem("scoreRecords");
    sessionStorage.removeItem("totalScore");
    sessionStorage.setItem("scoreRecords", JSON.stringify([]));
    sessionStorage.setItem("totalScore", "0");
    sessionStorage.removeItem("diagnosisResponses");
    sessionStorage.removeItem("latestNormalized");
    currentQuestionIndex = 0;
    // Reset global questions list
    questions = [];
    // Clear question and response UI
    questionEl.textContent = "";
    responseEl.textContent = "";
    checkboxEls.forEach(cb => {
      cb.checked = false;
      cb.classList.remove("locked");
      cb.style.display = "inline-block";
    });
    socket.send(JSON.stringify({ type: "restart" }));
  };
});