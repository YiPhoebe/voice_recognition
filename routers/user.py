user_data_path = "/home/iujeong/fastapi/csv/user_data.csv"


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
    try:
        user_info = await request.json()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        file_exists = os.path.isfile(user_data_path)

        if file_exists:
            with open(user_data_path, "r", encoding="utf-8") as f:
                line_count = sum(1 for _ in f)
            user_id = line_count
        else:
            user_id = 1

        with open(user_data_path, mode="a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(["id", "email", "name", "gender", "birth", "timestamp"])
            writer.writerow([
                user_id,
                user_info.get("email", ""),
                user_info.get("name", ""),
                user_info.get("gender", ""),
                user_info.get("birth", ""),
                now
            ])
        print(f"✅ user_data.csv 저장됨 - ID: {user_id}, 이름: {user_info.get('name')}, 이메일: {user_info.get('email')}")
        return {"message": "사용자 정보 저장 완료"}
    except Exception as e:
        print(f"❌ 사용자 정보 저장 중 오류 발생: {e}")
        return {"message": "서버 오류로 저장에 실패했습니다.", "error": str(e)}, 500