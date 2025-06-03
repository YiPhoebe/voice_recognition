from google.cloud import speech
import tempfile
from io import BytesIO

client = speech.SpeechClient()

def transcribe_audio(audio_bytes: BytesIO) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_audio:
        temp_audio.write(audio_bytes)
        temp_audio.flush()

        with open(temp_audio.name, "rb") as f:
            content = f.read()

        audio = speech.RecognitionAudio(content=content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            language_code="ko-KR",
            sample_rate_hertz=16000  # 주의: 녹음 샘플레이트에 따라 조정 필요
        )

        response = client.recognize(config=config, audio=audio)

        # 여러 문장이 들어올 수 있으니 이어붙이기
        transcript = " ".join([result.alternatives[0].transcript for result in response.results])
        return transcript