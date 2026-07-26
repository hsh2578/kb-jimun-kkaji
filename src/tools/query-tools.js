// L2 — 조회·답변. 부수효과가 없으므로 인증이 필요 없다.
import { KB_DATA } from "../data/kb-data.js";

const q = (description, parameters, run) => ({ description, parameters, requiresAuth: false, run });

export const QUERY_TOOLS = {
  list_accounts: q("보유 계좌 목록과 잔액을 조회한다", {}, async () => ({
    items: KB_DATA.bank.accounts.map(({ id, name, balance, type }) => ({ id, name, balance, type })),
  })),

  list_autopays: q(
    "자동이체·자동납부·자동송금 전체 목록을 조회한다. " +
      "'통장에서 자꾸 뭔가 빠져나가는데 뭔지 모르겠다', '요즘 잔액이 자꾸 줄어든다', " +
      "'쓴 것도 없는데 돈이 없다', '이번 달에 왜 이렇게 나갔지', '내 돈 어디로 새는지 봐줘' 처럼 " +
      "막연히 돈이 새는 것을 걱정하는 말에도 이 도구로 원인을 보여준다.",
    {},
    async () => ({
      items: KB_DATA.bank.autopays.map(({ id, name, amount, day, kind }) => ({ id, name, amount, day, kind })),
      total: KB_DATA.bank.autopays.reduce((s, a) => s + a.amount, 0),
    })
  ),

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
    "카드 혜택 실적 충족 현황과 다음 구간까지 남은 금액을 조회한다. " +
      "'할인 받으려면 얼마나 더 써야 하냐', '이번 달 혜택 못 받는 거 아니냐', " +
      "'카드 쓰는 김에 뭐 챙길 거 있냐' 처럼 물어도 이 도구로 답한다. " +
      "어떤 카드인지 모르면 되묻지 말고 card_id를 빈 문자열로 두고 먼저 호출한다 — 대표 카드 기준으로 조회된다.",
    { card_id: "string" },
    async ({ card_id }) => {
      const b = KB_DATA.card.benefits.find((x) => x.cardId === card_id) ?? KB_DATA.card.benefits[0];
      return { spent: b.spentThisMonth, nextTier: b.nextTier, remaining: b.nextTier - b.spentThisMonth, rewards: b.rewards };
    }
  ),

  list_installments: q("진행 중인 할부를 조회한다", {}, async () => ({ items: KB_DATA.card.installments })),

  get_sec_holdings: q("증권 보유 종목을 조회한다", {}, async () => ({ items: KB_DATA.sec.holdings })),

  // 계열사를 가로지르는 조회 — 이 서비스의 핵심
  list_pensions: q(
    "은행·증권·보험에 흩어진 연금을 한 번에 조회한다. " +
      "'나중에 받을 돈이 얼마나 되나', '은퇴하면 뭐 나오는 거 있나', " +
      "'노후 준비 되고 있는 건지 모르겠다', '회사에서 넣어준 퇴직금 어디 있냐' 처럼 물어도 이 도구로 답한다. " +
      "이 도구는 파라미터가 필요 없다 — 어느 계열사인지 되묻지 말고 바로 호출해 전체를 보여준다.",
    {},
    async () => ({
    items: [
      ...KB_DATA.bank.accounts
        .filter((a) => a.type === "퇴직연금")
        .map((a) => ({ affiliate: "bank", name: a.name, balance: a.balance, instruction: a.instruction })),
      ...KB_DATA.sec.pensions.map((p) => ({ affiliate: "sec", name: p.name, balance: p.balance, instruction: p.instruction })),
      ...KB_DATA.insurance.pensions.map((p) => ({ affiliate: "insurance", name: p.name, monthly: p.monthly, instruction: "해당없음" })),
    ],
  })),

  find_tax_documents: q(
    "세금 신고 유형에 필요한 금융 서류를 은행·증권에서 함께 찾는다. " +
      "'세무서에서 금융자료 가져오라던데', '주식 팔았는데 나중에 문제되는 거 아니냐', " +
      "'5월에 신고하라던데 은행에서 뭐 떼야 하냐' 처럼 물어도 이 도구로 서류를 찾아준다. " +
      "filing_type은 '해외주식양도소득세' / '종합소득세' / '연말정산' 중 문맥상 가장 가까운 값으로 채워 " +
      "되묻지 말고 먼저 호출한다 (예: 주식 매도 언급 → 해외주식양도소득세). 전혀 짐작할 수 없으면 빈 문자열로 호출해 안내를 받는다.",
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

  // 계좌번호는 이미 마스킹된 값만 데이터에 존재한다. 예금주도 마스킹된 채로 나간다.
  list_transfer_contacts: q(
    "자주 이체하는 상대 목록을 조회한다. '누구한테 보낼 수 있어?', '등록된 계좌 뭐 있어?' 처럼 물을 때 쓴다.",
    {},
    async () => ({
      items: KB_DATA.bank.contacts.map((c) => ({ name: c.label, note: `${c.holder} · ${c.bank} ${c.number}` })),
    })
  ),

  list_recent_transfers: q(
    "최근 이체 내역을 최신순으로 조회한다. '최근에 어디로 보냈지?', '지난번에 얼마 보냈더라' 처럼 물을 때 쓴다.",
    {},
    async () => ({
      items: KB_DATA.bank.transfers.map((t) => {
        const c = KB_DATA.bank.contacts.find((x) => x.id === t.contactId);
        return { name: c?.label ?? "받는 분", amount: t.amount, note: `${t.at} · ${c?.bank ?? ""} ${c?.number ?? ""}`.trim() };
      }),
    })
  ),

  // '이번 달 카드값'은 카드 한 장이 아니라 전 카드 합계를 묻는 말이다.
  // get_card_statement(카드 1장)와 이 도구를 설명으로 갈라 놓는다.
  get_card_bill_total: q(
    "이번 달 결제예정 카드대금을 보유 카드 전체 합계로 조회한다. " +
      "'이번 달 카드값 얼마야', '카드 얼마 나가?', '이번 달 카드 대금 알려줘' 처럼 카드를 지정하지 않고 물을 때 쓴다.",
    {},
    async () => {
      const items = KB_DATA.card.statements.map((s) => {
        const card = KB_DATA.card.cards.find((c) => c.id === s.cardId);
        return { affiliate: "card", name: card?.name ?? s.cardId, amount: s.amount, dueDate: s.dueDate };
      });
      return { items, total: items.reduce((sum, i) => sum + i.amount, 0) };
    }
  ),

  get_monthly_installment: q(
    "이번 달 청구되는 할부금 합계를 조회한다. " +
      "'이번 달 할부값 얼마야', '할부로 나가는 돈 얼마나 돼' 처럼 물을 때 쓴다. " +
      "총 할부원금이 아니라 이번 달 청구액을 돌려준다.",
    {},
    async () => {
      const items = KB_DATA.card.installments.map((i) => ({
        affiliate: "card",
        name: i.merchant,
        amount: i.monthlyAmount,
        months: i.months,
        remaining: i.remaining,
        feeRate: i.feeRate,
      }));
      return { items, total: items.reduce((s, i) => s + i.amount, 0) };
    }
  ),

  // "환율 우대 어디서 받아?"는 위치가 아니라 숫자를 묻는 말이다.
  // 위치만 답하면 그건 챗봇이다.
  get_fx_rates: q(
    "환율과 환전 우대율을 조회한다. " +
      "'환율 얼마야', '환율 우대 어디서 받아', '달러 지금 얼마', '엔화 싸?' 처럼 물을 때 쓴다.",
    {},
    async () => {
      const { rates, asOf, note } = KB_DATA.bank.fx;
      return {
        items: rates.map((r) => ({
          affiliate: "bank",
          name: r.name,
          amount: r.sell,
          note: `우대 ${r.preferential * 100}%`,
        })),
        note: `${asOf} 기준 · ${note}`,
      };
    }
  ),

  list_subsidies: q(
    "신청 가능한 지원금·환급·캐시백을 조회한다. " +
      "'받을 수 있는 지원금 있어?', '고유가 지원금 되나', '나 뭐 환급받을 거 없어?' 처럼 물을 때 쓴다.",
    {},
    async () => ({
      items: KB_DATA.card.subsidies.map((s) => ({
        affiliate: "card",
        name: s.name,
        amount: s.eligible ? s.amount : null,
        deadline: s.eligible ? s.deadline : undefined,
        note: s.eligible ? s.basis : `신청 대상 아님 — ${s.basis}`,
      })),
    })
  ),
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
