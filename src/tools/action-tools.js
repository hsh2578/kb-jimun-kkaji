// L3 — 실행. 전부 인증이 필요하다.
// 더미 데이터를 조작하지만, 실제 서비스에서는 이 함수 본문만 은행 API로 바뀐다.
import { KB_DATA } from "../data/kb-data.js";
import { resolveAutopay } from "../exec/impact.js";

const a = (description, parameters, run) => ({ description, parameters, requiresAuth: true, run });

export const ACTION_TOOLS = {
  cancel_autopay: a(
    "자동이체·자동납부·자동송금을 해지한다. 고객이 '통신비', '케이블' 처럼 이름만 말하면 name_hint에 넣는다",
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
