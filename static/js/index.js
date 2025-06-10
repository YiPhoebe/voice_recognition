document.addEventListener("DOMContentLoaded", () => {
  // Safe string .startsWith utility to prevent errors
  function safeStartsWith(value, prefix) {
    return typeof value === "string" && value.startsWith(prefix);
  }
  console.log("✅ JS 연결됨");
  console.log("%c🚨 경고: 이 콘솔은 감성 과다로 터질 수 있음", "color: red; font-weight: bold; font-size: 14px");
  console.log("%c🧃 당신이 콘솔을 열었다는 건... 이미 평범한 사용자는 아니다.", "color: orange; font-size: 13px");
  console.log("%c🐸 이유정의 감성 뇌파에 접속 중... 잠시만 기다려주세요...", "color: #7f5af0; font-size: 13px");
  console.log("%c💿 시스템 상태: 🍓딸기맛", "color: pink; font-style: italic; font-size: 12px");
  // 🔄 초기화: 새로고침 시 모든 입력값 초기화
  const formFields = ["email", "name", "gender", "year", "month", "day"];
  formFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const birthInput = document.getElementById("birth");
  if (birthInput) birthInput.value = "";
  const startBtn = document.getElementById("start-btn");

  if (!startBtn) {
    console.warn("❌ 시작 버튼을 찾을 수 없습니다.");
    return;
  }

  startBtn.addEventListener("click", () => {
    const email = document.getElementById("email").value.trim();
    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const year = document.getElementById("year").value.trim();
    const month = document.getElementById("month").value.trim();
    const day = document.getElementById("day").value.trim();

    sessionStorage.setItem("username", name);

    if (!email || !name || !gender || !year || !month || !day) {
      alert("⚠️ 모든 항목을 입력하지 않았지만 테스트용으로 계속 진행합니다.");
    }

    window.location.href = "/intro";
  });
});