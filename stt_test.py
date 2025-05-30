import whisper

# 모델 불러오기 (기존과 동일하게)
model = whisper.load_model("base", device="cuda:0")

# 파일 경로 설정 (테스트용 음성 파일)
audio_path = "temp_question_0.wav"  # 여기에 유정이 녹음된 wav 파일 경로 넣기

# STT 실행
result = model.transcribe(audio_path, language="ko")

# 결과 출력
print("📝 인식된 텍스트:")
print(result["text"])