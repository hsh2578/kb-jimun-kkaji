import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAuditLog, formatMoney } from "../src/ui/format.js";

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
