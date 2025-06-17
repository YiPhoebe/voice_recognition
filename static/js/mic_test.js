document.addEventListener("DOMContentLoaded", async () => {
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("✅ 마이크 권한 사전 승인 완료");
  } catch (err) {
    console.error("❌ 마이크 권한 요청 실패:", err);
    return;
  }

  console.log("✅ mic_test.js 로딩 시작됨");

  const icon = document.querySelector(".intro-icon");
  const group1Lines = document.querySelectorAll(".group-1");
  const micStatus = document.getElementById("mic-status");
  const waveformContainer = document.getElementById("waveform");
  const sttResult = document.getElementById("stt-result");
  const button = document.getElementById("start-btn");

  [icon, ...group1Lines, micStatus, waveformContainer, sttResult, button].forEach(el => {
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("fade-text-fixed");
    }
  });

  // button.style.opacity = "0";
  // button.style.transition = "opacity 1s";

  // const backendUrl = "http://192.168.3.19:10081/synthesize";
  const backendUrl = CONFIG.TTS_ENDPOINT;
  const wsHost = CONFIG.WS_HOST || '192.168.3.19:11181';
  const sttPath = CONFIG.STT_GENERAL_PATH || '/ws/general';
  const socket = new WebSocket(`wss://${wsHost}${sttPath}`);
  const ttsCache = new Map();

  async function preloadTTS(text) {
    if (!text) return;
    try {
      const formData = new URLSearchParams();
      formData.append("text", text);
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      ttsCache.set(text, audio);
    } catch (err) {
      console.error("❌ preloadTTS 실패:", text, err);
      ttsCache.set(text, new Audio());
    }
  }

  // Preload all group1Lines' TTS
  for (const line of group1Lines) {
    if (line.textContent) {
      await preloadTTS(line.textContent);
    }
  }

  // group-1: icon + 문장 2개
  // 텍스트 디졸브 먼저 실행
  icon.classList.remove("hidden");
  group1Lines.forEach(line => line.classList.remove("hidden"));
  icon.classList.add("fade-text-fixed");
  group1Lines.forEach(line => line.classList.add("fade-text-fixed"));

  // 그룹2 텍스트도 함께 보여줌
  const group2Lines = document.querySelectorAll(".group-2");
  group2Lines.forEach(line => {
    line.classList.remove("hidden");
    line.classList.add("fade-text-fixed");
  });

  // 2초 뒤 파형 등장은 텍스트 디졸브 직후에 실행
  setTimeout(() => {
    waveformContainer.classList.remove("hidden");
    waveformContainer.classList.add("fade-text-fixed");
  }, 2000);


  // WaveSurfer waveform player setup and audio playback
  waveformContainer.innerHTML = "";  // Clear previous

  // Web Audio API 기반 파형 시각화 함수
