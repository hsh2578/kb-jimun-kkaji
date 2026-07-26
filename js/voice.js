// 음성 입력. 브라우저 내장 Web Speech API만 쓴다 — 서버로 음성을 보내지 않는다.
//
// 이 서비스가 겨냥하는 사람 중 상당수는 2,656개 메뉴를 못 찾는 것보다
// 타이핑 자체가 더 큰 장벽이다. 메뉴를 대신 걸어주면서 입력은 손으로만
// 받는다면 절반만 해결한 것이다.
//
// 인식기를 주입받는 이유: window.SpeechRecognition 은 브라우저에만 있어서
// 테스트에서 만질 수 없다. 생성자를 밖에서 넣을 수 있게 해두면 상태 전이를
// 실제로 검증할 수 있다.

export function getRecognitionCtor(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) return null;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function createVoiceInput({
  onInterim, // 말하는 도중 — 입력창을 실시간으로 채운다
  onFinal, // 다 말했다 — 전송한다
  onStateChange, // "idle" | "listening"
  onError, // 사용자에게 보여줄 한국어 문구
  RecognitionCtor = getRecognitionCtor(),
  lang = "ko-KR",
} = {}) {
  let recognition = null;
  let listening = false;

  function isSupported() {
    return Boolean(RecognitionCtor);
  }

  function setState(next) {
    listening = next === "listening";
    onStateChange?.(next);
  }

  function start() {
    if (!isSupported() || listening) return;

    recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = true;
    // 한 문장만 받는다. 대화형이므로 한 번에 하나씩 말하고 답을 듣는 편이 낫다.
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) final += text;
        else interim += text;
      }
      if (interim) onInterim?.(interim);
      if (final.trim()) onFinal?.(final.trim());
    };

    recognition.onerror = (event) => {
      // 브라우저 오류 코드는 영어다. 원인을 뭉개지 않고 한국어로 옮긴다.
      onError?.(describeVoiceError(event?.error));
      setState("idle");
    };

    recognition.onend = () => setState("idle");

    try {
      recognition.start();
      setState("listening");
    } catch {
      // 이미 시작된 인식기를 다시 start() 하면 던진다. 조용히 정리한다.
      setState("idle");
    }
  }

  function stop() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      /* 이미 끝났다 */
    }
    setState("idle");
  }

  return { start, stop, isSupported, isListening: () => listening, toggle: () => (listening ? stop() : start()) };
}

export function describeVoiceError(code) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 사용이 차단되어 있습니다. 브라우저 주소창의 자물쇠에서 마이크를 허용해 주세요.";
    case "no-speech":
      return "소리가 들리지 않았습니다. 다시 말씀해 주세요.";
    case "audio-capture":
      return "마이크를 찾지 못했습니다. 연결을 확인해 주세요.";
    case "network":
      return "네트워크 문제로 음성을 인식하지 못했습니다.";
    case "aborted":
      return "음성 입력이 중단되었습니다.";
    default:
      return "음성을 인식하지 못했습니다.";
  }
}
