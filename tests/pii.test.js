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

test("하이픈 없는 16자리 카드번호를 가린다", () => {
  const r = scrubPII("1234567812345678 로 결제해줘");
  assert.ok(!r.text.includes("1234567812345678"));
  assert.ok(r.removed.includes("card"));
});

test("띄어쓰기로 구분된 휴대폰번호를 가린다", () => {
  const r = scrubPII("010 1234 5678 로 연락해줘");
  assert.ok(!r.text.includes("010 1234 5678"));
  assert.ok(r.removed.includes("phone"));
});

test("하이픈 없는 주민등록번호를 rrn으로 완전히 가린다 (phone으로 오분류되면 안 된다)", () => {
  const r = scrubPII("9001011234567 인데 잔액 알려줘");
  assert.ok(!r.text.includes("9001011234567"));
  assert.ok(!/\d/.test(r.text.match(/9001[^\s]*/)?.[0] ?? ""), "숫자 잔여물이 남으면 안 된다");
  assert.deepEqual(r.removed, ["rrn"]);
  assert.ok(r.text.includes("[rrn]"));
  assert.ok(!r.text.includes("[phone]"), "phone 패턴으로 잘못 분류되면 안 된다");
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
