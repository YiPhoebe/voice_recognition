import tempfile
from io import BytesIO
import os
import logging
from fastapi import HTTPException, UploadFile

model = None
if os.getenv("ENV") == "aws":
    import whisper
    model = whisper.load_model("small", device="cpu")

logging.basicConfig(level=logging.INFO)

def transcribe_audio(upload_file: UploadFile) -> dict:
    if model is None:
        raise HTTPException(status_code=503, detail="Whisper STT는 현재 사용되지 않는 환경입니다.")
    try:
        suffix = os.path.splitext(upload_file.filename)[-1] or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as temp_audio:
            contents = upload_file.file.read()
            temp_audio.write(contents)
            temp_audio.flush()
            result = model.transcribe(temp_audio.name, language="ko", fp16=False)
            no_speech_prob = result.get("segments", [{}])[0].get("no_speech_prob", None)
            logging.info(f"[STT 결과] {result}")
            logging.info(f"[no_speech_prob] {no_speech_prob}")
            return {
                "text": result.get("text", "[인 식 실패]"),
                "segments": result.get("segments", []),
                "language": result.get("language", "unknown"),
                "no_speech_prob": no_speech_prob
            }
    except Exception as e:
        logging.error(f"🛑 Whisper 오류 발생: {e}")
        logging.warning("📭 Whisper가 실패하여 빈 응답을 반환합니다.")
        return {
            "text": "",
            "segments": [],
            "language": "unknown",
            "no_speech_prob": None,
            "error": str(e)
        }