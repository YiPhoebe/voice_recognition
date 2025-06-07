import tempfile
from io import BytesIO
import whisper

model = whisper.load_model("large")

def transcribe_audio(audio_bytes: BytesIO) -> str:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as temp_audio:
        temp_audio.write(audio_bytes)
        temp_audio.flush()
        result = model.transcribe(temp_audio.name, language="ko", fp16=False)
        text = result.get("text", "").strip()
        print(f"[STT 결과] {text}")
        return text or "[인식 실패]"