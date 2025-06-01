import os
import json
from google.cloud import texttospeech

# ✅ 환경변수 설정 확인
credentials_path = "/home/iujeong/fastapi/watchful-ripple-461201-s8-8b7007d5b1c8.json"
if not os.path.exists(credentials_path):
    raise RuntimeError(f"서비스 계정 키 파일을 찾을 수 없습니다: {credentials_path}")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path  # GCP용 환경 변수 등록

def generate_tts(text, filename="output.mp3"):
    client = texttospeech.TextToSpeechClient()
    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code="ko-KR",
        name="ko-KR-Chirp3-HD-Despina"
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    print(f"🔧 [DEBUG] static/audio/{filename} 저장 시도 중")
    with open(f"static/audio/{filename}", "wb") as out:
        out.write(response.audio_content)
        print(f"[TTS] {filename} 생성 완료")
    # 저장 직후 파일 존재 여부 확인
    if not os.path.exists(f"static/audio/{filename}"):
        print(f"❌ [ERROR] 파일 저장 실패: static/audio/{filename}")
    else:
        print(f"✅ [SUCCESS] 파일 정상 저장 확인됨")

if __name__ == "__main__":
    with open("static/questions_list.json", "r", encoding="utf-8") as f:
        questions = json.load(f)

    for q in questions:
        filename = q["audio"].split("/")[-1]
        full_path = os.path.join("static/audio", filename)
        print(f"🔍 생성될 파일 경로: {full_path}")
        generate_tts(q["text"], filename)
        if not os.path.exists(full_path):
            print(f"⚠️ 파일 생성 실패: {full_path}")