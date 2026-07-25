import { test } from "node:test";
import assert from "node:assert/strict";
import { toSeniorSpeech, chunkOneAtATime, buildConfirmation } from "../src/voice/senior-voice.js";

test("금액은 두 번 말한다", () => {
  const s = toSeniorSpeech("통신비 52,000원입니다");
  assert.equal((s.match(/52,000원/g) ?? []).length, 2);
});

test("금액이 없으면 그대로 둔다", () => {
  assert.equal(toSeniorSpeech("네, 알겠습니다"), "네, 알겠습니다");
});

test("한 번에 하나씩 끊는다", () => {
  const lines = chunkOneAtATime([
    { name: "통신비", amount: 52000 },
    { name: "케이블 방송", amount: 15000 },
  ]);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes("첫 번째"));
  assert.ok(lines[1].includes("두 번째"));
});

test("확인 문장은 되풀이하고 네/아니오를 요구한다", () => {
  const s = buildConfirmation({ verb: "멈추", target: "케이블 방송 자동이체", effect: "다음 달부터 나가지 않습니다" });
  assert.ok(s.includes("케이블 방송 자동이체"));
  assert.ok(s.includes("다음 달부터 나가지 않습니다"));
  assert.ok(/"네"/.test(s));
});

test("항목이 없으면 빈 배열을 준다", () => {
  assert.deepEqual(chunkOneAtATime([]), []);
});
