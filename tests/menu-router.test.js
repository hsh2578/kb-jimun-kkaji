import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouter, lexicalScore } from "../src/router/menu-router.js";
import { quantizeVector } from "../src/menu/quantize.js";

const DIM = 8;
function vec(seed) {
  return Float32Array.from({ length: DIM }, (_, i) => Math.sin(seed * (i + 1)));
}
function item(id, name, seed, extra = {}) {
  const { q, scale } = quantizeVector(vec(seed));
  return { id, name, path: ["개인뱅킹"], affiliate: "bank", keywords: name.split(/[/\s]+/), depth: 2, isAction: true, scale, q: Array.from(q), ...extra };
}

const items = [
  item("a", "자동이체내역 조회/해지/변경", 1),
  item("b", "예금잔액증명서", 2),
  item("c", "이체한도 조회/감액", 3),
];

test("lexicalScore는 낱말이 겹칠수록 높다", () => {
  const node = { name: "자동이체내역 조회/해지/변경", keywords: ["자동이체내역", "조회", "해지", "변경"] };
  const hit = lexicalScore("자동이체 해지하고 싶어", node);
  const miss = lexicalScore("환율 알려줘", node);
  assert.ok(hit > miss, `hit=${hit} miss=${miss}`);
  assert.ok(miss >= 0 && hit <= 1);
});

test("search는 벡터가 가장 가까운 항목을 1위로 올린다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(2) });
  const out = await router.search("아무 말", { topK: 3 });
  assert.equal(out[0].id, "b");
  assert.equal(out.length, 3);
});

test("search 결과는 점수 내림차순이다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(1) });
  const out = await router.search("자동이체", { topK: 3 });
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
});

test("임베딩이 실패해도 키워드만으로 결과를 낸다", async () => {
  const router = createRouter({
    items, dim: DIM,
    embedFn: async () => { throw new Error("네트워크 없음"); },
  });
  const out = await router.search("예금잔액증명서 떼줘", { topK: 2 });
  assert.equal(out[0].id, "b");
  assert.equal(out[0].why, "keyword");
});

test("topK가 항목 수보다 크면 전부 반환한다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(1) });
  const out = await router.search("무엇이든", { topK: 99 });
  assert.equal(out.length, 3);
});
