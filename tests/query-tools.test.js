import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY_TOOLS, toOpenAITools } from "../src/tools/query-tools.js";

test("조회 도구는 모두 인증이 필요 없다", () => {
  for (const [name, t] of Object.entries(QUERY_TOOLS)) {
    assert.equal(t.requiresAuth, false, `${name}이 인증을 요구함`);
  }
});

test("자동이체 목록을 조회한다", async () => {
  const out = await QUERY_TOOLS.list_autopays.run({});
  assert.ok(out.items.length >= 4);
  assert.ok(out.items[0].name);
  assert.ok(typeof out.items[0].amount === "number");
});

test("카드 실적은 다음 구간까지 남은 금액을 계산한다", async () => {
  const out = await QUERY_TOOLS.get_card_benefit_progress.run({ card_id: "c1" });
  assert.equal(out.spent, 420_000);
  assert.equal(out.remaining, 80_000);
  assert.ok(out.rewards.length > 0);
});

test("연금은 세 계열사를 합쳐서 돌려준다", async () => {
  const out = await QUERY_TOOLS.list_pensions.run({});
  const affiliates = new Set(out.items.map((i) => i.affiliate));
  assert.equal(affiliates.size, 3);
  assert.ok(out.items.some((i) => i.instruction === "없음"), "운용지시 없음 항목이 있어야 경고할 수 있다");
});

test("세금 서류는 신고 유형에 맞는 것만 고른다", async () => {
  const out = await QUERY_TOOLS.find_tax_documents.run({ filing_type: "해외주식양도소득세" });
  assert.ok(out.items.length >= 1);
  assert.ok(out.items.every((d) => d.affiliate === "sec"));
  assert.ok(out.items.some((d) => d.name === "해외주식양도소득내역"));
});

test("알 수 없는 신고 유형이면 빈 목록과 안내를 준다", async () => {
  const out = await QUERY_TOOLS.find_tax_documents.run({ filing_type: "없는세금" });
  assert.equal(out.items.length, 0);
  assert.ok(out.note);
});

test("toOpenAITools는 function calling 스펙을 만든다", () => {
  const specs = toOpenAITools({ x: { description: "설명", parameters: { a: "string" }, requiresAuth: false, run: async () => {} } });
  assert.equal(specs[0].type, "function");
  assert.equal(specs[0].function.name, "x");
  assert.equal(specs[0].function.parameters.type, "object");
  assert.equal(specs[0].function.parameters.properties.a.type, "string");
});
