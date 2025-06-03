import tempfile
from io import BytesIO
import whisper

model = whisper.load_model("base")

def transcribe_audio(audio_bytes: BytesIO) -> str:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=True) as temp_audio:
        temp_audio.write(audio_bytes)
        temp_audio.flush()
        result = model.transcribe(temp_audio.name, language="ko")
        text = result.get("text", "").strip()
        return text or "[인식 실패]"