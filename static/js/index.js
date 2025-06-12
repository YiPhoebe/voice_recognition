document.addEventListener("DOMContentLoaded", () => {
  if (typeof CONFIG === "undefined") {
    console.error("❌ CONFIG가 로드되지 않았습니다. /config.js가 포함되어 있는지 확인하세요.");
  }
  // Safe string .startsWith utility to prevent errors
  function safeStartsWith(value, prefix) {
    return typeof value === "string" && value.startsWith(prefix);
  }
  function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11)
      .replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
  }
  console.log("✅ JS 연결됨");
  console.log("%c🚨 경고: 이 콘솔은 감성 과다로 터질 수 있음", "color: red; font-weight: bold; font-size: 14px");
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

    const userId = generateUUID(); // 고유 ID 생성
    sessionStorage.setItem("user_id", userId); // 고유 ID 저장
    sessionStorage.setItem("username", name);

    if (!email || !name || !gender || !year || !month || !day) {
      alert("⚠️ 모든 항목을 입력해주세요.");
      return;
    }

    const birth = `${year.padStart(2, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    document.getElementById("birth").value = birth;

    sessionStorage.setItem("email", email);
    sessionStorage.setItem("gender", gender);
    sessionStorage.setItem("birth", birth);

    fetch("/save-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        email: email,
        gender: gender,
        birth: birth,
      }),
    })
    .then((res) => {
      if (!res.ok) {
        return res.json().then(data => {
          throw new Error(data?.error || "❌ 저장 실패");
        });
      }
      console.log("✅ 사용자 정보 저장 완료");
      res.text().then((text) => console.log(`✅ user_data.csv 저장됨 → ${text}`));
      window.location.href = "/intro";
    })
    .catch((err) => {
      console.error("⚠️ 저장 중 에러 발생", err);
      alert("⚠️ 사용자 정보를 저장하는 데 실패했습니다.");
    });
  });
});