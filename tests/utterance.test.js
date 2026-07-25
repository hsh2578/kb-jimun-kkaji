import { test } from "node:test";
import assert from "node:assert/strict";
import { splitVariants, buildIndexText } from "../src/menu/utterance.js";

test("splitVariants는 학습/시험을 반씩 나눈다", () => {
  const v = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const { train, test: te } = splitVariants(v);
  assert.equal(train.length, 4);
  assert.equal(te.length, 4);
  // 겹치면 시험이 무의미해진다
  assert.equal(train.filter((x) => te.includes(x)).length, 0);
});

test("홀수 개여도 겹치지 않는다", () => {
  const { train, test: te } = splitVariants(["a", "b", "c"]);
  assert.equal(train.length + te.length, 3);
  assert.equal(train.filter((x) => te.includes(x)).length, 0);
});

test("buildIndexText는 경로·이름·학습변형을 한 문서로 합친다", () => {
  const node = {
    id: "bank:개인뱅킹>이체>자동납부 등록/해지",
    affiliate: "bank",
    name: "자동납부 등록/해지",
    path: ["개인뱅킹", "이체"],
  };
  const s = buildIndexText(node, ["통신비 자동으로 나가는 거 그만하고 싶어"]);
  assert.ok(s.includes("자동납부 등록/해지"));
  assert.ok(s.includes("개인뱅킹"));
  assert.ok(s.includes("통신비 자동으로"));
  assert.ok(s.includes("KB국민은행"));
});

test("buildIndexText는 계열사를 한국어 이름으로 쓴다", () => {
  const card = buildIndexText({ id: "x", affiliate: "card", name: "명세서조회", path: [] }, []);
  const sec = buildIndexText({ id: "y", affiliate: "sec", name: "잔고증명서발급", path: [] }, []);
  assert.ok(card.includes("KB국민카드"));
  assert.ok(sec.includes("KB증권"));
});
