// L2 — 조회·답변. 부수효과가 없으므로 인증이 필요 없다.
import { KB_DATA } from "../data/kb-data.js";

const q = (description, parameters, run) => ({ description, parameters, requiresAuth: false, run });

export const QUERY_TOOLS = {
  list_accounts: q("보유 계좌 목록과 잔액을 조회한다", {}, async () => ({
    items: KB_DATA.bank.accounts.map(({ id, name, balance, type }) => ({ id, name, balance, type })),
  })),

  list_autopays: q("자동이체·자동납부·자동송금 전체 목록을 조회한다", {}, async () => ({
    items: KB_DATA.bank.autopays.map(({ id, name, amount, day, kind }) => ({ id, name, amount, day, kind })),
    total: KB_DATA.bank.autopays.reduce((s, a) => s + a.amount, 0),
  })),

  get_loan_status: q("대출 잔액과 금리를 조회한다", {}, async () => ({
    items: KB_DATA.bank.loans,
  })),

  list_maturities: q("만기가 다가오는 상품을 조회한다", {}, async () => ({
    items: KB_DATA.bank.accounts.filter((a) => a.maturity).map(({ name, maturity, balance }) => ({ name, maturity, balance })),
  })),

  list_cards: q("보유 카드를 조회한다", {}, async () => ({ items: KB_DATA.card.cards })),

  get_card_statement: q("카드 결제예정금액을 조회한다", { card_id: "string" }, async ({ card_id }) => ({
    items: KB_DATA.card.statements.filter((s) => !card_id || s.cardId === card_id),
  })),

  get_card_benefit_progress: q(
    "카드 혜택 실적 충족 현황과 다음 구간까지 남은 금액을 조회한다",
    { card_id: "string" },
    async ({ card_id }) => {
      const b = KB_DATA.card.benefits.find((x) => x.cardId === card_id) ?? KB_DATA.card.benefits[0];
      return { spent: b.spentThisMonth, nextTier: b.nextTier, remaining: b.nextTier - b.spentThisMonth, rewards: b.rewards };
    }
  ),

  list_installments: q("진행 중인 할부를 조회한다", {}, async () => ({ items: KB_DATA.card.installments })),

  get_sec_holdings: q("증권 보유 종목을 조회한다", {}, async () => ({ items: KB_DATA.sec.holdings })),

  // 계열사를 가로지르는 조회 — 이 서비스의 핵심
  list_pensions: q("은행·증권·보험에 흩어진 연금을 한 번에 조회한다", {}, async () => ({
    items: [
      ...KB_DATA.bank.accounts
        .filter((a) => a.type === "퇴직연금")
        .map((a) => ({ affiliate: "bank", name: a.name, balance: a.balance, instruction: a.instruction })),
      ...KB_DATA.sec.pensions.map((p) => ({ affiliate: "sec", name: p.name, balance: p.balance, instruction: p.instruction })),
      ...KB_DATA.insurance.pensions.map((p) => ({ affiliate: "insurance", name: p.name, monthly: p.monthly, instruction: "해당없음" })),
    ],
  })),

  find_tax_documents: q(
    "세금 신고 유형에 필요한 금융 서류를 은행·증권에서 함께 찾는다",
    { filing_type: "string" },
    async ({ filing_type }) => {
      const map = {
        해외주식양도소득세: [
          { affiliate: "sec", name: "해외주식양도소득내역", deadline: "5월 31일" },
          { affiliate: "sec", name: "금융소득증명서", note: "배당이 있는 경우" },
        ],
        종합소득세: [
          { affiliate: "sec", name: "금융소득증명서" },
          { affiliate: "bank", name: "원천징수영수증" },
        ],
        연말정산: [{ affiliate: "bank", name: "연말정산증명서" }],
      };
      const items = map[filing_type] ?? [];
      return items.length
        ? { items }
        : { items: [], note: "해외주식양도소득세 / 종합소득세 / 연말정산 중에서 알려주세요." };
    }
  ),

  get_monthly_outflow: q("은행 자동이체와 카드 결제를 합쳐 이번 달 나가는 돈을 조회한다", {}, async () => {
    const auto = KB_DATA.bank.autopays.map((a) => ({ affiliate: "bank", name: a.name, amount: a.amount, day: a.day }));
    const card = KB_DATA.card.statements.map((s) => ({ affiliate: "card", name: `카드대금 ${s.cardId}`, amount: s.amount, day: s.dueDate }));
    const items = [...auto, ...card];
    return { items, total: items.reduce((s, i) => s + i.amount, 0) };
  }),

  list_certificates: q("발급 가능한 은행 제증명 목록을 조회한다", {}, async () => ({
    items: KB_DATA.bank.certificates,
  })),
};

export function toOpenAITools(toolMap) {
  return Object.entries(toolMap).map(([name, t]) => ({
    type: "function",
    function: {
      name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(Object.entries(t.parameters).map(([k, v]) => [k, { type: v }])),
        required: [],
      },
    },
  }));
}
