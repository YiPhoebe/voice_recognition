// --- Global user info variables ---
let userEmail = "";
let userGender = "";
let userBirth = "";
let isDiagnosisEnded = false;
let isRetryingDueToEmptySTT = false;

document.addEventListener("DOMContentLoaded", () => {
  // --- PATCH: Capture user input into sessionStorage immediately ---
  const emailEl = document.getElementById("email");
  const genderEl = document.getElementById("gender");
  const birthEl = document.getElementById("birth");

  if (emailEl && genderEl && birthEl) {
    emailEl.addEventListener("input", () => {
      sessionStorage.setItem("email", emailEl.value.trim());
    });
    genderEl.addEventListener("input", () => {
      sessionStorage.setItem("gender", genderEl.value.trim());
    });
    birthEl.addEventListener("input", () => {
      sessionStorage.setItem("birth", birthEl.value.trim());
    });
  }
  // 진단 시작 함수 예시 (이름이 다를 수 있으니 startDiagnosis로 가정)
  // 실제로는 이 함수를 기존에 이미 구현한 곳에 아래 코드를 추가해야 함.
  // 아래는 예시로 window.startDiagnosis가 있다고 가정
  if (typeof window.startDiagnosis === "function") {
    const origStartDiagnosis = window.startDiagnosis;
    window.startDiagnosis = function(...args) {
      userEmail = document.getElementById("email").value.trim();
      userGender = document.getElementById("gender").value.trim();
      userBirth = document.getElementById("birth").value.trim();
      // Store user info in sessionStorage
      sessionStorage.setItem("email", userEmail);
      sessionStorage.setItem("gender", userGender);
      sessionStorage.setItem("birth", userBirth);
      console.log("📩 진단 시작 시 사용자 정보:", userEmail, userGender, userBirth);
      return origStartDiagnosis.apply(this, args);
    };
  }

  // Global variables for countdown pause/resume
  let countdownInterval = null;
  let countdownRemainingTime = 0;

  // ✅ STT용 WebSocket 연결 추가
  const websocketPath = CONFIG.ENVIRONMENT === "academy" ? "/ws/adhd" : "/ws/general";
  const sttSocket = new WebSocket(`wss://${CONFIG.STT_HOST}${websocketPath}`);

  sttSocket.onopen = () => {
    console.log("🧠 STT WebSocket 연결 성공");
  };

  sttSocket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.warn("⚠️ JSON이 아님 → 일반 텍스트로 처리:", event.data);
      data = event.data;
    }

    const text = typeof data === "string" ? data : data.text || "";
    console.log("🗣️ 받은 STT 결과:", text);

    // STT 텍스트 처리: 자동 응답 적용
    sessionStorage.setItem("expectedQuestionIndex", currentQuestionIndex);
    handleResponse(text);
    if (socket.readyState === WebSocket.OPEN && alreadyScored) {
      socket.send(JSON.stringify({ type: "response", text, currentIndex: currentQuestionIndex }));
    }
  };

  sttSocket.onerror = (e) => {
    console.error("❌ STT WebSocket 오류:", e);
  };

  // 녹음 일시정지 상태 변수
  let isPaused = false;

  // 🆕 보류된 질문 저장용 변수
  let pendingQuestion = null;

  let endSignalReceived = false;

  let retryCount = 0;

  let isQuestionInProgress = false;
  let alreadyScored = false;

  const questionEl = document.getElementById("question");
  const questionNumberEl = document.getElementById("question-number");
  // responseEl will be dynamically resolved via waitForResponseEl
  // Utility function to wait for the response element to appear
  function waitForResponseEl(callback, retries = 10) {
    const el = document.getElementById("countdownText");
    if (el) {
      callback(el);
    } else if (retries > 0) {
      setTimeout(() => waitForResponseEl(callback, retries - 1), 100);
    } else {
      console.warn("❌ responseEl 끝내 못 찾음");
      callback(null);
    }
  }
  const countdownWrapper = document.getElementById("countdown-wrapper");

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
    cb.style.pointerEvents = "none";
    cb.style.opacity = "1";  // optional: ensure visual style is unaffected
  });

  // 진단 시작될 때 체크박스 다시 보이도록 (show checkboxes again)
  checkboxEls.forEach(cb => {
    cb.classList.remove("locked");
    cb.style.display = "inline-block";
    cb.checked = false;
  });

  let sttText = "";
  let responses = {};
  let mediaRecorder = null;
  // --- Recording timeout state ---
  let recordingTimeout = null;
  let recordingStartTime = null;
  let remainingRecordingTime = 4000; // milliseconds

  function handleSocketMessage(event) {
    const data = JSON.parse(event.data);
    console.log("📥 서버 응답 도착:", data);

    if (data.type === "init") {
      questions = data.questions;
    } else if (data.type === "question") {
      const qIndex = data.index ?? currentQuestionIndex;
      currentQuestionIndex = qIndex;

      if (isQuestionInProgress) {
        console.warn("🚧 질문 진행 중인데 새 질문 도착 → 보류");
        pendingQuestion = data;
        return;
      }

      showQuestion(data.text, false, qIndex + 1);
    } else if (data.type === "response") {
      console.log("✅ handleResponse 호출 준비됨!");
      const actualText = typeof data.text === "object" && data.text.text ? data.text.text : data.text;
      handleResponse(actualText);
    } else if (data.type === "end") {
      isDiagnosisEnded = true;
      // --- 서버에서 모든 질문 완료 신호 받음 ---
      console.log("🎉 서버에서 모든 질문 완료 신호 받음");
      // 사용자 정보 확인 로그
      const userId = sessionStorage.getItem("user_id") || "unknown";
      const name = sessionStorage.getItem("username") || "사용자";
      const email = sessionStorage.getItem("email") || "";
      const gender = sessionStorage.getItem("gender") || "";
      const birth = sessionStorage.getItem("birth") || "";
      console.log("📥 사용자 정보 확인:", userId, name, email, gender, birth);
      // --- CSV 저장 자동 수행 ---
      if (typeof sendResultToServer === "function") {
        sendResultToServer(); // ✅ end 신호 수신 시 자동 저장 보장
      }
      // (자동 저장 트리거 제거됨)
      // Show result button immediately on end signal
      const resultButton = document.getElementById("result-button");
      if (resultButton) {
        resultButton.classList.remove("hidden");
        resultButton.classList.add("fade-text-fixed");
        const textSpan = document.querySelector(".response-inline-text");
        if (textSpan) {
          textSpan.style.opacity = 1;
          textSpan.style.color = "black";
        }

        resultButton.addEventListener("click", () => {
          try {
            const scoreRecords = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
            const totalScore = scoreRecords.reduce((acc, item) => acc + item.score, 0);
            const userId = sessionStorage.getItem("user_id") || "unknown";
            const userName = sessionStorage.getItem("username") || "사용자";
            // 추가: 사용자 이메일/성별/생년 정보 가져오기
            const userEmail = sessionStorage.getItem("email") || "";
            const userGender = sessionStorage.getItem("gender") || "";
            const userBirth = sessionStorage.getItem("birth") || "";
            // ✅ 점수와 사용자 정보 저장
            console.log("🧪 userId:", userId);
            console.log("🧪 userName:", userName);
            console.log("🧪 userEmail:", userEmail);
            console.log("🧪 userGender:", userGender);
            console.log("🧪 userBirth:", userBirth);
            console.log("🧪 scoreRecords:", scoreRecords);
            // --- PATCH: Get final email input value and send with result ---
            const finalEmailInput = document.getElementById("final-email");
            const finalEmail = finalEmailInput ? finalEmailInput.value : "";
            fetch("/save_result", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: userId,
                name: userName,
                email: userEmail,
                gender: userGender,
                birth: userBirth,
                scores: scoreRecords,
                final_email: finalEmail
              }),
            })
            .then(() => {
              sessionStorage.setItem("totalScore", totalScore);
              location.assign("/result");
            })
            .catch(err => {
              console.error("❌ save_result 전송 실패", err);
              location.assign("/result");
            });
            console.log("✅ 진단 완료 시 최종 점수 저장됨:", totalScore);
          } catch (err) {
            console.error("🔥 최종 점수 저장 중 오류 발생:", err);
            // 실패시에도 결과 페이지로 이동
            location.assign("/result");
          }
        });
      }
      endSignalReceived = true;
    }
  }

  // 환경 기반 WebSocket URL 생성 로직
  let websocketUrl;
  if (CONFIG.ENVIRONMENT === "academy") {
    websocketUrl = `wss://${window.location.hostname}:${window.location.port}/ws/adhd`;
  } else if (CONFIG.ENVIRONMENT === "aws") {
    websocketUrl = `wss://${CONFIG.STT_HOST}/ws/general`;
  } else {
    console.error("❌ 알 수 없는 환경: WebSocket 연결 실패");
  }

  const socket = new WebSocket(websocketUrl);
  socket.onmessage = handleSocketMessage;

  let currentQuestionIndex = 0;
  let questions = [];

  // ✅ 페이지 진입 시 자동으로 첫 질문 시작 (WebSocket 연결 및 질문 리스트 초기화 이후)
  const tryAutoStart = () => {
    if (questions && questions.length > 0) {
      console.log("🚀 자동 질문 시작 시도");
      showQuestion(questions[0].text, false, 1);
    } else {
      console.warn("❌ 질문 리스트가 아직 없음. 재시도 예약");
      setTimeout(tryAutoStart, 300);
    }
  };
  setTimeout(tryAutoStart, 500);


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
    if (window.isAudioPlaying) {
      console.warn("⛔ 현재 오디오가 아직 재생 중입니다. 중복 재생 방지됨.");
      return;
    }
    window.isAudioPlaying = true;
    if (currentQuestionIndex === 0) {
      console.log("🧼 첫 질문 시작 - 점수 초기화");
      sessionStorage.setItem("scoreRecords", JSON.stringify([]));
      sessionStorage.setItem("totalScore", "0");
    }
    if (typeof text !== "string" && typeof text?.text === "string") text = text.text;
    isQuestionInProgress = true;
    alreadyScored = false;
    sessionStorage.setItem("expectedQuestionIndex", currentQuestionIndex);
    console.log("🔄 alreadyScored 초기화됨");
    // 사용자 이름 치환 (fallback: "사용자님" -> "{username}님"도 지원)
    const username = sessionStorage.getItem("username") || "사용자";
    let personalizedText = text.replace("{name}", username);
    if (!text.includes("{name}")) {
      personalizedText = text.replace("사용자님", `${username}님`);
    }
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
    const backendUrl = CONFIG.TTS_ENDPOINT;
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
        ttsReadyUrl = url;
        console.log("🎯 오디오 URL 저장됨 (사용자 탭 시 재생 예정):", ttsReadyUrl);
        playAudio(url);
      })
      .catch(err => {
        console.error("🔴 TTS fetch 오류:", err);
      });
    window.requestAnimationFrame(() => {
      const wrapper = document.getElementById("countdown-wrapper");
      if (wrapper) {
        const countdownTextDiv = document.createElement("div");
        countdownTextDiv.id = "countdownText";
        countdownTextDiv.className = "response-inline-wrapper";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "circle-timer";
        svg.setAttribute("class", "inline-timer");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        svg.setAttribute("viewBox", "0 0 40 40");

        // Add background circle before progress ring
        const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bgCircle.setAttribute("cx", "20");
        bgCircle.setAttribute("cy", "20");
        bgCircle.setAttribute("r", "16");
        bgCircle.setAttribute("stroke", "#eee");
        bgCircle.setAttribute("stroke-width", "2");
        bgCircle.setAttribute("fill", "none");
        svg.appendChild(bgCircle);

        const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle2.id = "progress-ring";
        circle2.setAttribute("cx", "20");
        circle2.setAttribute("cy", "20");
        circle2.setAttribute("r", "16");
        circle2.setAttribute("stroke", "gray");
        circle2.setAttribute("stroke-width", "2");
        circle2.setAttribute("fill", "none");
        // Rotate so progress starts from 12 o'clock
        circle2.setAttribute("transform", "rotate(-90 20 20)");

        svg.appendChild(circle2);

        const span = document.createElement("span");
        span.className = "response-inline-text";
        span.textContent = "응답을 기다리는 중...";
        span.style.opacity = 1;
        span.style.color = "black";

        countdownTextDiv.appendChild(svg);
        countdownTextDiv.appendChild(span);

        wrapper.innerHTML = "";
        wrapper.appendChild(countdownTextDiv);
      } else {
        console.warn("⚠️ countdown-wrapper가 존재하지 않음 → DOM 생성 생략");
      }
    });
    // Update progress bar
    const totalQuestions = questions.length || 20; // Fallback if questions not initialized
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    progressBar.style.width = `${progress}%`;
    if (increment && !alreadyScored) {
      // index 증가는 응답 처리 후 하도록 보류
    }
  }
  window.showQuestion = showQuestion;

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
    existing.push({ question: questionId.toString(), score: score });
    sessionStorage.setItem("scoreRecords", JSON.stringify(existing));

    // 총합
    const totalScore = Object.values(responses).reduce((acc, val) => acc + val.score, 0);
    console.log("🎯 총합 점수:", totalScore);
  }

  function handleResponse(text) {
    if (isDiagnosisEnded) return;
    waitForResponseEl(function(responseEl) {
      let matchScore = null;
      const expectedIndex = Number(sessionStorage.getItem("expectedQuestionIndex") || currentQuestionIndex);
      if (expectedIndex !== currentQuestionIndex) {
        console.warn("❌ 현재 질문 번호가 바뀜 → retry 중단");
        return;
      }
      isQuestionInProgress = true;

      window.requestAnimationFrame(() => {
        if (responseEl) {
          responseEl.style.transition = "opacity 0.5s ease-in-out";
          responseEl.style.opacity = 0;
        } else {
          console.warn("❌ responseEl is null at style transition phase");
        }

        setTimeout(() => {
          if (responseEl) {
            responseEl.textContent = text;
            responseEl.style.opacity = 1;
          } else {
            console.warn("❌ responseEl is null at text update phase");
          }

          setTimeout(() => {
            isQuestionInProgress = false;
            if (matchScore !== null) {
              // 🆕 보류된 질문 있으면 처리 (진단 종료 상태가 아닐 때만)
              if (pendingQuestion && !isDiagnosisEnded) {
                if (pendingQuestion.index <= currentQuestionIndex) {
                  console.warn("⚠️ pendingQuestion이 이미 지난 질문 → 무시됨:", pendingQuestion.index);
                  pendingQuestion = null;
                } else {
                  const data = pendingQuestion;
                  pendingQuestion = null;
                  console.log("🔁 보류된 질문 다시 처리:", data);
                  showQuestion(data.text, false, data.index + 1);
                }
              }
              if (socket.readyState === WebSocket.OPEN && !endSignalReceived) {
                socket.send(JSON.stringify({ type: "ready", currentIndex: currentQuestionIndex }));
              }
            }
          }, 1000);  // wait for display to complete
        }, 500);
      });

      const scoreMap = {
        1: ["전혀 그렇지 않다", "전혀 그렇지 않다.", "전혀 그렇진 않다", "전혀 그렇진 않다.",
          "그렇지 않다", "그렇지 않다.", "전혀", "않다", "1번", "일번", "1", "일", "아니요", "노"],
        2: ["약간 그렇다", "2번", "이번", "2", "약간", "조금", "그런 편", "그렇다"],
        3: ["꽤 그렇다", "꽤", "3번", "삼번", "3", "삼", "보통", "중간"],
        4: ["아주 많이 그렇다","아주", "많이", "4번", "사번", "4", "사", "매우", "완전 그렇다"]
      };

      const normalized = text.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/\s+/g, " ");
      const cleanedNormalized = normalized.replace(/[.,!?]/g, "").trim();
      sessionStorage.setItem("latestNormalized", normalized);
      console.log("🧪 normalized (length " + cleanedNormalized.length + "):", JSON.stringify(cleanedNormalized));
      console.log(`🔢 현재 질문 번호: ${currentQuestionIndex} (표시: ${currentQuestionIndex + 1}번)`);

      // --- PATCH: Handle empty STT responses ---
      if (cleanedNormalized === "") {
        console.warn("⚠️ STT 결과가 완전히 비어 있음 → 재시도 수행");

        if (!isRetryingDueToEmptySTT && retryCount > 0) {
          console.warn("🚫 resume 흐름 중이라 재시도 생략");
          return;
        }

        retryCount++;
        if (retryCount < 3) {
          replayAudio();  // 현재 질문 재진행
        } else {
          retryCount = 0;
          alreadyScored = true;
          socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));
          currentQuestionIndex++;
          isQuestionInProgress = false;
        }
        return;
      }

      // --- 추가: 이상한 응답 필터링 ---
      const wordCount = cleanedNormalized.split(" ").length;
      const tooLong = cleanedNormalized.length > 100;
      const suspiciousWords = ["세골", "인천", "한옥", "시골", "오늘은", "자막"];
      const containsGarbage = suspiciousWords.some(w => cleanedNormalized.includes(w));
      // 🆕 반복된 한 단어가 계속되는 경우 무효 처리
      const words = cleanedNormalized.split(" ");
      const uniqueWords = new Set(words.filter(w => w.length > 0));
      const repetitive = uniqueWords.size <= 2 && words.length >= 20;

      if ((wordCount > 15 || tooLong) && (containsGarbage || repetitive)) {
        console.warn("❌ 너무 긴 이상한 응답 감지 → 무효 처리");
        matchScore = null;
        if (responseEl) {
          if (retryCount === 1) {
            responseEl.textContent = "다시 한번 귀 기울여 듣는 중...";
          } else if (retryCount === 2) {
            responseEl.textContent = "마지막으로 귀 기울여 듣는 중...";
          }
          responseEl.style.color = "gray";
        } else {
          console.warn("❌ responseEl is null at garbage filter phase");
        }
      }
      // --- 끝 ---

      // 🔎 DEBUG: Compare each keyword to cleanedNormalized text in detail
      for (const [score, keywords] of Object.entries(scoreMap)) {
        for (const k of keywords) {
          const nk = k.trim().toLowerCase().replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/\s+/g, " ");
          if (nk === cleanedNormalized) {
            console.log(`✅ 매칭됨! [score ${score}]: "${nk}" === "${cleanedNormalized}"`);
          }
        }
      }

      // 1차: 정확히 일치하는 경우
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

      // 2차: "포함" 기준 부분 매칭 (정확 일치 없을 때) - 개선된 단어 기준 매칭
      if (matchScore === null) {
        const normalizedWords = cleanedNormalized.split(" ");
        const strictOnly = ["일", "이", "삼", "사"];  // 너무 짧은 단어는 포함매칭 제외
        for (const [score, keywords] of Object.entries(scoreMap)) {
          // --- PATCH: ignore whitespace when checking inclusion ---
          const matched = scoreMap[score].some(keyword => {
            const cleanKeyword = keyword.replace(/\s/g, '');
            const cleanResponse = cleanedNormalized.replace(/\s/g, '');
            return cleanResponse.includes(cleanKeyword);
          });
          if (matched) {
            matchScore = parseInt(score);
            console.log(`🧠 공백 무시 포함 매칭 성공! [score ${score}]`);
            break;
          }
        }
      }

      if (matchScore !== null) {
        console.log(`✅ 응답 "${normalized}" → 점수 ${matchScore} 매칭 완료`);
        const idx = matchScore - 1;
        if (checkboxEls[idx]) {
          checkboxEls[idx].checked = true;
          checkboxEls[idx].classList.add("locked");
          checkboxEls[idx].classList.add("highlighted");
          console.log("✅ 체크박스", idx + 1, "강제 체크됨", checkboxEls[idx]);
        } else {
          console.warn("❌ 체크박스 null!", idx, matchScore);
        }
      } else {
        if (responseEl) {
          responseEl.textContent = `😕 매칭 실패: "${normalized}"`;
          responseEl.style.color = "gray";
        } else {
          console.warn("❌ responseEl is null at match fail phase");
        }
        console.warn("❌ 일치하는 응답 없음:", normalized);
      }
      console.log("📌 matchScore 최종값:", matchScore);
      // --- PATCH START: Enforce scoring done before next question, handle retry and result display ---
      if (matchScore !== null) {
        handleScoring(matchScore);
        retryCount = 0;
        alreadyScored = true;

        currentQuestionIndex++;
        // ✅ 모든 질문이 끝났는지 확인 후 처리
        if (currentQuestionIndex >= questions.length) {
          // 사용자 정보 sessionStorage에서 가져오기
          const userId = sessionStorage.getItem("user_id") || "unknown";
          const name = sessionStorage.getItem("username") || "사용자";
          const email = sessionStorage.getItem("email") || "";
          const gender = sessionStorage.getItem("gender") || "";
          const birth = sessionStorage.getItem("birth") || "";
          console.log("✅ 모든 질문 응답 완료! 자동 저장 시작");
          console.log("📥 사용자 정보 확인:", userId, name, email, gender, birth);
          if (typeof sendResultToServer === "function") {
            sendResultToServer();
          }
          return;
        }

        // 질문 20번까지 끝났으면 결과 버튼 보여주기 (안전장치)
        if (currentQuestionIndex + 1 === 21) {
          const resultButton = document.getElementById("result-button");
          if (resultButton) {
            resultButton.classList.remove("hidden");
            resultButton.classList.add("fade-text-fixed");
            resultButton.style.opacity = "1";
          }
          // no return here
        }

        // 다음 질문 요청
        if (socket.readyState === WebSocket.OPEN && !endSignalReceived) {
          socket.send(JSON.stringify({ type: "question", currentIndex: currentQuestionIndex }));
          console.log("📤 다음 질문 요청 보냄:", currentQuestionIndex);
        } else {
          console.warn("⚠️ WebSocket 닫힘 or endSignalReceived=true → 질문 전송 생략됨");
        }
      } else {
        // retry 로직은 sendAudioToSTT 내부에서 처리하므로 여기선 생략
      }
      // --- PATCH: 추가, 매칭 실패 시 재시도/skip 로직 ---
      if (matchScore === null) {
        retryCount++;
        if (retryCount < 3) {
          console.warn("🔁 매칭 실패 → 질문 다시 재생 시도 (retryCount=" + retryCount + ")");
          replayAudio();
        } else {
          console.warn("⛔ 매칭 실패 재시도 초과 → 질문 skip");
          retryCount = 0;
          alreadyScored = true;
          socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));
          currentQuestionIndex++;
          isQuestionInProgress = false;
        }
      }
      // --- PATCH END ---
    });
  }

  // 오디오 제어 함수들 - 클라이언트에서 직접 오디오 제어
  window.isAudioPlaying = false;
  let currentAudio = null;
  let ttsReadyUrl = null;

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
      window.isAudioPlaying = false;
      startCountdown(4);
      startRecording(); 
      if (endSignalReceived) {
        console.log("🏁 오디오 재생 완료 → end 처리 시작");
        const resultButton = document.getElementById("result-button");
        if (resultButton) {
          resultButton.classList.remove("hidden");
          resultButton.classList.add("fade-text-fixed");
          resultButton.style.opacity = "1";
        }
        endSignalReceived = false; // 한번만 실행되도록 초기화
      }
    };
    currentAudio.play()
      .then(() => {
        console.log("▶️ 오디오 재생 시작:", url);
      })
      .catch((err) => {
        window.isAudioPlaying = false;
        console.warn("⛔ 오디오 자동 재생 차단됨. 사용자 상호작용 필요:", err);
      });
  };

  // 음성 녹음 및 STT 전송 함수들
  function startRecording() {
    if (isDiagnosisEnded) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (!isPaused) {
          console.log("🛑 녹음 종료됨");
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log("📦 녹음된 Blob 생성 완료:", audioBlob);
          // STT WebSocket이 연결되어 있다면 binary 전송
          if (sttSocket && sttSocket.readyState === WebSocket.OPEN) {
            sttSocket.send(audioBlob);
            console.log("📡 STT WebSocket으로 음성 전송됨");
          } else {
            console.warn("❗ STT WebSocket 연결되지 않아 /stt로 fallback");
            sendAudioToSTT(audioBlob);
          }
        } else {
          console.log("⏸️ 일시정지 상태에서 onstop 발생 → STT 요청 생략");
        }
      };

      // --- Interval-based countdown logic ---
      recordingStartTime = Date.now();
      mediaRecorder.start();
      console.log("🎙️ 녹음 시작됨");

      recordingTimeout = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, remainingRecordingTime);
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

        // --- PATCH: Retry logic for "(응답 없음)" or "[인식 실패]" ---
        if (cleanText === "(응답 없음)" || cleanText === "[인식 실패]") {
          console.warn("⚠️ 응답 없음 → 재시도 로직 실행");

          console.log("🔄 STT 결과 없음 → responseEl 업데이트 시도 중");
          retryCount++;
          waitForResponseEl(function(responseEl) {
            if (responseEl) {
              responseEl.style.color = "gray";
            } else {
              console.warn("❌ responseEl is null in retry UI update block");
            }

            if (retryCount < 3) {
              replayAudio();  // ✅ 현재 질문 재시도
            } else {
              retryCount = 0;
              alreadyScored = true;
              socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));
              currentQuestionIndex++;
              isQuestionInProgress = false;
            }
          });

          return;
        }
        // --- END PATCH ---

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
        waitForResponseEl(function(responseEl) {
          if (responseEl) {
            responseEl.textContent = "음성 인식에 실패했어요. 다시 시도합니다...";
            responseEl.style.color = "gray";
          } else {
            console.warn("❌ responseEl is null during STT error fallback");
          }

          retryCount++;
          if (retryCount < 3) {
            replayAudio();
          } else {
            retryCount = 0;
            alreadyScored = true;
            socket.send(JSON.stringify({ type: "skip", currentIndex: currentQuestionIndex }));
            currentQuestionIndex++;
            isQuestionInProgress = false;
          }
        });
      });
  }

  window.pauseAudio = () => {
    if (currentAudio) currentAudio.pause();
    console.log("⏸️ 오디오 일시정지");
    // --- Allow pause during retry ---
    if (isRetryingDueToEmptySTT) {
      console.log("⏸️ 재시도 중에도 일시정지 허용됨");
    }
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.pause();
      isPaused = true;
      console.log("⏸️ 녹음 pause됨");
      // --- Pause countdown and update remaining time ---
      clearTimeout(recordingTimeout);
      const elapsed = Date.now() - recordingStartTime;
      remainingRecordingTime -= elapsed;
      console.log("⏸️ 녹음 일시정지됨 - 남은 시간:", remainingRecordingTime);
    }
    // Pause countdown timer
    if (countdownInterval) {
      clearInterval(countdownInterval);
      console.log("⏸️ 카운트다운 정지됨");
    }
  };
  window.resumeAudio = () => {
    let resumedRecording = false;

    if (currentAudio && currentAudio.currentTime < currentAudio.duration) {
      currentAudio.play();
      console.log("▶️ 오디오 이어 재생");
    } else {
      console.log("⏭️ 오디오는 이미 끝난 상태 → 재생 생략");
      startRecording();  // 🔁 오디오가 끝났다면 녹음은 재개해야 함
    }
    if (mediaRecorder && mediaRecorder.state === "paused") {
      mediaRecorder.resume();
      isPaused = false;
      resumedRecording = true;
      console.log("▶️ 녹음 resume됨");
      // --- Resume countdown with remaining time ---
      recordingStartTime = Date.now();
      if (recordingTimeout) clearTimeout(recordingTimeout);
      recordingTimeout = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, remainingRecordingTime);
      console.log("▶️ 녹음 재개됨 - 남은 시간:", remainingRecordingTime);
    }

    isRetryingDueToEmptySTT = resumedRecording ? true : false;
    // Resume countdown timer
    resumeCountdown();
  };
  // (startCountdown 함수는 아래에서 정의됨)
  window.replayAudio = () => {
    isRetryingDueToEmptySTT = true;
    if (questions.length === 0) {
      console.warn("❌ 질문 리스트가 아직 초기화되지 않았습니다.");
      return;
    }

    const expectedIndex = currentQuestionIndex;
    const q = questions[expectedIndex];
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      window.isAudioPlaying = false;
    }
    if (q && typeof q.text === "string") {
      showQuestion(q.text, false, expectedIndex + 1);
      console.log("🔁 오디오 다시 재생 (현재 질문 기준)");
    } else {
      console.warn("❌ 다시 재생할 질문을 찾을 수 없음");
    }
  };

  window.startCountdown = function(seconds = 4) {
    const ring = document.getElementById("progress-ring");
    const text = document.querySelector(".response-inline-text");

    if (text) {
      if (retryCount === 1) {
        text.textContent = "다시 한번 귀 기울여 듣는 중...";
      } else if (retryCount === 2) {
        text.textContent = "마지막으로 귀 기울여 듣는 중...";
      } else {
        text.textContent = "귀 기울여 듣는 중...";
      }
    }

    if (!ring) {
      console.warn("⛔ progress-ring가 없어서 countdown 중단됨");
      return;
    }

    const radius = 16;
    const totalLength = 2 * Math.PI * radius;
    ring.style.strokeDasharray = totalLength;
    ring.style.strokeDashoffset = 0;

    countdownRemainingTime = seconds;
    countdownRemainingTime--; // PATCH: Decrement immediately for faster ring start
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      const offset = totalLength * ((seconds - countdownRemainingTime + 1) / seconds);
      ring.style.strokeDashoffset = offset;

      if (countdownRemainingTime > 0) {
        countdownRemainingTime--;
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);
  };

  window.resumeCountdown = function() {
    const ring = document.getElementById("progress-ring");
    if (!ring || countdownRemainingTime <= 0) return;

    const radius = 16;
    const totalLength = 2 * Math.PI * radius;
    ring.style.strokeDasharray = totalLength;

    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      // 4 is the original countdown seconds. Adjust if variable.
      const offset = totalLength * ((4 - countdownRemainingTime + 1) / 4);
      ring.style.strokeDashoffset = offset;

      if (countdownRemainingTime > 0) {
        countdownRemainingTime--;
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);
  };

  window.skipQuestion = () => {
    console.log("⏩ 사용자 건너뛰기 요청");

    // 1. 오디오 멈춤
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      console.log("⏹️ 오디오 강제 중단됨 (skip)");
      window.isAudioPlaying = false;
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

  // 진단 재시작: 전체 리셋 (오디오, STT, UI, 진행상태)
  window.restartDiagnosis = function () {
    // Safely clear responseEl if exists
    const responseEl = document.getElementById("response-inline-text");
    if (responseEl) {
      responseEl.textContent = "";
    }

    // 현재 오디오 멈추기
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      window.isAudioPlaying = false;
    }

    // 녹음 멈추기
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }

    // 진행 상태 초기화
    currentQuestionIndex = -1;
    alreadyScored = [];
    retryCount = 0;

    // 체크박스 초기화
    const checkboxes = document.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(cb => cb.checked = false);

    // 결과 버튼 숨기기
    const resultBtn = document.getElementById("result-button");
    if (resultBtn) resultBtn.classList.add("hidden");

    // 질문 UI 갱신
    if (questions.length > 0) {
      showQuestion(questions[0].text, false, 1);
    } else {
      console.warn("❌ 질문 리스트가 초기화되지 않았습니다.");
    }

    console.log("🔄 진단이 처음부터 재시작되었습니다.");
  };
});
  // --- PATCH: sendResultToServer에서 자동 이동 제거 ---
  window.sendResultToServer = function() {
    const userId = sessionStorage.getItem("user_id") || "unknown";
    const userName = sessionStorage.getItem("username") || "사용자";
    const scores = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
    // Retrieve userEmail, userGender, userBirth from sessionStorage
    const userEmail = sessionStorage.getItem("email") || "";
    const finalEmail = sessionStorage.getItem("final_email") || "";
    const userGender = sessionStorage.getItem("gender") || "";
    const userBirth = sessionStorage.getItem("birth") || "";
    const data = {
      user_id: userId,
      name: userName,
      email: userEmail,
      gender: userGender,
      birth: userBirth,
      scores: scores,
      final_email: finalEmail
    };
    console.log("📤 서버로 결과 전송:", data);
    fetch("/save_result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    .then(() => {
      sessionStorage.setItem("totalScore", scores.reduce((acc, item) => acc + item.score, 0));
      console.log("✅ CSV 저장 완료 (이동은 버튼에서)");
    })
    .catch(err => {
      console.error("❌ save_result 전송 실패", err);
    });
  };