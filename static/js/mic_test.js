document.addEventListener("DOMContentLoaded", () => {
  const micResult = document.getElementById("mic-result");
  const continueBtn = document.getElementById("continue-btn");

  // 🔄 초기화: 새로고침 시 초기 상태로 복원
  if (micResult) {
    micResult.textContent = "";
    micResult.style.transform = "scaleY(1)";
  }

  if (continueBtn) {
    continueBtn.classList.add("hidden");
  }

  async function startMicTest() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // --- Begin Audio Visualization using Web Audio API ---
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const barHeight = Math.min(average, 255); // 0~255

        // Visual feedback by scaling micResult element
        if (micResult) {
          micResult.style.transform = `scaleY(${barHeight / 100})`;
        }
      }

      draw();
      // --- End Audio Visualization ---

      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks);
        const formData = new FormData();
        formData.append("file", audioBlob, "mic_test.wav");

        // Send audio to backend STT API
        const response = await fetch("/stt/mic-test", {
            method: "POST",
            body: formData,
          });
          
          if (!response.ok) {
            if (micResult) micResult.textContent = `❌ STT 오류: ${response.statusText}`;
            throw new Error(`STT 서버 오류: ${response.statusText}`);
          }
          
          const result = await response.json();
            if (micResult) {
            micResult.textContent = `인식 결과: "${result.text || '실패'}"`;
            }

            if (result.text) {
            continueBtn.classList.remove("hidden");
            }
        };

      // Start recording
      mediaRecorder.start();
      if (micResult) {
        micResult.textContent = "녹음 중...";
      }
      setTimeout(() => {
        mediaRecorder.stop();
      }, 3000); // record for 3 seconds

    } catch (err) {
      if (micResult) {
        micResult.textContent = "마이크 접근 실패 😥";
      }
      console.error(err);
    }
  }

  startMicTest();

  continueBtn.addEventListener("click", () => {
    window.location.href = "/diagnosis";
  });
});
