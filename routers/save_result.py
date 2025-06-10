# /home/iujeong/fastapi/routers/save_result.py

from fastapi import APIRouter, Request
import os, csv

router = APIRouter()

@router.post("/save_result")
async def save_result(request: Request):
    data = await request.json()
    name = data.get("name", "")
    email = data.get("email", "")
    gender = data.get("gender", "")
    birth = data.get("birth", "")
    scores = data.get("scores", [])

    score_map = {s["question"]: s["score"] for s in scores}
    row = [name, email, gender, birth] + [score_map.get(i, "") for i in range(20)]

    output_path = "/home/iujeong/fastapi/result_csv/diagnosis_results.csv"
    file_exists = os.path.exists(output_path)

    with open(output_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            header = ["이름", "이메일", "성별", "생년월일"] + [f"문항{i+1}" for i in range(20)]
            writer.writerow(header)
        writer.writerow(row)

    return {"status": "saved"}