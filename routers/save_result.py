from fastapi import APIRouter, Request
import os, csv
from datetime import datetime

router = APIRouter()

@router.post("/save_result")
async def save_result(request: Request):
    data = await request.json()
    print("📥 받은 데이터:", data)
    user_id = data.get("user_id", "")
    name = data.get("name", "")
    email = data.get("email", "")
    gender = data.get("gender", "")
    birth = data.get("birth", "")
    final_email = data.get("final_email", "")
    scores = data.get("scores", [])
    print(f"✅ 저장 전 필드 확인 - 이메일: {email}, 성별: {gender}, 생일: {birth}")

    score_map = {int(s["question"]): s["score"] for s in scores}
    
    data_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return_time = data_time  # 현재는 같은 값으로 저장

    total_score = sum(score_map.values())
    diagnosis = "정상" if total_score < 30 else "주의 필요"

    row = [data_time, return_time, user_id, name, email, gender, birth] + [score_map.get(i, "") for i in range(1, 21)] + [total_score, diagnosis, final_email]

    output_path = "/home/iujeong/fastapi/csv/diagnosis_results.csv"
    file_exists = os.path.exists(output_path)

    with open(output_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            header = ["data_time", "return_time", "user_id", "name", "email", "gender", "birth"] + [f"q{i+1}" for i in range(20)] + ["총점", "진단결과", "final_email"]
            writer.writerow(header)
        writer.writerow(row)

    return {"status": "saved"}