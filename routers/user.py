

from fastapi import APIRouter, Request
from pydantic import BaseModel
import os, csv
from datetime import datetime

router = APIRouter()

class UserInfo(BaseModel):
    name: str
    email: str
    gender: str
    birth: str

@router.post("/save-user")
async def save_user(request: Request):
    user_info = await request.json()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    file_exists = os.path.isfile("user_data.csv")
    with open("user_data.csv", mode="a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(["id", "email", "name", "gender", "birth", "timestamp"])
        with open("user_data.csv", "r", encoding="utf-8") as f:
            line_count = sum(1 for row in f)
        user_id = line_count
        writer.writerow([
            user_id,
            user_info.get("email", ""),
            user_info.get("name", ""),
            user_info.get("gender", ""),
            user_info.get("birth", ""),
            now
        ])
    return {"message": "사용자 정보 저장 완료"}