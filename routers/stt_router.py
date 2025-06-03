from fastapi import APIRouter, UploadFile, File
from utils.stt import transcribe_audio

router = APIRouter()

@router.post("/stt-test")
async def stt_test(file: UploadFile = File(...)):
    transcript = transcribe_audio(await file.read())
    return {"text": transcript}
