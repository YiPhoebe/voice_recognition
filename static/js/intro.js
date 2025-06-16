document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ intro.js 파일 로딩 시작됨");

  // 🔄 초기화: 새로고침 시 초기 상태 복원
  const icon = document.querySelector(".intro-icon");
  const button = document.getElementById("start-btn");
  const group1Lines = document.querySelectorAll(".group-1");
  const group2Lines = document.querySelectorAll(".group-2");

  [icon, button, ...group1Lines, ...group2Lines].forEach(el => {
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("fade-text-fixed");
    }
  });

  button.style.opacity = "0";
  button.style.transition = "opacity 1s";

  const backendUrl = CONFIG.TTS_ENDPOINT;

  const groups = [
    document.querySelectorAll(".group-1"),
  ];

  // ✅ 모든 문장 미리 오디오 불러오기
  const ttsCache = new Map();
  async function preloadTTS(text) {
    if (!text) {
      console.warn("⚠️ preloadTTS 호출됨: text가 비어있음!");
      return;
    }
    try {
      console.log("🌀 TTS 요청 시작:", text);
      const formData = new URLSearchParams();
      formData.append("text", text);
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      console.log("📡 fetch 요청 보냄", backendUrl, formData.toString());
  
      if (!response.ok) throw new Error("TTS fetch 실패: " + response.status + " " + response.statusText);
  
      const blob = await response.blob();
      console.log("🔉 오디오 Blob 수신 완료:", blob);
      const audio = new Audio(URL.createObjectURL(blob));
      console.log("📦 TTS fetch 성공:", text);
      ttsCache.set(text, audio);
    } catch (err) {
      console.error("❌ preloadTTS 실패:", text, err);
      ttsCache.set(text, new Audio());  // fallback empty audio
    }
  }

  // ✅ 미리 모든 문장의 TTS 오디오 불러오기 (안전하게)
  for (const group of groups) {
    for (const line of group) {
      if (!line || !line.textContent) {
        console.warn("⚠️ group preload 실패: 요소가 비어있거나 텍스트 없음");
        continue;
      }
      await preloadTTS(line.textContent);
    }
  }

  startIntroSequence();

  async function startIntroSequence() {
    // ✅ 아이콘 먼저 등장
    icon.classList.remove("hidden");
    await new Promise(resolve => setTimeout(resolve, 400));
    icon.classList.add("fade-text-fixed");

    // ✅ group-1 문장 동시에 디졸브
    const group1 = groups[0];
    for (let line of group1) {
      line.classList.remove("hidden");
    }
    await new Promise(resolve => setTimeout(resolve, 400));
    for (let line of group1) {
      line.classList.add("fade-text-fixed");
    }

    button.classList.remove("hidden");
    setTimeout(() => {
      button.classList.add("fade-text-fixed");
      button.style.opacity = "1";
    }, 100);

    // ✅ group-1 전체에 대해 오디오 순차 재생
    for (let line of group1) {
      const audio = ttsCache.get(line.textContent);
      if (!audio) continue;
      await new Promise(resolve => {
        audio.currentTime = 0;
        audio.addEventListener("ended", resolve, { once: true });
        console.log("🔊 재생 시도:", line.textContent);
        audio.play().catch(err => {
          console.warn("❌ 오디오 재생 실패:", line.textContent, err);
        });
      });
    }

    for (let i = 1; i < groups.length; i++) {
      const group = groups[i];

      // show lines
      for (let line of group) {
        line.classList.remove("hidden");
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      for (let line of group) {
        line.classList.add("fade-text-fixed");
      }

      // TTS 순차 재생
      for (let line of group) {
        const audio = ttsCache.get(line.textContent);
        if (!audio) continue;
        await new Promise(resolve => {
          audio.currentTime = 0;
          audio.addEventListener("ended", resolve, { once: true });
          console.log("🔊 재생 시도:", line.textContent);
          audio.play().catch(err => {
            console.warn("❌ 오디오 재생 실패:", line.textContent, err);
          });
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // ✅ 모든 오디오 재생 끝난 후 버튼 디졸브
    // button.classList.remove("hidden");
    // setTimeout(() => {
    //   button.classList.add("fade-text-fixed");
    //   button.style.opacity = "1";
    // }, 100);
  }

  // ✅ 클릭 시 즉시 오디오 정지 + 이동
  button.addEventListener("click", () => {
    // 모든 오디오 강제 정지
    for (const audio of ttsCache.values()) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (err) {
        console.warn("오디오 정지 실패:", err);
      }
    }

    // 바로 페이지 이동
    window.location.href = "/mic_test";
  });

  // ✅ iOS 크롬에서 TTS 재생을 위한 상호작용 보장
  document.addEventListener("click", () => {
    for (const [text, audio] of ttsCache.entries()) {
      if (audio && audio.paused) {
        audio.play().catch(err => {
          console.warn("📛 iOS 크롬: 사용자 클릭 후에도 재생 실패:", text, err);
        });
      }
    }
  }, { once: true });
});