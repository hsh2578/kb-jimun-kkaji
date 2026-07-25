import { test } from "node:test";
import assert from "node:assert/strict";
import { KB_DATA } from "../src/data/kb-data.js";

test("3사 데이터가 모두 있다", () => {
  for (const k of ["bank", "card", "sec", "insurance"]) {
    assert.ok(KB_DATA[k], `${k} 없음`);
  }
});

test("자동이체는 통신비를 포함하고 해지 시 영향이 기술돼 있다", () => {
  const t = KB_DATA.bank.autopays.find((a) => /통신/.test(a.name));
  assert.ok(t, "통신비 자동이체 없음");
  assert.ok(t.impactIfCancelled.length > 0, "해지 영향 설명 없음");
});

test("연금은 세 계열사에 흩어져 있다", () => {
  assert.ok(KB_DATA.bank.accounts.some((a) => a.type === "퇴직연금"));
  assert.ok(KB_DATA.sec.pensions.length > 0);
  assert.ok(KB_DATA.insurance.pensions.length > 0);
});

test("증권 세금 서류는 은행 제증명과 이름이 다르다", () => {
  const bankNames = KB_DATA.bank.certificates.map((c) => c.name);
  const secNames = KB_DATA.sec.taxDocs.map((c) => c.name);
  assert.ok(bankNames.includes("예금잔액증명서"));
  assert.ok(secNames.includes("잔고증명서"));
  assert.equal(bankNames.filter((n) => secNames.includes(n)).length, 0);
});

test("카드 실적에는 다음 구간까지 남은 금액을 계산할 재료가 있다", () => {
  const c = KB_DATA.card.benefits[0];
  assert.ok(typeof c.spentThisMonth === "number");
  assert.ok(typeof c.nextTier === "number");
  assert.ok(c.nextTier > c.spentThisMonth);
});

test("모든 데이터가 가상임이 명시돼 있다", () => {
  assert.ok(/가상/.test(KB_DATA.disclaimer));
});
