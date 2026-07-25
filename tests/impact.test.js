import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeImpact } from "../src/exec/impact.js";

test("자동이체 해지는 영향을 경고한다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "ap1" });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /통신/.test(w)));
});

test("이름 힌트만으로도 영향을 찾아낸다", async () => {
  const r = await analyzeImpact("cancel_autopay", { name_hint: "통신비" });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /통신/.test(w)));
});

test("보험료 자동이체 해지는 실효 위험을 경고한다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "ap3" });
  assert.ok(r.warnings.some((w) => /실효/.test(w)));
});

test("영향을 확인할 수 없으면 실행을 막는다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "없는아이디" });
  assert.equal(r.blocked, true);
  assert.ok(r.reason);
});

test("할부 변경은 수수료를 경고한다", async () => {
  const r = await analyzeImpact("change_installment", { installment_id: "i1", months: 6 });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /수수료/.test(w)));
});

test("영향이 없는 도구는 경고 없이 통과한다", async () => {
  const r = await analyzeImpact("issue_certificate", { name: "예금잔액증명서" });
  assert.equal(r.blocked, false);
  assert.deepEqual(r.warnings, []);
});
