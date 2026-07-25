// 화면 포맷터. 값 자체는 여기서 만들지만, DOM에 꽂는 책임은 js/ui.js에 있다.
// (거기서는 반드시 textContent로만 꽂는다 — innerHTML 금지.)

export function formatMoney(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

// 보안 질문이 나오기 전에 화면이 먼저 답하게 한다.
export function formatAuditLog(audit) {
  const lines = [];
  lines.push(`LLM 전송 페이로드: "${audit.sentToLLM}"`);
  // 실제로 검사한 것만 주장한다 — 성명·주소 등은 정규식으로 걸러내지 않으므로
  // "미전송"이라 단정하지 않는다. I3에서도 이 패턴 목록(주민번호·계좌번호·카드번호·전화번호)만 다룬다.
  lines.push(
    audit.piiRemoved.length
      ? `⚠ 개인정보 마스킹: ${audit.piiRemoved.join(", ")}`
      : "⚠ 주민번호·계좌번호·카드번호·전화번호 패턴 검사: 검출 0건 (성명 등은 정규식 검사 대상 아님)"
  );
  if (audit.candidates.length) lines.push(`후보 메뉴 ${audit.candidates.length}건`);
  for (const t of audit.toolCalls) lines.push(`도구 호출: ${t}()`);
  for (const t of audit.blockedCalls) lines.push(`⛔ ${t}() — AuthGate 미통과, 호출 불가`);
  return lines;
}
