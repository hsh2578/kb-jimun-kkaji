import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";

test("실행 도구는 모두 인증을 요구한다", () => {
  for (const [name, t] of Object.entries(ACTION_TOOLS)) {
    assert.equal(t.requiresAuth, true, `${name}이 인증을 요구하지 않음`);
  }
});

test("자동이체 해지는 해지된 항목을 돌려준다", async () => {
  const out = await ACTION_TOOLS.cancel_autopay.run({ autopay_id: "ap2" });
  assert.equal(out.cancelled.id, "ap2");
  assert.ok(out.cancelled.name);
});

test("이름 힌트만으로 자동이체를 해지한다", async () => {
  const out = await ACTION_TOOLS.cancel_autopay.run({ name_hint: "통신비" });
  assert.equal(out.cancelled.id, "ap1");
});

test("없는 자동이체를 해지하려 하면 실패한다", async () => {
  await assert.rejects(() => ACTION_TOOLS.cancel_autopay.run({ autopay_id: "없음" }), /확인할 수 없/);
  await assert.rejects(() => ACTION_TOOLS.cancel_autopay.run({ name_hint: "없는이름xyz" }), /확인할 수 없/);
});

test("제증명 발급은 영문 여부를 반영한다", async () => {
  const out = await ACTION_TOOLS.issue_certificate.run({ name: "예금잔액증명서", english: true });
  assert.equal(out.issued.name, "예금잔액증명서");
  assert.equal(out.issued.english, true);
  assert.ok(out.issued.fileName.endsWith(".html"));
});

test("발급 불가능한 서류는 거부한다", async () => {
  await assert.rejects(() => ACTION_TOOLS.issue_certificate.run({ name: "납세증명서" }), /발급할 수 없/);
});

test("증권 세금 서류를 발급한다", async () => {
  const out = await ACTION_TOOLS.issue_sec_tax_document.run({ name: "해외주식양도소득내역" });
  assert.equal(out.issued.affiliate, "sec");
  assert.ok(out.issued.fileName.endsWith(".html"));
});

test("할부 기간을 변경한다", async () => {
  const out = await ACTION_TOOLS.change_installment.run({ installment_id: "i1", months: 6 });
  assert.equal(out.changed.months, 6);
});
