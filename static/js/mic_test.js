document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ mic_test.js 로딩 시작됨");

  const icon = document.querySelector(".intro-icon");
  const group1Lines = document.querySelectorAll(".group-1");
  const micStatus = document.getElementById("mic-status");
  const waveformContainer = document.getElementById("waveform");
  const sttResult = document.getElementById("stt-result");
  const button = document.getElementById("next-button");

  [icon, ...group1Lines, micStatus, waveformContainer, sttResult, button].forEach(el => {
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("fade-text-fixed");
    }
  });

  button.style.opacity = "0";
  button.style.transition = "opacity 1s";

  // const backendUrl = "http://192.168.3.19:10081/synthesize";
  const backendUrl = "http://localhost:10081/synthesize";
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

  // TTS 음성은 그룹1 → 그룹2 순차 재생
  playTTSSequentially([...group1Lines, ...group2Lines]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      visualizeWaveform(stream);

      let recorder;
      let chunks = [];

      function startRecording(stream) {
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = () => onRecordingStop(stream);
        recorder.start();
        console.log("🎙️ 녹음 시작");
        setTimeout(() => recorder.stop(), 6000);
      }

      async function onRecordingStop(stream) {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("file", blob, "recording.webm");

        // Ensure sttResult and retryMessage exist
        const retryMessage = document.getElementById("retry-message");

        try {
          const response = await fetch("http://localhost:5981/stt", {
            method: "POST",
            body: formData,
          });
          const resultText = await response.text();
          // Always show the recognized answer text first, with delayed resultText
          sttResult.textContent = "인식된 답변:";
          sttResult.classList.remove("hidden");
          sttResult.classList.add("fade-text-fixed");

          setTimeout(() => {
            sttResult.textContent += " " + resultText;
          }, 1000);

          if (resultText.trim() === "안녕하세요") {
            // Hide the retry message if correct
            if (retryMessage) {
              retryMessage.classList.add("hidden");
              retryMessage.classList.remove("fade-text-fixed");
            }
            button.classList.remove("hidden");
            button.classList.add("fade-text-fixed");
            button.style.opacity = "1";
          } else {
            // Show the retry message if not correct
            if (retryMessage) {
              retryMessage.classList.remove("hidden");
              retryMessage.classList.add("fade-text-fixed");

                // ✅ [백업용] 파형 디졸브 처리 방식
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            waveformContainer.classList.remove("hidden");
            waveformContainer.classList.add("fade-text-fixed");
            
            }
            console.log("❗ 다시 녹음 시작");
            startRecording(stream);
          }
        } catch (err) {
          console.error("❌ STT 요청 실패:", err);
          sttResult.textContent = "인식된 답변: 오류 발생";
        }
      }

      startRecording(stream);

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
});