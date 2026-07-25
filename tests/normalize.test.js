import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMenuNode, parseMenuHtml, splitKeywords } from "../src/menu/normalize.js";
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

test("parseMenuHtml은 링크를 직전 헤딩의 path로 배정한다 (이체 섹션)", () => {
  const html = readFileSync("tests/fixtures/bank-menu.html", "utf8");
  const nodes = parseMenuHtml(html, "bank");
  const 계좌이체 = nodes.find((n) => n.name === "계좌이체");
  const 자동이체내역 = nodes.find((n) => n.name === "자동이체내역 조회/해지/변경");
  const 자동이체등록 = nodes.find((n) => n.name === "자동이체 등록");
  for (const n of [계좌이체, 자동이체내역, 자동이체등록]) {
    assert.ok(n, "이체 섹션 링크가 존재해야 한다");
    assert.deepEqual(n.path, ["이체"]);
    assert.equal(n.depth, 2);
  }
});

test("parseMenuHtml은 링크를 직전 헤딩의 path로 배정한다 (뱅킹관리 섹션)", () => {
  const html = readFileSync("tests/fixtures/bank-menu.html", "utf8");
  const nodes = parseMenuHtml(html, "bank");
  const 예금잔액증명서 = nodes.find((n) => n.name === "예금잔액증명서");
  const 통장인감분실 = nodes.find((n) => n.name === "통장/인감분실 재발행");
  for (const n of [예금잔액증명서, 통장인감분실]) {
    assert.ok(n, "뱅킹관리 섹션 링크가 존재해야 한다");
    assert.deepEqual(n.path, ["뱅킹관리"]);
    assert.equal(n.depth, 2);
  }
});

test("parseMenuHtml은 섹션 경계에서 헤딩을 밀려 배정하지 않는다", () => {
  // 회귀 방지: 항상 첫 헤딩을 쓰거나 한 칸씩 밀리는 버그가 있다면
  // 뱅킹관리 섹션의 마지막 항목이 이체로 잘못 배정된다.
  const html = readFileSync("tests/fixtures/bank-menu.html", "utf8");
  const nodes = parseMenuHtml(html, "bank");
  const 통장인감분실 = nodes.find((n) => n.name === "통장/인감분실 재발행");
  assert.ok(통장인감분실);
  assert.notDeepEqual(통장인감분실.path, ["이체"]);
});

// text()는 parseMenuHtml 내부에서만 쓰이므로(파싱 단계에서 태그를 벗기고
// 엔터티를 디코딩) HTML 조각을 parseMenuHtml에 통과시켜 검증한다.

test("parseMenuHtml은 &middot;를 가운뎃점으로 디코딩한다", () => {
  const html = "<a>겟백서비스 안내&middot;신청</a>";
  const [n] = parseMenuHtml(html, "bank");
  assert.equal(n.name, "겟백서비스 안내·신청");
  assert.ok(n.keywords.includes("안내"));
  assert.ok(n.keywords.includes("신청"));
  assert.ok(!n.keywords.some((k) => k.includes("middot")));
});

test("parseMenuHtml은 십진 숫자 문자 참조(&#39;)를 디코딩한다", () => {
  const html = "<a>금융소비자정보포털 &#39;파인&#39;</a>";
  const [n] = parseMenuHtml(html, "sec");
  assert.equal(n.name, "금융소비자정보포털 '파인'");
});

test("parseMenuHtml은 16진 숫자 문자 참조(&#x27;)를 디코딩한다", () => {
  const html = "<a>금융소비자정보포털 &#x27;파인&#x27;</a>";
  const [n] = parseMenuHtml(html, "sec");
  assert.equal(n.name, "금융소비자정보포털 '파인'");
});

test("parseMenuHtml은 &amp;를 마지막에 디코딩해 이중 디코딩을 피한다", () => {
  // &amp;middot; 가 &middot; 로 잘못 재해석되어 · 로 바뀌면 안 된다.
  const html = "<a>A&amp;middot;B이용안내</a>";
  const [n] = parseMenuHtml(html, "bank");
  assert.equal(n.name, "A&middot;B이용안내");
});

test("parseMenuHtml은 기본 named entity(lt, gt, quot, apos)를 디코딩한다", () => {
  const html = "<a>A&lt;B&gt;&quot;C&quot;&apos;D&apos;안내</a>";
  const [n] = parseMenuHtml(html, "bank");
  assert.equal(n.name, "A<B>\"C\"'D'안내");
});

test("splitKeywords는 가운뎃점(·)으로 분리한다", () => {
  const tokens = splitKeywords("안내·신청");
  assert.deepEqual(tokens, ["안내", "신청"]);
});
