import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrchestrator } from "../src/orchestrator.js";
import { createAuthGate } from "../src/exec/auth-gate.js";

const menus = [{ id: "bank:A", name: "자동납부 등록/해지", path: ["개인뱅킹", "이체"], affiliate: "bank", isAction: true, score: 0.9 }];
const okRouter = { search: async () => menus };

test("LLM이 터져도 예외를 던지지 않고 메뉴를 안내한다", async () => {
  const o = createOrchestrator({
    router: okRouter,
    llm: { chat: async () => { throw new Error("네트워크 없음"); } },
    tools: {}, authGate: createAuthGate(),
  });
  const r = await o.handle("아무 말", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.menus.length > 0);
});

test("라우터까지 터져도 안내 문구를 낸다", async () => {
  const o = createOrchestrator({
    router: { search: async () => { throw new Error("인덱스 없음"); } },
    llm: { chat: async () => ({ message: "", toolCalls: [] }) },
    tools: {}, authGate: createAuthGate(),
  });
  const r = await o.handle("아무 말", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.message.length > 0);
  assert.deepEqual(r.menus, []);
});

test("도구 실행이 실패해도 예외 대신 안내를 낸다", async () => {
  const o = createOrchestrator({
    router: okRouter,
    llm: { chat: async () => ({ message: "", toolCalls: [{ name: "boom", args: {} }] }) },
    tools: { boom: { requiresAuth: false, description: "d", parameters: {}, run: async () => { throw new Error("고장"); } } },
    authGate: createAuthGate(),
  });
  const r = await o.handle("실행해줘", []);
  assert.equal(r.layer, "L1");
  assert.ok(/처리할 수 없/.test(r.message));
});
