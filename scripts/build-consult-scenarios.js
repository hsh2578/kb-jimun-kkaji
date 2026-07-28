// 추출한 실제 상담에서, 앱에서 쓸 수 있는 되묻기만 골라 사례로 만든다.
//
// 왜 골라야 하나: 원본은 전화 상담이다. 전화에는 있고 앱에는 없는 되묻기가 많다.
//   · 본인확인 — "성함과 생년월일을 말씀해 주시겠습니까?"  (앱은 이미 로그인 상태)
//   · 계좌번호 구술 — "계좌 번호를 말씀해 주시면"          (앱은 계좌를 안다)
//   · 마무리 인사 — "추가로 궁금하신 사항이 있으시면"       (되묻기가 아니다)
// 이걸 그대로 넣으면 에이전트가 로그인한 고객에게 계좌번호를 묻는다 —
// 우리가 없애려던 바로 그 행동을 배우게 된다.
//
// 남기는 것: 업무에 필요한 조각(대상·금액·기간·통화·종류)을 묻는 되묻기.
//
// 실행: node scripts/build-consult-scenarios.js
import { readFileSync, writeFileSync } from "node:fs";

const SRC = JSON.parse(readFileSync("data/consult-extracted.json", "utf8"));

// 원본 주제 → 우리 도구. 매핑되지 않는 주제는 버린다.
const TOPIC_TO_TOOL = {
  "자금이체/계좌제한": "transfer_money",
  "중계요청/착오송금": "transfer_money",
  "자동이체조회": "list_autopays",
  "거래내역/잔액조회": "get_monthly_outflow",
  "금융거래한도/비대면한도계좌": "change_transfer_limit",
  "환전문의": "get_fx_rates",
  "만기,연장/해지,수신": "list_maturities",
  "대출문의(만기/연장/조회등)": "get_loan_status",
  "이자/연체금액": "get_loan_status",
  "신용거래/담보대출": "get_loan_status",
  "증권계좌조회": "get_sec_holdings",
  "주식주문": "get_sec_holdings",
  "해외주문": "get_sec_holdings",
  "절세형금융상품": "list_pensions",
  "계좌관리": "issue_certificate",
  "부수거래금리감면": "get_loan_status",
};

// 되묻기가 무엇을 묻는지 — 우리 슬롯 이름으로 옮긴다. 순서가 우선순위다.
const SLOT_RULES = [
  ["amount", /얼마|금액|한도를\s*(얼마|어느)/],
  // '언제든/언제나'는 마무리 인사다 — '언제'만 보면 163건이 잘못 걸렸다(실측).
  ["when", /언제(?!든|나)|날짜|일시|며칠|몇\s*월|어느\s*달/],
  ["currency", /어떤\s*통화|어느\s*나라|무슨\s*화폐|통화(는|를)/],
  ["kind", /어떤\s*(방식|종류|상품|서류|업무)|어느\s*것|무엇을|어떤\s*것/],
  ["account", /어느\s*계좌|어떤\s*계좌|어느\s*통장|어떤\s*통장/],
  ["item", /어떤\s*거래|어떤\s*건|어느\s*건|어떤\s*자동이체/],
];

// 앱에서 물으면 안 되는 것. 하나라도 걸리면 버린다.
const APP_INAPPROPRIATE =
  /성함|생년월일|주민|본인\s*확인|신분증|비밀번호|연락처|전화번호|계좌\s*번호를|계좌번호를|뒤\s*네\s*자리|대번호|지점을?\s*방문|영업점|내점|팩스|우편/;

// 되묻기가 아니라 마무리·안내인 것.
const CLOSING =
  /추가로\s*궁금|다른\s*궁금|언제든|언제나|도움이\s*되셨|도움이\s*되었|안내해\s*드렸|감사합니다|이용해\s*주셔|연락\s*(주세요|주시)|문의\s*(주세요|주시)|종료하겠|최선을\s*다하/;

// 고객 첫 발화가 인사뿐이면 사례가 되지 않는다.
const GREETING_ONLY =
  /^[\s]*(안녕하세요|여보세요|수고|네|예|저기|실례)[^가-힣]*$|^.{0,14}$/;

function slotOf(ask) {
  for (const [slot, re] of SLOT_RULES) if (re.test(ask)) return slot;
  return null;
}

// 고객 발화에서 인사말을 떼어내 본론만 남긴다 — 앱에서는 인사부터 하지 않는다.
function trimGreeting(s) {
  return s
    .replace(/^\s*(안녕하세요|안녕하십니까|여보세요|수고하십니다|수고 많으십니다)[.,!?\s]*/g, "")
    .replace(/^\s*저는\s+[■●★▲◆O]+\S*\s*(이라고\s*합니다|입니다)[.,\s]*/g, "")
    .trim();
}

const picked = [];
const seenAsk = new Set();
const perTool = new Map();
const LIMIT_PER_TOOL = 30; // 한 도구에 쏠리면 다른 업무를 못 배운다

for (const r of SRC.rows) {
  const tool = TOPIC_TO_TOOL[r.topic];
  if (!tool) continue;
  if (APP_INAPPROPRIATE.test(r.ask) || CLOSING.test(r.ask)) continue;

  const slot = slotOf(r.ask);
  if (!slot) continue;

  const opening = trimGreeting(r.opening);
  if (GREETING_ONLY.test(opening)) continue;
  if (opening.length < 12 || opening.length > 80) continue;
  // 비식별 기호가 많이 남은 발화는 읽히지 않는다.
  if ((opening.match(/[●★▲◆■O]/g) ?? []).length > 4) continue;

  const key = r.ask.slice(0, 30);
  if (seenAsk.has(key)) continue;
  seenAsk.add(key);

  const n = perTool.get(tool) ?? 0;
  if (n >= LIMIT_PER_TOOL) continue;
  perTool.set(tool, n + 1);

  picked.push({
    id: r.id,
    source: "real",
    institution: r.institution,
    field: r.topic,
    tool,
    opening,
    asks: [{ slot, say: r.ask }],
    why: `실제 상담에서 그대로 가져왔습니다 (${r.institution}, 주제: ${r.topic}).`,
  });
}

console.log(`실제 상담에서 고른 사례 ${picked.length}건`);
for (const [t, n] of [...perTool.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${t}`);
}

writeFileSync(
  "data/consult-real.json",
  JSON.stringify(
    {
      _출처: SRC._출처,
      _선별: "scripts/build-consult-scenarios.js — 앱 맥락에 맞지 않는 되묻기(본인확인·계좌번호 구술·지점 방문·마무리 인사)를 제외",
      total: picked.length,
      scenarios: picked,
    },
    null,
    2
  ),
  "utf8"
);
console.log("\n저장 data/consult-real.json");
