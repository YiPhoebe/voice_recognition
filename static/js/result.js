window.addEventListener("DOMContentLoaded", () => {
  const summaryText = document.getElementById("summary-text");
  const totalScoreSpan = document.getElementById("total-score");

  // 예시: 세션 스토리지에서 점수 불러오기 (문자열을 정수로 변환)
  console.log("📦 totalScore from sessionStorage:", sessionStorage.getItem("totalScore"));
  console.log("📦 diagnosis_data from localStorage:", localStorage.getItem("diagnosis_data"));
  const score = parseInt(sessionStorage.getItem("totalScore")) || 0;
  totalScoreSpan.textContent = score;

  let summary = "ADHD 가능성은 낮습니다.";
  if (score >= 60) {
    summary = "ADHD 가능성이 높습니다.";
  } else if (score >= 40) {
    summary = "주의가 필요한 수준입니다.";
  }
  summaryText.textContent = summary;

  // 결과 링크 복사 기능
  const copyButton = document.getElementById("copy-button");
  if (copyButton) {
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          copyButton.textContent = "✅ 복사됨!";
          setTimeout(() => copyButton.textContent = "결과 링크 복사", 2000);
        });
    });
  }

  const emailInput = document.getElementById("email-input");
  if (emailInput) {
    const savedEmail = sessionStorage.getItem("final_email") || "";
    emailInput.value = savedEmail;

    emailInput.addEventListener("input", () => {
      sessionStorage.setItem("final_email", emailInput.value.trim());
    });
  }

  // 이메일 전송 버튼 (백엔드 연결 필요)
  const emailButton = document.getElementById("email-button");
  if (emailButton) {
    emailButton.addEventListener("click", () => {
      console.log("📨 이메일 버튼 클릭됨");

      const email = emailInput.value.trim();
      console.log("📨 입력된 이메일:", email);

      if (!email || !email.includes("@")) {
        alert("유효한 이메일 주소를 입력해주세요.");
        return;
      }

      const payload = {
        name: sessionStorage.getItem("username") || "",
        email: sessionStorage.getItem("final_email") || "",
        gender: sessionStorage.getItem("gender") || "",
        birth: sessionStorage.getItem("birth") || "",
        score: score,
        summary: summary,
        scores: (() => {
          let rawScores = JSON.parse(sessionStorage.getItem("scoreRecords") || "[]");
          if (typeof rawScores[0] === "number") {
            rawScores = rawScores.map((s, i) => ({ question: i + 1, score: s }));
          }
          return rawScores;
        })()
      };

      console.log("📨 전송할 payload:", payload);

      fetch("/send_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        console.log("📨 응답:", data);
        alert(data.message || "이메일 전송 완료");
      })
      .catch((err) => {
        console.error("📨 전송 실패:", err);
        alert("이메일 전송 실패");
      });
    });
  }
});