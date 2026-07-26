// 음성 입력. 브라우저가 없으므로 인식기를 주입해 상태 전이를 검증한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVoiceInput, describeVoiceError, getRecognitionCtor } from "../js/voice.js";

// 최소한의 SpeechRecognition 흉내. 실제 API가 부르는 콜백만 갖는다.
function makeFakeRecognition() {
  const made = [];
  class Fake {
    constructor() {
      this.started = false;
      this.stopped = false;
      made.push(this);
    }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
    // 테스트에서 결과를 밀어넣는 도우미
    emit(results) { this.onresult?.({ resultIndex: 0, results }); }
    fail(code) { this.onerror?.({ error: code }); }
  }
  return { Fake, made };
}

const result = (transcript, isFinal) => Object.assign([{ transcript }], { isFinal });

test("지원하지 않는 환경에서는 isSupported()가 false다", () => {
  const v = createVoiceInput({ RecognitionCtor: null });
  assert.equal(v.isSupported(), false);
});

test("지원하지 않으면 start()해도 조용히 아무 일도 하지 않는다", () => {
  let state = null;
  const v = createVoiceInput({ RecognitionCtor: null, onStateChange: (s) => (state = s) });
  v.start();
  assert.equal(state, null, "지원하지 않는데 listening 상태로 바뀌면 안 된다");
  assert.equal(v.isListening(), false);
});

test("start()는 한국어로 듣기 시작한다", () => {
  const { Fake, made } = makeFakeRecognition();
  const states = [];
  const v = createVoiceInput({ RecognitionCtor: Fake, onStateChange: (s) => states.push(s) });
  v.start();
  assert.equal(made[0].started, true);
  assert.equal(made[0].lang, "ko-KR");
  assert.equal(v.isListening(), true);
  assert.deepEqual(states, ["listening"]);
});

test("말하는 도중에는 onInterim, 끝나면 onFinal 이 온다", () => {
  const { Fake, made } = makeFakeRecognition();
  const interim = [];
  let final = null;
  const v = createVoiceInput({
    RecognitionCtor: Fake,
    onInterim: (t) => interim.push(t),
    onFinal: (t) => (final = t),
  });
  v.start();
  made[0].emit([result("아들한테", false)]);
  made[0].emit([result("아들한테 이체해줘 ", true)]);
  assert.deepEqual(interim, ["아들한테"]);
  assert.equal(final, "아들한테 이체해줘", "앞뒤 공백은 떼고 넘긴다");
});

test("공백만 인식되면 전송하지 않는다", () => {
  const { Fake, made } = makeFakeRecognition();
  let final = null;
  const v = createVoiceInput({ RecognitionCtor: Fake, onFinal: (t) => (final = t) });
  v.start();
  made[0].emit([result("   ", true)]);
  assert.equal(final, null);
});

test("toggle()은 듣는 중이면 멈추고 아니면 시작한다", () => {
  const { Fake, made } = makeFakeRecognition();
  const v = createVoiceInput({ RecognitionCtor: Fake });
  v.toggle();
  assert.equal(v.isListening(), true);
  v.toggle();
  assert.equal(made[0].stopped, true);
  assert.equal(v.isListening(), false);
});

test("듣는 중 다시 start()해도 인식기를 두 번 만들지 않는다", () => {
  const { Fake, made } = makeFakeRecognition();
  const v = createVoiceInput({ RecognitionCtor: Fake });
  v.start();
  v.start();
  assert.equal(made.length, 1);
});

test("오류가 나면 한국어 문구를 주고 듣기를 멈춘다", () => {
  const { Fake, made } = makeFakeRecognition();
  let msg = null;
  const v = createVoiceInput({ RecognitionCtor: Fake, onError: (m) => (msg = m) });
  v.start();
  made[0].fail("not-allowed");
  assert.match(msg, /마이크/);
  assert.equal(v.isListening(), false);
});

test("describeVoiceError는 영어 코드를 한국어로 옮기고 원인을 뭉개지 않는다", () => {
  const blocked = describeVoiceError("not-allowed");
  const silent = describeVoiceError("no-speech");
  assert.match(blocked, /허용/);
  assert.match(silent, /들리지 않/);
  assert.notEqual(blocked, silent, "차단과 무음은 다른 사건이다");
  for (const code of ["not-allowed", "no-speech", "audio-capture", "network", "aborted", "무슨코드"]) {
    assert.doesNotMatch(describeVoiceError(code), /[A-Za-z]{6,}/, `${code}: 영어가 남아 있다`);
  }
});

test("getRecognitionCtor는 window가 없으면 null을 돌려준다", () => {
  assert.equal(getRecognitionCtor(undefined), null);
  assert.equal(getRecognitionCtor({}), null);
  const ctor = function () {};
  assert.equal(getRecognitionCtor({ webkitSpeechRecognition: ctor }), ctor);
});
