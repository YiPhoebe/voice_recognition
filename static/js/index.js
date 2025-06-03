document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ JS 연결됨");
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