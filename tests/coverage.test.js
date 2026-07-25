import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCoverage } from "../src/eval/coverage.js";

// 항상 지정한 순위를 돌려주는 가짜 라우터
function fakeRouter(map) {
  return { search: async (u) => (map[u] ?? []).map((id) => ({ id, affiliate: id.split(":")[0] })) };
}

test("Top-1과 Top-3를 구분해서 센다", async () => {
  const router = fakeRouter({
    "u1": ["bank:A", "bank:B", "bank:C"],
    "u2": ["bank:X", "bank:Y", "bank:A"],
  });
  const rep = await evaluateCoverage({
    router,
    heldOut: { "bank:A": ["u1", "u2"] },
  });
  assert.equal(rep.total, 2);
  assert.equal(rep.top1, 1);
  assert.equal(rep.top3, 2);
});

test("맞히지 못한 발화를 misses에 남긴다", async () => {
  const router = fakeRouter({ "u9": ["bank:Z"] });
  const rep = await evaluateCoverage({ router, heldOut: { "bank:A": ["u9"] } });
  assert.equal(rep.misses.length, 1);
  assert.equal(rep.misses[0].id, "bank:A");
  assert.equal(rep.misses[0].utterance, "u9");
  assert.deepEqual(rep.misses[0].got, ["bank:Z"]);
});

test("계열사를 잘못 보낸 비율을 센다", async () => {
  const router = fakeRouter({ "u1": ["card:A"] });
  const rep = await evaluateCoverage({ router, heldOut: { "bank:A": ["u1"] } });
  assert.equal(rep.affiliateError, 1);
});

test("빈 heldOut이면 0으로 나누지 않는다", async () => {
  const rep = await evaluateCoverage({ router: fakeRouter({}), heldOut: {} });
  assert.equal(rep.total, 0);
  assert.equal(rep.top1, 0);
});
