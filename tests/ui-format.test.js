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

test("PII가 없으면 0건으로 표시한다", () => {
  const lines = formatAuditLog({ sentToLLM: "안녕", piiRemoved: [], candidates: [], toolCalls: [], blockedCalls: [] });
  assert.ok(lines.some((l) => /미전송 \(0건\)/.test(l)));
});

test("인증 전 차단된 호출을 표시한다", () => {
  const lines = formatAuditLog({ sentToLLM: "x", piiRemoved: [], candidates: [], toolCalls: [], blockedCalls: ["cancel_autopay"] });
  assert.ok(lines.some((l) => l.includes("⛔") && l.includes("cancel_autopay")));
});
