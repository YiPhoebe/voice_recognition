from fastapi import APIRouter, Request
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from typing import List, Dict
import csv
from datetime import datetime
import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()

router = APIRouter()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

# 예시: 이메일 전송용 데이터 모델
class EmailRequest(BaseModel):
    name: str
    email: str
    gender: str
    birth: str
    score: int
    summary: str
    scores: List[Dict]

@router.post("/send_email")
async def send_email(request: EmailRequest):
    print(f"📧 이메일 전송 요청 받음: 이메일={request.email}, 점수={request.score}, 요약={request.summary}")
    
    csv_file = "/home/iujeong/fastapi/result_csv/diagnosis_results.csv"
    file_exists = os.path.isfile(csv_file)

    score_map = {item.get("question"): item.get("score", "") for item in request.scores}
    row = [
        request.name,
        request.email,
        request.gender,
        request.birth
    ] + [score_map.get(i, "") for i in range(20)]

    with open(csv_file, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if not file_exists:
            header = ["이름", "이메일", "성별", "생년월일"] + [f"문항{i+1}" for i in range(20)]
            writer.writerow(header)
        writer.writerow(row)

    # 이메일 전송 구성
    msg = EmailMessage()
    msg["Subject"] = "ADHD 진단 결과 안내"
    msg["From"] = EMAIL_USER
    msg["To"] = request.email
    msg.set_content(f"안녕하세요,\n\n다음은 귀하의 진단 요약입니다:\n\n{request.summary}\n\n총 점수: {request.score}\n\n감사합니다.")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:  # Gmail 기준
            smtp.login(EMAIL_USER, EMAIL_PASS)
            smtp.send_message(msg)
    except Exception as e:
        return JSONResponse(content={"message": f"이메일 전송 중 오류 발생: {str(e)}"}, status_code=500)

    return JSONResponse(content={"message": f"{request.email}로 이메일 전송이 완료되었습니다!"})