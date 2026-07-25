// 화면 포맷터. 값 자체는 여기서 만들지만, DOM에 꽂는 책임은 js/ui.js에 있다.
// (거기서는 반드시 textContent로만 꽂는다 — innerHTML 금지.)

export function formatMoney(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

// 보안 질문이 나오기 전에 화면이 먼저 답하게 한다.
export function formatAuditLog(audit) {
  const lines = [];
  lines.push(`LLM 전송 페이로드: "${audit.sentToLLM}"`);
  lines.push(
    audit.piiRemoved.length
      ? `⚠ 개인정보 마스킹: ${audit.piiRemoved.join(", ")}`
      : "⚠ 계좌번호·잔액·성명 미전송 (0건)"
  );
  if (audit.candidates.length) lines.push(`후보 메뉴 ${audit.candidates.length}건`);
  for (const t of audit.toolCalls) lines.push(`도구 호출: ${t}()`);
  for (const t of audit.blockedCalls) lines.push(`⛔ ${t}() — AuthGate 미통과, 호출 불가`);
  return lines;
}
