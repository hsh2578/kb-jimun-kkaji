import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMenuNode, parseMenuHtml } from "../src/menu/normalize.js";
import { readFileSync } from "node:fs";

test("normalizeMenuNode는 안정적인 id와 depth를 만든다", () => {
  const n = normalizeMenuNode({
    affiliate: "bank",
    path: ["개인뱅킹", "이체", "자동이체"],
    name: "자동이체내역 조회/해지/변경",
  });
  assert.equal(n.affiliate, "bank");
  assert.equal(n.depth, 4);
  assert.equal(n.isAction, true);
  assert.ok(n.id.startsWith("bank:"));
  assert.deepEqual(n.path, ["개인뱅킹", "이체", "자동이체"]);
});

test("동작 동사가 없는 메뉴는 isAction=false", () => {
  const n = normalizeMenuNode({ affiliate: "sec", path: ["금융상품"], name: "펀드몰" });
  assert.equal(n.isAction, false);
});

test("같은 입력은 같은 id를 낳는다", () => {
  const a = normalizeMenuNode({ affiliate: "card", path: ["카드이용"], name: "명세서조회" });
  const b = normalizeMenuNode({ affiliate: "card", path: ["카드이용"], name: "명세서조회" });
  assert.equal(a.id, b.id);
});

test("keywords는 슬래시와 괄호를 분해한다", () => {
  const n = normalizeMenuNode({
    affiliate: "bank", path: ["뱅킹관리"], name: "통장/인감분실 재발행",
  });
  assert.ok(n.keywords.includes("통장"));
  assert.ok(n.keywords.includes("인감분실"));
  assert.ok(n.keywords.includes("재발행"));
});

test("parseMenuHtml은 fixture에서 메뉴를 뽑는다", () => {
  const html = readFileSync("tests/fixtures/bank-menu.html", "utf8");
  const nodes = parseMenuHtml(html, "bank");
  assert.ok(nodes.length >= 3, `추출 ${nodes.length}건`);
  assert.ok(nodes.every((n) => n.affiliate === "bank"));
  assert.ok(nodes.some((n) => n.name.includes("자동이체")));
});
