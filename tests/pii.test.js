import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubPII, assertNoPII } from "../src/llm/pii.js";

test("계좌번호를 가린다", () => {
  const r = scrubPII("504-10-123456 으로 보내줘");
  assert.ok(!r.text.includes("504-10-123456"));
  assert.ok(r.removed.includes("account"));
});

test("주민등록번호를 가린다", () => {
  const r = scrubPII("990314-1234567");
  assert.ok(!r.text.includes("990314-1234567"));
  assert.ok(r.removed.includes("rrn"));
});

test("휴대폰번호를 가린다", () => {
  const r = scrubPII("010-2578-1114 로 연락");
  assert.ok(!r.text.includes("010-2578-1114"));
  assert.ok(r.removed.includes("phone"));
});

test("일반 발화는 그대로 둔다", () => {
  const r = scrubPII("통신비 자동으로 나가는 거 그만하고 싶어");
  assert.equal(r.text, "통신비 자동으로 나가는 거 그만하고 싶어");
  assert.equal(r.removed.length, 0);
});

test("assertNoPII는 금지 필드가 있으면 throw", () => {
  assert.throws(() => assertNoPII({ utterance: "안녕", balance: 3240500 }), /balance/);
  assert.throws(() => assertNoPII({ accountNumber: "504-10-123456" }), /accountNumber/);
});

test("assertNoPII는 허용 필드만 있으면 통과", () => {
  assert.doesNotThrow(() => assertNoPII({ utterance: "안녕", history: [] }));
});

test("assertNoPII는 utterance 값에 남은 개인정보도 잡아낸다", () => {
  assert.throws(() => assertNoPII({ utterance: "900101-1234567 잔액 알려줘", history: [] }), /utterance/);
});

test("assertNoPII는 history[].content에 남은 개인정보도 잡아낸다 (키 이름만 보는 걸로는 못 잡는다)", () => {
  assert.throws(
    () =>
      assertNoPII({
        utterance: "그럼 자동이체는?",
        history: [{ role: "user", content: "주민번호 900101-1234567 인데 잔액 알려줘" }],
      }),
    /history/
  );
});
