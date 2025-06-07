const CONFIG = {
    // WS_HOST: "192.168.3.19:10181",              // ✅ STT WebSocket 서버 (mic_test.js 등)
    // TTS_HOST: "http://192.168.3.20:10081",    // 완전히 분리된 TTS 서버
    // TTS_ENDPOINT: "http://192.168.3.19:10081/synthesize", // ✅ TTS 백엔드 서버 (SMS 음성 변환 등)
    // STT_WEBSOCKET_PATH: "/ws/general",             // STT WebSocket 경로 (diagnosis.js)
    // STT_SHORT_WEBSOCKET_PATH: "/ws/general", // 짧은 STT 경로 (mic_test.js)
    WS_HOST: "localhost:5981",                      // 너의 STT WebSocket (STT 서버 실행 중이면 OK)
    TTS_HOST: "http://localhost:10081",             // TTS 서버
    TTS_ENDPOINT: "http://localhost:10081/synthesize",
    STT_WEBSOCKET_PATH: "/ws/general",
    STT_SHORT_WEBSOCKET_PATH: "/ws/general",
  };