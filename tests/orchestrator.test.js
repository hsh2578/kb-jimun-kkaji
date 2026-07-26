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

// 실제 검증기(WebAuthn)는 src/auth/webauthn.test.js가 다룬다. orchestrator 테스트는
// "confirm에 유효한 토큰을 넘기면 실행된다"는 계약만 확인하면 되므로 스텁으로 충분하다.
const okVerify = (proof, planId) => Boolean(proof) && proof.planId === planId;
const stubProof = (planId) => ({ planId });

test("도구 호출이 없으면 L1으로 메뉴를 안내한다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const r = await o.handle("아무거나 물어봄", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.menus.length > 0);
  assert.ok(/자동납부/.test(r.message));
});

// C2 — stub 어댑터는 도구 호출 없이도 항상 비어있지 않은 message를 준다.
// 예전 코드는 `res.message || describeMenus(menus)`라서 이 경우 위치 안내가 한 번도 나오지 않았다.
test("LLM이 텍스트를 냈어도 도구 호출이 없으면 메뉴 위치를 반드시 덧붙인다", async () => {
  const o = createOrchestrator({
    router,
    llm: llmWith([], "무슨 말씀인지 알겠습니다"),
    tools,
    authGate: createAuthGate(),
  });
  const r = await o.handle("통신비 그만 나가게 해줘", []);
  assert.equal(r.layer, "L1");
  assert.ok(/무슨 말씀인지 알겠습니다/.test(r.message), "LLM 텍스트도 남아있어야 한다");
  assert.ok(/자동납부/.test(r.message), "위치 안내가 항상 붙어야 한다 (L1의 핵심)");
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
  const gate = createAuthGate({ verifyProof: okVerify });
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: gate });
  const r = await o.handle("끊어줘", []);
  await assert.rejects(() => o.confirm(r.plan.planId, null), /인증/);
  const out = await o.confirm(r.plan.planId, gate.issue(r.plan.planId, stubProof(r.plan.planId)));
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

test("history에 남아있던 원본 개인정보도 orchestrator가 다시 스크럽한다 (2턴 유출 재현)", async () => {
  let turn = 0;
  let capturedHistoryOnTurn2 = null;
  const llm = {
    chat: async (payload) => {
      turn++;
      if (turn === 2) capturedHistoryOnTurn2 = payload.history;
      return { message: "", toolCalls: [] };
    },
  };
  const o = createOrchestrator({ router, llm, tools, authGate: createAuthGate() });

  // js/main.js는 오늘 스크럽 전 원본 발화를 history에 그대로 push한다 — 그 실제 동작을 재현한다.
  const history = [];
  const turn1Text = "주민번호 900101-1234567 인데 잔액 알려줘";
  const r1 = await o.handle(turn1Text, history);
  history.push({ role: "user", content: turn1Text }); // 원본(pre-scrub) 텍스트 — 버그의 원인
  if (r1.message) history.push({ role: "assistant", content: r1.message });

  await o.handle("그럼 자동이체는?", history);

  assert.ok(capturedHistoryOnTurn2, "2번째 턴에서 llm.chat이 호출되어야 한다");
  assert.ok(
    !JSON.stringify(capturedHistoryOnTurn2).includes("900101-1234567"),
    "history를 통해 원본 주민등록번호가 2번째 턴의 LLM 페이로드로 새어나가면 안 된다"
  );
});

test("confirm은 실행 내역을 감사 로그에 남긴다", async () => {
  const gate = createAuthGate({ verifyProof: okVerify });
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: gate });
  const r = await o.handle("끊어줘", []);
  const out = await o.confirm(r.plan.planId, gate.issue(r.plan.planId, stubProof(r.plan.planId)));
  assert.equal(out.audit.tool, "cancel_autopay");
  assert.equal(out.audit.planId, r.plan.planId);
  assert.ok(
    o.executionAudit.some((e) => e.tool === "cancel_autopay" && e.planId === r.plan.planId),
    "orchestrator는 실행된 계획을 감사 로그에 남겨야 한다"
  );
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

// --- 대화 이력 (다중 턴에서 첫 의도에 고정되던 버그) ---

test("도구를 부른 턴은 OpenAI 프로토콜대로 assistant+tool 한 쌍으로 남는다", () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const turns = o.historyTurns({
    layer: "L2", message: "",
    audit: { toolCalls: ["list_pensions"], blockedCalls: [], calls: [{ id: "c1", name: "list_pensions", args: {} }] },
  });
  assert.equal(turns.length, 2);
  assert.equal(turns[0].role, "assistant");
  assert.equal(turns[0].content, null, "도구를 부른 턴에 답변 문장을 지어 넣으면 모델이 그걸 베낀다");
  assert.equal(turns[0].tool_calls[0].function.name, "list_pensions");
  assert.equal(turns[1].role, "tool");
  assert.equal(turns[1].tool_call_id, "c1");
});

test("이력의 tool 결과에는 수치가 담기지 않는다", () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const turns = o.historyTurns({
    layer: "L2", message: "",
    audit: { toolCalls: ["list_accounts"], blockedCalls: [], calls: [{ id: "c1", name: "list_accounts", args: {} }] },
  });
  assert.doesNotMatch(turns[1].content, /\d{3,}/, "잔액이 LLM으로 나가면 안 된다");
});

test("인증 대기 중인 실행도 이력에 남는다", () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const turns = o.historyTurns({
    layer: "L3", message: "",
    audit: { toolCalls: [], blockedCalls: ["cancel_autopay"], calls: [{ id: "c9", name: "cancel_autopay", args: { name_hint: "케이블" } }] },
  });
  assert.equal(turns[0].tool_calls[0].function.name, "cancel_autopay");
  assert.equal(turns[1].role, "tool");
});

test("텍스트가 있으면 그 텍스트를 그대로 쓴다", () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const [turn] = o.historyTurns({ layer: "L1", message: "여기 있습니다", audit: { toolCalls: [], blockedCalls: [], calls: [] } });
  assert.equal(turn.content, "여기 있습니다");
});

test("도구도 텍스트도 없으면 안내했다는 사실을 남긴다", () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const [turn] = o.historyTurns({ layer: "L1", message: "", audit: { toolCalls: [], blockedCalls: [], calls: [] } });
  assert.equal(turn.role, "assistant");
  assert.ok(turn.content.length > 0, "빈 content 는 이력을 기형으로 만든다");
});
