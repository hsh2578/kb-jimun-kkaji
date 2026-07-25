// 화면 포맷터. 값 자체는 여기서 만들지만, DOM에 꽂는 책임은 js/ui.js에 있다.
// (거기서는 반드시 textContent로만 꽂는다 — innerHTML 금지.)
import { KB_DATA } from "../data/kb-data.js";
import { resolveAutopay } from "../exec/impact.js";

export function formatMoney(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

// L3 — 인증 버튼을 누르기 "전에" 무엇을 하려는지 문장으로 보여준다.
// (C4) 사용자는 지문 버튼을 누르기 전에 대상과 동작을 반드시 볼 수 있어야 한다.
export function formatPlanSummary(plan) {
  if (!plan) return "";
  const { tool, args = {} } = plan;
  switch (tool) {
    case "cancel_autopay": {
      const ap = resolveAutopay(args);
      return ap
        ? `${ap.name} (${formatMoney(ap.amount)}) 자동납부를 해지합니다.`
        : "해당 자동이체 해지를 진행합니다.";
    }
    case "change_autopay_account": {
      const ap = resolveAutopay(args);
      const acc = KB_DATA.bank.accounts.find((a) => a.id === args.account_id);
      if (ap && acc) return `${ap.name} 자동이체의 출금계좌를 ${acc.name}(으)로 변경합니다.`;
      if (ap) return `${ap.name} 자동이체의 출금계좌를 변경합니다.`;
      return "자동이체 출금계좌 변경을 진행합니다.";
    }
    case "change_installment": {
      const inst = KB_DATA.card.installments.find((i) => i.id === args.installment_id);
      return inst
        ? `${inst.merchant} 할부를 ${args.months}개월로 변경합니다.`
        : "할부 기간 변경을 진행합니다.";
    }
    case "change_transfer_limit":
      return `이체한도를 ${formatMoney(args.amount)}(으)로 변경합니다.`;
    case "issue_certificate":
      return `${args.name}${args.english ? " (영문)" : ""} 발급을 진행합니다.`;
    case "issue_sec_tax_document":
      return `${args.name} 발급을 진행합니다.`;
    case "report_lost_card": {
      const card = KB_DATA.card.cards.find((c) => c.id === args.card_id);
      return card ? `${card.name} 분실 신고를 접수합니다.` : "카드 분실 신고를 접수합니다.";
    }
    default:
      return "요청하신 작업을 진행합니다.";
  }
}

// L3 — 인증 후 실행 결과. 원시 JSON 대신 사람이 읽는 문장으로 바꾼다.
export function formatActionResult(plan, out) {
  const tool = plan?.tool;
  const key = out && typeof out === "object" ? Object.keys(out)[0] : undefined;
  const val = key ? out[key] : undefined;
  if (!val) return "완료했습니다.";
  switch (tool) {
    case "cancel_autopay":
      return `${val.name} 자동납부(${formatMoney(val.amount)}) 해지를 완료했습니다.`;
    case "change_autopay_account":
      return `${val.name} 자동이체 출금계좌를 ${val.to}(으)로 변경했습니다.`;
    case "change_installment":
      return `${val.merchant} 할부를 ${val.months}개월로 변경했습니다.`;
    case "change_transfer_limit":
      return `이체한도를 ${formatMoney(val.transferLimit)}로 변경했습니다.`;
    case "issue_certificate":
    case "issue_sec_tax_document":
      return `${val.name} 발급을 완료했습니다. (${val.fileName})`;
    case "report_lost_card":
      return `${val.name} 분실 신고를 접수했습니다.`;
    default:
      return "완료했습니다.";
  }
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
