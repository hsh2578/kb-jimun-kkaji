import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrchestrator } from "../src/orchestrator.js";
import { createAuthGate } from "../src/exec/auth-gate.js";

const router = {
  search: async () => [
    { id: "bank:개인뱅킹>이체>자동납부 등록/해지", name: "자동납부 등록/해지", path: ["개인뱅킹", "이체"], affiliate: "bank", isAction: true, score: 0.9 },
  ],
};
const tools = {
  list_autopays: { requiresAuth: false, description: "d", parameters: {}, run: async () => ({ items: [{ id: "ap1", name: "KT 통신요금" }] }) },
  cancel_autopay: { requiresAuth: true, description: "d", parameters: { autopay_id: "string" }, run: async ({ autopay_id }) => ({ cancelled: { id: autopay_id } }) },
};
const llmWith = (toolCalls, message = "") => ({ chat: async () => ({ message, toolCalls }) });

test("도구 호출이 없으면 L1으로 메뉴를 안내한다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const r = await o.handle("아무거나 물어봄", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.menus.length > 0);
  assert.ok(/자동납부/.test(r.message));
});

test("조회 도구는 L2로 바로 답한다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([{ name: "list_autopays", args: {} }]), tools, authGate: createAuthGate() });
  const r = await o.handle("자동이체 뭐 있어?", []);
  assert.equal(r.layer, "L2");
  assert.ok(r.data.items.length > 0);
});

test("실행 도구는 L3 계획만 만들고 실행하지 않는다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: createAuthGate() });
  const r = await o.handle("통신비 자동이체 끊어줘", []);
  assert.equal(r.layer, "L3");
  assert.ok(r.plan.planId);
  assert.equal(r.plan.requiresAuth, true);
  assert.ok(r.audit.blockedCalls.includes("cancel_autopay"));
});

test("confirm은 토큰이 있어야 실행한다", async () => {
  const gate = createAuthGate();
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: gate });
  const r = await o.handle("끊어줘", []);
  await assert.rejects(() => o.confirm(r.plan.planId, null), /인증/);
  const out = await o.confirm(r.plan.planId, gate.issue(r.plan.planId));
  assert.deepEqual(out.cancelled, { id: "ap1" });
});

test("LLM에 개인정보가 나가지 않고 감사 로그에 남는다", async () => {
  let sent = null;
  const llm = { chat: async (p) => { sent = p; return { message: "", toolCalls: [] }; } };
  const o = createOrchestrator({ router, llm, tools, authGate: createAuthGate() });
  const r = await o.handle("504-10-123456 잔액 알려줘", []);
  assert.ok(!JSON.stringify(sent).includes("504-10-123456"));
  assert.ok(r.audit.piiRemoved.includes("account"));
});

test("영향 분석이 막으면 계획을 세우지 않는다", async () => {
  const o = createOrchestrator({
    router,
    llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "없음" } }]),
    tools,
    authGate: createAuthGate(),
    impactFn: async () => ({ warnings: [], blocked: true, reason: "확인할 수 없습니다" }),
  });
  const r = await o.handle("끊어줘", []);
  assert.equal(r.plan, undefined);
  assert.ok(/확인할 수 없/.test(r.message));
});