function visualizeWaveform(stream) {
  const canvas = document.getElementById('waveform');
  if (!canvas) return;

  const canvasCtx = canvas.getContext("2d");
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();

  analyser.fftSize = 64;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);

  function draw() {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      canvasCtx.fillStyle = '#3c3c3c';
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  }

  draw();
}

  // Waveform + TTS (병렬 실행)
  async function playTTSSequentially(lines) {
    console.log("🔊 TTS 시작");
    for (const line of lines) {
      const audio = ttsCache.get(line.textContent);
      if (!audio) continue;
      await new Promise(resolve => {
        audio.currentTime = 0;
        audio.addEventListener("ended", resolve, { once: true });
        audio.play().catch(err => {
          console.warn("❌ 오디오 재생 실패:", line.textContent, err);
          resolve();
        });
      });
    }
  }

  // Run TTS first, then waveform and recording
  (async () => {
    try {
      // let micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ 마이크 권한 승인됨");

      // Declare variables before use
      let recorder;
      let chunks = [];
      // 실패 횟수 추적용 변수 (startRecording 외부에 선언)
      let failCount = 0;

      function startRecording(stream) {
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => onRecordingStop(stream);
        recorder.start();
        console.log("🎙️ 녹음 시작");
        setTimeout(() => recorder.stop(), 6000);
      }

      // 🟡 TTS 재생 먼저 완료 후 waveform + 녹음 실행
      await playTTSSequentially([...group1Lines, ...group2Lines]);
      visualizeWaveform(micStream);  // TTS 끝난 뒤 파형 그리기 시작
      startRecording(micStream);     // TTS 완료 후 녹음 시작

      async function onRecordingStop(stream) {
        console.log("🛑 녹음 종료됨");

        const blob = new Blob(chunks, { type: 'audio/webm' });
        console.log("📦 녹음된 Blob 생성 완료:", blob);

        const formData = new FormData();
        formData.append("file", blob, "recording.webm");
        console.log("📨 FormData 준비 완료");

        const retryMessage = document.getElementById("retry-message");

        try {
          socket.onmessage = (event) => {
            console.log("📥 STT 응답 수신 완료");
            let resultText = "[인식 실패]";
            if (event.data && typeof event.data === "string") {
              resultText = event.data.trim().replace(/[^\p{L}]/gu, "");
            }
            console.log("📝 STT 텍스트 결과:", resultText);

            sttResult.textContent = "인식된 답변:";
            sttResult.classList.remove("hidden");
            sttResult.classList.add("fade-text-fixed");

            setTimeout(() => {
              sttResult.textContent += " " + resultText;
            }, 1000);

            function levenshtein(a, b) {
              const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
              for (let i = 0; i <= a.length; i++) dp[i][0] = i;
              for (let j = 0; j <= b.length; j++) dp[0][j] = j;

              for (let i = 1; i <= a.length; i++) {
                for (let j = 1; j <= b.length; j++) {
                  dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                  );
                }
              }
              return dp[a.length][b.length];
            }

            const targetText = "안녕하세요";
            const distance = levenshtein(resultText, targetText);
            console.log("🎯 비교 대상:", resultText, "vs", targetText);
            console.log("🧮 Levenshtein 거리:", distance);
            if (distance <= 2 || resultText.includes("안녕하세요")) {
              console.log("✅ 정답 인식됨 - 다음 버튼 표시");
              if (retryMessage) {
                retryMessage.classList.add("hidden");
                retryMessage.classList.remove("fade-text-fixed");
              }
              button.classList.remove("hidden");
              button.classList.add("fade-text-fixed");
              button.style.opacity = "1";
            } else {
              // 실패 횟수 증가
              failCount++;
              // 3회 이상 실패시 강제 버튼 노출
              if (failCount >= 3) {
                console.log("🚨 3회 실패 - 강제 버튼 표시");
                if (retryMessage) {
                  retryMessage.classList.add("hidden");
                  retryMessage.classList.remove("fade-text-fixed");
                }
                button.classList.remove("hidden");
                button.classList.add("fade-text-fixed");
                button.style.opacity = "1";
                return;
              }
              console.log("❗ 정답 아님 - 재녹음 시작");
              if (retryMessage) {
                retryMessage.classList.remove("hidden");
                retryMessage.classList.add("fade-text-fixed");

                setTimeout(() => {
                  waveformContainer.classList.remove("hidden");
                  waveformContainer.classList.add("fade-text-fixed");
                }, 2000);
              }
              startRecording(stream);
            }
          };

          console.log("🧠 STT 요청 시작됨");
          socket.send(await blob.arrayBuffer());

        } catch (err) {
          console.error("❌ STT 요청 실패:", err);
          sttResult.textContent = "인식된 답변: 오류 발생";
        }
      }


    } catch (err) {
      console.error("🎙 마이크 접근 실패:", err);
    }
  })();

  // group-4: 다음 버튼
  await new Promise(resolve => setTimeout(resolve, 1000));
  // button.classList.remove("hidden");
  // setTimeout(() => {
  //   button.classList.add("fade-text-fixed");
  //   button.style.opacity = "1";
  // }, 100);

  button.addEventListener("click", () => {
    window.location.href = "/diagnosis";
  });

  window.addEventListener("beforeunload", () => socket.close());
});