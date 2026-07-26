import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthGate, createExecutor } from "../src/exec/auth-gate.js";

const tools = {
  get_balance: { requiresAuth: false, run: async () => ({ balance: 1000 }) },
  cancel_autopay: { requiresAuth: true, run: async ({ id }) => ({ cancelled: id }) },
};

// 실제 검증기(WebAuthn 등)는 src/auth/webauthn.js가 담당한다. 여기서는 AuthGate가
// "주입된 verifyProof를 호출하고, 그 결과를 그대로 신뢰한다"는 계약만 검증한다 —
// 그래서 스텁은 planId가 일치하는 proof만 받아준다(실제 검증기의 최소 계약을 흉내낸다).
const okVerify = (proof, planId) => Boolean(proof) && proof.planId === planId;
const stubProof = (planId) => ({ planId });

test("prepare는 실행하지 않는다", async () => {
  let ran = false;
  const ex = createExecutor({
    authGate: createAuthGate(),
    tools: { t: { requiresAuth: true, run: async () => { ran = true; } } },
  });
  const plan = await ex.prepare("t", {});
  assert.equal(ran, false);
  assert.ok(plan.planId);
  assert.equal(plan.requiresAuth, true);
});

test("인증이 필요한 도구는 토큰 없이 실행되지 않는다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  await assert.rejects(() => ex.execute(plan.planId, null), /인증/);
  await assert.rejects(() => ex.execute(plan.planId, "위조토큰"), /인증/);
});

test("발급된 토큰으로는 실행된다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId, stubProof(plan.planId));
  const out = await ex.execute(plan.planId, token);
  assert.deepEqual(out, { cancelled: "ap1" });
});

test("토큰은 1회용이다 — 실행된 계획은 다시 실행되지 않는다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId, stubProof(plan.planId));
  await ex.execute(plan.planId, token);
  // 실행된 계획이므로 '이미 실행' 가드가 먼저 걸린다. 토큰 소진보다 정확한 설명이다.
  await assert.rejects(() => ex.execute(plan.planId, token), /이미 실행/);
});

test("소진된 토큰은 아직 실행되지 않은 계획에도 통하지 않는다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const ex = createExecutor({ authGate: gate, tools });
  const p1 = await ex.prepare("cancel_autopay", { id: "ap1" });
  const p2 = await ex.prepare("cancel_autopay", { id: "ap2" });
  const t1 = gate.issue(p1.planId, stubProof(p1.planId));
  await ex.execute(p1.planId, t1);           // t1 소진
  // p2는 실행된 적이 없으므로 '이미 실행'이 아니라 인증 가드에 걸려야 한다
  await assert.rejects(() => ex.execute(p2.planId, t1), /인증/);
});

test("다른 계획의 토큰은 통하지 않는다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const ex = createExecutor({ authGate: gate, tools });
  const p1 = await ex.prepare("cancel_autopay", { id: "a" });
  const p2 = await ex.prepare("cancel_autopay", { id: "b" });
  const t1 = gate.issue(p1.planId, stubProof(p1.planId));
  await assert.rejects(() => ex.execute(p2.planId, t1), /인증/);
});

test("인증이 필요 없는 도구는 토큰 없이 실행된다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  const plan = await ex.prepare("get_balance", {});
  const out = await ex.execute(plan.planId, null);
  assert.deepEqual(out, { balance: 1000 });
});

test("없는 도구는 prepare 단계에서 거부된다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  await assert.rejects(() => ex.prepare("존재하지않음", {}), /알 수 없는 도구/);
});

test("새 토큰을 발급받아도 같은 계획을 두 번 실행할 수 없다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  let runs = 0;
  const ex = createExecutor({
    authGate: gate,
    tools: { t: { requiresAuth: true, run: async () => { runs++; return { ok: true }; } } },
  });
  const plan = await ex.prepare("t", {});
  await ex.execute(plan.planId, gate.issue(plan.planId, stubProof(plan.planId)));
  // 화면에서 인증 버튼을 두 번 누른 상황
  await assert.rejects(
    () => ex.execute(plan.planId, gate.issue(plan.planId, stubProof(plan.planId))),
    /이미 실행/
  );
  assert.equal(runs, 1, "도구가 두 번 실행되면 안 된다");
});

// --- issue()의 fail-closed 계약 ---

test("verifyProof를 주입하지 않으면 기본 검증기는 모든 proof를 거부한다 (fail closed)", () => {
  const gate = createAuthGate();
  assert.throws(() => gate.issue("plan_1", { planId: "plan_1" }), /인증/);
  assert.throws(() => gate.issue("plan_1"), /인증/); // proof 자체가 없어도 마찬가지
});

test("주입된 verifyProof가 거짓을 반환하면 issue는 던진다", () => {
  const gate = createAuthGate({ verifyProof: () => false });
  assert.throws(() => gate.issue("plan_1", { planId: "plan_1" }), /인증/);
});

test("proof가 다른 planId에 묶여 있으면 issue는 던진다", () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  assert.throws(() => gate.issue("plan_1", stubProof("plan_2")), /인증/);
});

test("verifyProof가 참을 반환하면 issue는 토큰을 낸다", () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const token = gate.issue("plan_1", stubProof("plan_1"));
  assert.equal(typeof token, "string");
  assert.ok(token.length > 0);
});

test("인증이 필요 없는 도구도 두 번 실행되지 않는다", async () => {
  let runs = 0;
  const ex = createExecutor({
    authGate: createAuthGate(),
    tools: { q: { requiresAuth: false, run: async () => { runs++; return { ok: true }; } } },
  });
  const plan = await ex.prepare("q", {});
  await ex.execute(plan.planId, null);
  await assert.rejects(() => ex.execute(plan.planId, null), /이미 실행/);
  assert.equal(runs, 1);
});
