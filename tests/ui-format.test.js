import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatAuditLog,
  formatMoney,
  formatPlanSummary,
  formatActionResult,
  formatQueryItem,
  formatQueryResult,
} from "../src/ui/format.js";

test("금액에 천 단위 구분이 들어간다", () => {
  assert.equal(formatMoney(52000), "52,000원");
  assert.equal(formatMoney(0), "0원");
});

test("감사 로그는 LLM 전송 내용과 PII 제거를 보여준다", () => {
  const lines = formatAuditLog({
    sentToLLM: "잔액 알려줘", piiRemoved: ["account"],
    candidates: ["bank:A"], toolCalls: [], blockedCalls: [],
  });
  assert.ok(lines.some((l) => l.includes("잔액 알려줘")));
  assert.ok(lines.some((l) => /account/.test(l)));
});

test("PII가 없으면 검사 결과 0건이라고 정직하게 표시한다 — 검사하지 않은 항목을 미전송이라 주장하지 않는다", () => {
  // "저는 홍길동인데요" 처럼 이름이 섞인 발화라도, 정규식 검사는 이름을 다루지 않으므로
  // "0건 검출"이라는 말이 "성명도 안 나갔다"는 뜻으로 읽히면 안 된다.
  const lines = formatAuditLog({
    sentToLLM: "저는 홍길동인데요 잔액 알려줘",
    piiRemoved: [],
    candidates: [],
    toolCalls: [],
    blockedCalls: [],
  });
  const line = lines.find((l) => /검출 0건/.test(l));
  assert.ok(line, "검출 0건을 표시하는 줄이 있어야 한다");
  assert.ok(/주민번호|계좌번호|카드번호|전화번호/.test(line), "무엇을 검사했는지 밝혀야 한다");
  assert.ok(!/미전송/.test(line), "검사하지 않은 성명·계좌·잔액을 '미전송'이라 단정하면 안 된다");
});

test("인증 전 차단된 호출을 표시한다", () => {
  const lines = formatAuditLog({ sentToLLM: "x", piiRemoved: [], candidates: [], toolCalls: [], blockedCalls: ["cancel_autopay"] });
  assert.ok(lines.some((l) => l.includes("⛔") && l.includes("cancel_autopay")));
});

// C4 — 인증 버튼을 누르기 전에 대상과 동작이 문장으로 보여야 한다.
test("formatPlanSummary: 자동이체 해지 계획은 대상 이름과 금액, 동작을 문장으로 보여준다", () => {
  const s = formatPlanSummary({ tool: "cancel_autopay", args: { name_hint: "통신비" } });
  assert.match(s, /KT 통신요금/);
  assert.match(s, /52,000원/);
  assert.match(s, /해지/);
});

test("formatPlanSummary: 확인할 수 없는 대상이면 그래도 빈 문자열이 아니다", () => {
  const s = formatPlanSummary({ tool: "cancel_autopay", args: { name_hint: "존재하지않는것" } });
  assert.ok(s.length > 0);
});

test("formatPlanSummary: 이체한도 변경은 금액을 보여준다", () => {
  const s = formatPlanSummary({ tool: "change_transfer_limit", args: { amount: 5_000_000 } });
  assert.match(s, /5,000,000원/);
});

test("formatActionResult: 원시 JSON이 아니라 읽는 문장을 준다", () => {
  const s = formatActionResult(
    { tool: "cancel_autopay" },
    { cancelled: { id: "ap1", name: "KT 통신요금", amount: 52_000 } }
  );
  assert.match(s, /KT 통신요금/);
  assert.match(s, /완료/);
  assert.ok(!/\{/.test(s), "중괄호가 남아있으면 안 된다 — JSON을 그대로 보여주면 안 된다");
});

// C3 — 도구마다 필드 이름이 다른 결과를 하나의 읽을 수 있는 줄로 바꾼다.
test("formatQueryItem: balance 필드를 금액으로 보여준다 (list_accounts)", () => {
  const s = formatQueryItem({ id: "b1", name: "KB My通장", balance: 3_240_500, type: "입출금" });
  assert.match(s, /KB My通장/);
  assert.match(s, /3,240,500원/);
});

test("formatQueryItem: monthly 필드를 금액으로 보여준다 (연금보험)", () => {
  const s = formatQueryItem({ affiliate: "insurance", name: "KB라이프 연금보험", monthly: 300_000 });
  assert.match(s, /300,000원/);
});

test("formatQueryItem: name이 없는 카드 명세서 항목도 undefined를 보이지 않는다", () => {
  const s = formatQueryItem({ cardId: "c1", month: "2026-07", amount: 842_000, dueDate: "2026-08-14" });
  assert.ok(!/undefined/.test(s));
  assert.match(s, /842,000원/);
});

test("formatQueryItem: affiliate가 있으면 계열사를 표시한다 (연금 통합 조회)", () => {
  const s = formatQueryItem({ affiliate: "sec", name: "KB증권 IRP", balance: 11_500_000, instruction: "없음" });
  assert.match(s, /KB증권/);
  assert.match(s, /11,500,000원/);
  assert.match(s, /운용지시 없음/);
});

test("formatQueryResult: items 배열을 줄 목록으로 바꾼다", () => {
  const lines = formatQueryResult({ items: [{ name: "a", amount: 1000 }, { name: "b", amount: 2000 }] });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /1,000원/);
});

test("formatQueryResult: items 키 자체가 없어도(get_card_benefit_progress) 빈 화면이 아니다", () => {
  const lines = formatQueryResult({ spent: 420_000, nextTier: 500_000, remaining: 80_000, rewards: ["커피 10% 할인"] });
  assert.ok(lines.length > 0);
  assert.match(lines[0], /420,000원/);
  assert.match(lines[0], /80,000원/);
  assert.match(lines[0], /커피 10% 할인/);
});

test("formatQueryResult: 빈 배열이면 그냥 아무것도 안 그리지 않고 note가 있으면 보여준다", () => {
  const lines = formatQueryResult({ items: [], note: "안내 문구" });
  assert.deepEqual(lines, ["안내 문구"]);
});
