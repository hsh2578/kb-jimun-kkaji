import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateToolSelection } from "../src/eval/tool-eval.js";

const orch = (toolByUtterance) => ({
  handle: async (u) => {
    const t = toolByUtterance[u];
    return t
      ? { layer: "L2", audit: { toolCalls: [t], blockedCalls: [] } }
      : { layer: "L1", audit: { toolCalls: [], blockedCalls: [] } };
  },
});

test("도구 선택 정확도를 센다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({ a: "list_autopays" }),
    cases: [
      { utterance: "a", level: "L3", expectTool: "list_autopays" },
      { utterance: "b", level: "L3", expectTool: "list_autopays" },
    ],
  });
  assert.equal(r.total, 2);
  assert.equal(r.toolOk, 1);
});

test("층별로 나눠 센다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({ a: "t1", c: "t2" }),
    cases: [
      { utterance: "a", level: "L1", expectTool: "t1" },
      { utterance: "b", level: "L4", expectTool: "t2" },
      { utterance: "c", level: "L4", expectTool: "t2" },
    ],
  });
  assert.equal(r.byLevel.L1.ok, 1);
  assert.equal(r.byLevel.L4.ok, 1);
  assert.equal(r.byLevel.L4.total, 2);
});

test("expectTool이 null이면 도구를 안 부르는 게 정답이다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({}),
    cases: [{ utterance: "x", level: "L1", expectTool: null }],
  });
  assert.equal(r.toolOk, 1);
});

test("인증 대기 중인 호출도 선택으로 인정한다", async () => {
  const o = { handle: async () => ({ layer: "L3", audit: { toolCalls: [], blockedCalls: ["cancel_autopay"] } }) };
  const r = await evaluateToolSelection({
    orchestrator: o,
    cases: [{ utterance: "x", level: "L3", expectTool: "cancel_autopay" }],
  });
  assert.equal(r.toolOk, 1);
});
