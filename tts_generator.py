# tts_generator.py

import json
from google.cloud import texttospeech

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

    with open(f"static/audio/{filename}", "wb") as out:
        out.write(response.audio_content)
        print(f"[TTS] {filename} 생성 완료")

# 🔽 질문 JSON 읽어서 mp3 일괄 생성
if __name__ == "__main__":
    with open("static/questions_list.json", "r", encoding="utf-8") as f:
        questions = json.load(f)

    for q in questions:
        filename = q["audio"].split("/")[-1]  # audio/q1.mp3 → q1.mp3
        generate_tts(q["text"], filename)