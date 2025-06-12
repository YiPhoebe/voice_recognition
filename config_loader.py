import os


env = os.getenv("ENV", "academy")

if env == "academy":
    ws_host = os.getenv("ACADEMY_WS_HOST")
    tts_endpoint = os.getenv("ACADEMY_TTS_ENDPOINT")
else:
    ws_host = os.getenv("AWS_WS_HOST")
    tts_endpoint = os.getenv("AWS_TTS_ENDPOINT")