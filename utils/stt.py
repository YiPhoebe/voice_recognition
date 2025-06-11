import tempfile
from io import BytesIO
import whisper
from fastapi import HTTPException

model = whisper.load_model("base", device="cpu")

def transcribe_audio(audio_bytes: BytesIO) -> dict:
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio.flush()
            result = model.transcribe(temp_audio.name, language="ko", fp16=False)
            no_speech_prob = result.get("segments", [{}])[0].get("no_speech_prob", None)
            print(f"[STT 결과] {result}")
            print(f"[no_speech_prob] {no_speech_prob}")
            return {
                "text": result.get("text", "[인 식 실패]"),
                "segments": result.get("segments", []),
                "language": result.get("language", "unknown"),
                "no_speech_prob": no_speech_prob
            }
    except Exception as e:
        print(f"🛑 Whisper 오류 발생: {e}")
        print("📭 Whisper가 실패하여 빈 응답을 반환합니다.")
        return {
            "text": "",
            "segments": [],
            "language": "unknown",
            "no_speech_prob": None,
            "error": str(e)
        }