import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeImpact, resolveAutopay } from "../src/exec/impact.js";

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

test("자동이체 계좌 변경은 새 계좌의 잔액 부족 위험을 경고한다", async () => {
  const r = await analyzeImpact("change_autopay_account", { autopay_id: "ap1", account_id: "b2" });
  assert.equal(r.blocked, false);
  assert.equal(r.warnings.length, 1);
  assert.ok(/KB Star 정기예금/.test(r.warnings[0]), "대상 계좌 이름이 경고에 포함돼야 한다");
  assert.ok(/잔액/.test(r.warnings[0]));
});

test("자동이체 계좌 변경도 자동이체를 확인할 수 없으면 막는다", async () => {
  const r = await analyzeImpact("change_autopay_account", { autopay_id: "없는아이디", account_id: "b2" });
  assert.equal(r.blocked, true);
  assert.ok(r.reason);
});

test("영향이 없는 도구는 경고 없이 통과한다", async () => {
  const r = await analyzeImpact("issue_certificate", { name: "예금잔액증명서" });
  assert.equal(r.blocked, false);
  assert.deepEqual(r.warnings, []);
});

// C4 — resolveAutopay는 우연히 겹치는 2글자만으로 확신에 찬 오답을 내면 안 된다.
test("resolveAutopay: 힌트와 실제 이름 몇 글자만 우연히 겹치면(전기요금↔KT통신요금의 '요금') 매칭하지 않는다", () => {
  const ap = resolveAutopay({ name_hint: "전기요금" });
  assert.equal(ap, null, "전기요금 자동이체는 데이터에 없으므로 아무 것도 반환하면 안 된다");
});

test("resolveAutopay: 존재하지 않는 autopay_id는 name_hint로 폴백하지 않는다", () => {
  const ap = resolveAutopay({ autopay_id: "없는id", name_hint: "요금" });
  assert.equal(ap, null, "명시적 id가 틀리면 즉시 실패해야 한다 — 이름 힌트로 슬쩍 넘어가면 안 된다");
});

test("resolveAutopay: 존재하지 않는 autopay_id는 name_hint가 없어도 null이다", () => {
  const ap = resolveAutopay({ autopay_id: "없는id" });
  assert.equal(ap, null);
});

test("resolveAutopay: '통신비'는 KT 통신요금에 매칭된다", () => {
  const ap = resolveAutopay({ name_hint: "통신비" });
  assert.equal(ap?.id, "ap1");
});

test("resolveAutopay: '케이블'은 케이블 방송에 매칭된다", () => {
  const ap = resolveAutopay({ name_hint: "케이블" });
  assert.equal(ap?.id, "ap2");
});

test("resolveAutopay: '보험'은 실손의료보험료에 매칭된다", () => {
  const ap = resolveAutopay({ name_hint: "보험" });
  assert.equal(ap?.id, "ap3");
});

test("resolveAutopay: '적금'은 KB 적금 납입에 매칭된다", () => {
  const ap = resolveAutopay({ name_hint: "적금" });
  assert.equal(ap?.id, "ap4");
});

test("resolveAutopay: 빈 힌트는 아무 것도 매칭하지 않는다", () => {
  assert.equal(resolveAutopay({ name_hint: "" }), null);
  assert.equal(resolveAutopay({}), null);
});

test("analyzeImpact: '전기요금' 힌트로 자동이체 해지를 요청하면 확인 불가로 막는다 — 확신에 찬 오답보다 차단이 낫다", async () => {
  const r = await analyzeImpact("cancel_autopay", { name_hint: "전기요금" });
  assert.equal(r.blocked, true);
  assert.ok(r.reason);
});
