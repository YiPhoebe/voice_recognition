
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
    console.log("🎯 버튼 눌림!");
    const email = document.getElementById("email").value.trim();
    const name = document.getElementById("name").value.trim();
    const gender = document.getElementById("gender").value;
    const year = document.getElementById("year").value.trim();
    const month = document.getElementById("month").value.trim();
    const day = document.getElementById("day").value.trim();

    // if (!email || !name || !gender || !year || !month || !day) {
    //   warningMsg.classList.remove("hidden");
    //   return;
    // ✅ 테스트 중: 입력 생략 가능, 경고는 alert 팝업으로 처리
    if (!email || !name || !gender || !year || !month || !day) {
      alert("⚠️ 모든 항목을 입력하지 않았지만 테스트용으로 계속 진행합니다.");
    }

    // 생년월일 숨겨진 필드 조합
    const birthInput = document.getElementById("birth");
    birthInput.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // 저장용 사용자 정보 객체 구성
    const userData = {
      email: email,
      name: name,
      gender: gender,
      birth: birthInput.value,
    };

    // 추후 서버 전송 예정 (지금은 localStorage에 저장)
    localStorage.setItem("userData", JSON.stringify(userData));

    // 다음 페이지로 이동
    window.location.href = "/intro";
  });
});

// 이름을 TTS로 보내서 불러오게