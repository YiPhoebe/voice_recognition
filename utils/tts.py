

import os
import uuid
import logging
from gtts import gTTS

logging.basicConfig(level=logging.INFO)

def synthesize_text(text: str, output_dir: str = "static/audio") -> str:
    try:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{uuid.uuid4()}.mp3"
        output_path = os.path.join(output_dir, filename)
        tts = gTTS(text=text, lang="ko")
        tts.save(output_path)
        logging.info(f"✅ TTS 생성 완료: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"🛑 TTS 오류 발생: {e}")
        raise RuntimeError("TTS 변환에 실패했습니다.")