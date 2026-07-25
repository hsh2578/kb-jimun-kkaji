import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthGate, createExecutor } from "../src/exec/auth-gate.js";

const tools = {
  get_balance: { requiresAuth: false, run: async () => ({ balance: 1000 }) },
  cancel_autopay: { requiresAuth: true, run: async ({ id }) => ({ cancelled: id }) },
};

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
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId);
  const out = await ex.execute(plan.planId, token);
  assert.deepEqual(out, { cancelled: "ap1" });
});

test("토큰은 1회용이다", async () => {
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId);
  await ex.execute(plan.planId, token);
  await assert.rejects(() => ex.execute(plan.planId, token), /인증/);
});

test("다른 계획의 토큰은 통하지 않는다", async () => {
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const p1 = await ex.prepare("cancel_autopay", { id: "a" });
  const p2 = await ex.prepare("cancel_autopay", { id: "b" });
  const t1 = gate.issue(p1.planId);
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
  const gate = createAuthGate();
  let runs = 0;
  const ex = createExecutor({
    authGate: gate,
    tools: { t: { requiresAuth: true, run: async () => { runs++; return { ok: true }; } } },
  });
  const plan = await ex.prepare("t", {});
  await ex.execute(plan.planId, gate.issue(plan.planId));
  // 화면에서 인증 버튼을 두 번 누른 상황
  await assert.rejects(() => ex.execute(plan.planId, gate.issue(plan.planId)), /이미 실행/);
  assert.equal(runs, 1, "도구가 두 번 실행되면 안 된다");
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
