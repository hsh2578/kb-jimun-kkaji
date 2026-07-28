// 되묻기 사례 블록이 프롬프트에 제대로 실리는지 본다.
//
// 이 블록이 조용히 비면 되묻기 순서가 예전으로 돌아가는데, 화면만 봐서는
// 알 수 없다(문장이 그럴듯하게 나오기 때문). 그래서 테스트로 묶는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildConsultBlock, pickExamples } from "../src/llm/consult-examples.js";
import { buildSystemPrompt } from "../src/llm/system-prompt.js";

const DATA = JSON.parse(
  readFileSync(new URL("../data/consult-scenarios.json", import.meta.url), "utf8")
);
const SCENARIOS = DATA.scenarios;

test("시나리오 데이터가 비어 있지 않다", () => {
  assert.ok(SCENARIOS.length >= 30, `시나리오 ${SCENARIOS.length}건`);
});

test("모든 시나리오에 첫 발화와 도구가 있다", () => {
  for (const s of SCENARIOS) {
    assert.ok(s.opening?.trim(), `${s.id}: opening 없음`);
    assert.ok(s.tool?.trim(), `${s.id}: tool 없음`);
    assert.ok(s.why?.trim(), `${s.id}: why 없음 — 왜 그 순서인지 적어야 한다`);
  }
});

test("되묻는 사례와 되묻지 않는 사례가 모두 있다", () => {
  const withAsk = SCENARIOS.filter((s) => s.asks?.length).length;
  const noAsk = SCENARIOS.length - withAsk;
  // 한쪽만 있으면 모델이 전부 되묻거나 전부 안 묻는 쪽으로 쏠린다.
  assert.ok(withAsk >= 5, `되묻는 사례 ${withAsk}건`);
  assert.ok(noAsk >= 5, `되묻지 않는 사례 ${noAsk}건`);
});

test("한 번에 하나만 묻는다 — 한 되물음에 질문이 둘이면 안 된다", () => {
  for (const s of SCENARIOS) {
    for (const a of s.asks ?? []) {
      const marks = (a.say.match(/\?/g) ?? []).length;
      assert.ok(marks <= 1, `${s.id}: "${a.say}" — 물음표가 ${marks}개`);
    }
  }
});

test("pickExamples는 되묻는 사례를 앞에 둔다", () => {
  const picked = pickExamples(SCENARIOS, 6);
  assert.equal(picked.length, 6);
  assert.ok(picked[0].asks?.length, "첫 사례가 되묻는 사례가 아니다");
});

test("사례가 블록에 실린다", () => {
  const block = buildConsultBlock(SCENARIOS);
  assert.match(block, /상담 사례/);
  assert.match(block, /어느 분께 보내드릴까요/);
});

test("데이터가 없으면 블록은 빈 문자열이다 — 없어도 동작해야 한다", () => {
  assert.equal(buildConsultBlock([]), "");
  assert.equal(buildConsultBlock(), "");
});

test("도구 호출 문법이 사례에 새어 들어가지 않는다", () => {
  // 예시에 name({...}) 형태가 있으면 모델이 그것을 답변으로 베껴 쓴다 — 실측된 사고다.
  const block = buildConsultBlock(SCENARIOS);
  assert.doesNotMatch(block, /\b[a-z][a-z0-9_]{3,}\s*\(\s*[{"']/i);
});

test("시스템 프롬프트에 사례 블록이 포함된다", () => {
  const withData = buildSystemPrompt([], SCENARIOS);
  const without = buildSystemPrompt([]);
  assert.match(withData, /상담 사례/);
  assert.doesNotMatch(without, /상담 사례/);
  assert.ok(withData.length > without.length);
});
