// L3 — 실행. 전부 인증이 필요하다.
// 더미 데이터를 조작하지만, 실제 서비스에서는 이 함수 본문만 은행 API로 바뀐다.
import { KB_DATA } from "../data/kb-data.js";
import { resolveAutopay, resolveRecipient, resolveSubsidy, fromAccount } from "../exec/impact.js";

const a = (description, parameters, run) => ({ description, parameters, requiresAuth: true, run });

export const ACTION_TOOLS = {
  cancel_autopay: a(
    "자동이체·자동납부·자동송금을 해지한다. 고객이 '통신비', '케이블' 처럼 이름만 말하면 name_hint에 넣는다. " +
      "'매달 빠져나가는 통신비 그만하고 싶다', '통신비 자동으로 나가는 거 어떻게 막냐', " +
      "'돈이 계속 새는 것 같아 통신 쪽부터 막아줘' 처럼 특정 항목을 막연히 끊고 싶어해도 이 도구를 쓴다.",
    { autopay_id: "string", name_hint: "string" },
    async (args) => {
      const ap = resolveAutopay(args);
      if (!ap) throw new Error("해당 자동이체를 확인할 수 없습니다");
      return { cancelled: { id: ap.id, name: ap.name, amount: ap.amount } };
    }
  ),

  change_autopay_account: a(
    "자동이체의 출금 계좌를 다른 계좌로 바꾼다",
    { autopay_id: "string", name_hint: "string", account_id: "string" },
    async (args) => {
      const ap = resolveAutopay(args);
      const acc = KB_DATA.bank.accounts.find((x) => x.id === args.account_id);
      if (!ap) throw new Error("해당 자동이체를 확인할 수 없습니다");
      if (!acc) throw new Error("해당 계좌를 확인할 수 없습니다");
      return { changed: { id: ap.id, name: ap.name, from: ap.from, to: acc.name } };
    }
  ),

  issue_certificate: a(
    "은행 제증명을 발급한다",
    { name: "string", english: "boolean" },
    async ({ name, english = false }) => {
      const c = KB_DATA.bank.certificates.find((x) => x.name === name);
      if (!c) throw new Error(`${name}은(는) KB국민은행에서 발급할 수 없습니다`);
      if (english && !c.english) throw new Error(`${name}은(는) 영문 발급을 지원하지 않습니다`);
      return { issued: { name: c.name, english, fileName: `${c.name}${english ? "_EN" : ""}.pdf` } };
    }
  ),

  issue_sec_tax_document: a(
    "KB증권 세금 관련 서류를 발급한다",
    { name: "string" },
    async ({ name }) => {
      const d = KB_DATA.sec.taxDocs.find((x) => x.name === name);
      if (!d) throw new Error(`${name}은(는) KB증권에서 발급할 수 없습니다`);
      return { issued: { affiliate: "sec", name: d.name, fileName: `${d.name}.pdf`, deadline: d.deadline } };
    }
  ),

  change_installment: a(
    "카드 할부 기간을 변경한다",
    { installment_id: "string", months: "number" },
    async ({ installment_id, months }) => {
      const i = KB_DATA.card.installments.find((x) => x.id === installment_id);
      if (!i) throw new Error("해당 할부 건을 확인할 수 없습니다");
      return { changed: { id: i.id, merchant: i.merchant, months } };
    }
  ),

  change_transfer_limit: a(
    "이체한도를 변경한다",
    { amount: "number" },
    async ({ amount }) => ({ changed: { transferLimit: amount } })
  ),

  // 이체. 고객은 계좌번호를 말하지 않는다 — "아들한테", "어머니한테", "아까 보낸 데로" 라고 부른다.
  // recipient_hint 에는 들은 말을 그대로 넣는다. 계좌 해석은 resolveRecipient() 가 한다.
  transfer_money: a(
    "돈을 이체한다. 받는 사람을 '아들', '어머니', '관리비'처럼 관계나 별칭으로 부르면 recipient_hint에 그대로 넣는다. " +
      "'최근에 이체한 계좌에 보내줘', '지난번 거기로 또 보내줘' 처럼 지시대명사로 부르면 use_last_recipient를 true로 한다. " +
      "출금 계좌는 비워 두면 주거래 입출금 계좌가 자동으로 쓰인다 — 어느 계좌에서 뺄지 묻지 마라. " +
      "list_accounts 로 계좌 목록을 보여줄 필요도 없다. " +
      "금액을 못 들었다면 이 도구를 부르지 말고 ask_clarification 도구로 '얼마를 보낼까요?' 만 묻는다.",
    { recipient_hint: "string", contact_id: "string", use_last_recipient: "boolean", amount: "number", account_id: "string" },
    async (args) => {
      const to = resolveRecipient(args);
      if (!to) throw new Error("받는 분을 확인할 수 없습니다");
      const from = fromAccount(args.account_id);
      if (!from) throw new Error("출금 계좌를 확인할 수 없습니다");
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("보낼 금액을 확인할 수 없습니다");
      if (from.balance < amount) throw new Error(`${from.name} 잔액이 부족합니다`);
      return {
        transferred: {
          to: to.label, holder: to.holder, bank: to.bank, number: to.number,
          amount, from: from.name, balanceAfter: from.balance - amount,
        },
      };
    }
  ),

  export_card_statement: a(
    "카드 이용명세서를 파일로 내보낸다. '엑셀로 뽑아줘', '명세서 파일로 보내줘', 'PDF로 받고 싶어' 처럼 말할 때 쓴다. " +
      "format 은 들은 대로 'xlsx' 또는 'pdf' 로 넣는다. 목적지를 말하면 destination 에 넣는다(예: '메일', '카카오톡'). " +
      "카드를 지정하지 않으면 주카드가 자동으로 쓰인다 — 어느 카드인지 묻지 말고, " +
      "list_cards 로 카드 목록을 먼저 보여주지도 마라. 바로 이 도구를 부른다.",
    { card_id: "string", month: "string", format: "string", destination: "string" },
    async ({ card_id, month, format = "xlsx", destination } = {}) => {
      const card = KB_DATA.card.cards.find((c) => c.id === card_id) ?? KB_DATA.card.cards[0];
      if (!card) throw new Error("해당 카드를 확인할 수 없습니다");
      const stmt = KB_DATA.card.statements.find((s) => s.cardId === card.id);
      const ext = String(format).toLowerCase() === "pdf" ? "pdf" : "xlsx";
      const period = month ?? stmt?.month ?? KB_DATA.today.slice(0, 7);
      return {
        exported: {
          card: card.name,
          month: period,
          fileName: `KB국민카드_이용명세서_${period}.${ext}`,
          destination: destination ?? null,
        },
      };
    }
  ),

  apply_subsidy: a(
    "지원금·환급·캐시백을 신청한다. '고유가 지원금 신청해줘', '캐시백 받게 해줘' 처럼 말할 때 쓴다. " +
      "고객이 부른 이름을 name_hint에 그대로 넣는다.",
    { subsidy_id: "string", name_hint: "string" },
    async (args) => {
      const sb = resolveSubsidy(args);
      if (!sb) throw new Error("해당 지원금을 확인할 수 없습니다");
      if (!sb.eligible) throw new Error(`${sb.name}은(는) 신청 대상이 아닙니다`);
      return { applied: { name: sb.name, amount: sb.amount, deadline: sb.deadline, requires: sb.requires ?? null } };
    }
  ),

  report_lost_card: a(
    "카드 분실을 신고한다",
    { card_id: "string" },
    async ({ card_id }) => {
      const c = KB_DATA.card.cards.find((x) => x.id === card_id);
      if (!c) throw new Error("해당 카드를 확인할 수 없습니다");
      return { reported: { id: c.id, name: c.name } };
    }
  ),
};
