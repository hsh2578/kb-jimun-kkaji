// 실제 상담에서 '업무별로 무엇을 먼저 묻는가'를 집계한다.
//
// 문장을 그대로 넣는 실험은 실패했다(실측: 되묻기 30.8% → 0%).
// 전화 상담의 되묻기는 안내가 섞인 긴 문장이라 도구 호출 신호가 되지 못했다.
//
// 그런데 '무엇을 먼저 묻는가'라는 순서는 문장 형식과 무관하다.
// 문장은 버리고 순서만 가져온다 — 이게 17쪽에 적은 '2단계 · 순서 통계'다.
//
// 실행: node scripts/build-slot-priority.js
import { readFileSync, writeFileSync } from "node:fs";

const SRC = JSON.parse(readFileSync("data/consult-extracted.json", "utf8"));

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
};

// 되묻기가 무엇을 묻는지. 문장은 버리고 이 라벨만 쓴다.
const SLOT_RULES = [
  ["금액", /얼마|금액/],
  ["시점", /언제(?!든|나)|날짜|일시|며칠|몇\s*월/],
  ["통화", /어떤\s*통화|무슨\s*화폐|어느\s*나라\s*(돈|화폐)/],
  ["종류", /어떤\s*(방식|종류|상품|서류|업무)|어느\s*것|무엇을/],
  ["계좌", /어느\s*계좌|어떤\s*계좌|어느\s*통장|어떤\s*통장/],
  ["대상", /어떤\s*거래|어떤\s*건|어느\s*건|어떤\s*자동이체|어떤\s*종목/],
];

// 앱에서는 물을 필요가 없는 것 — 집계에서도 뺀다.
const PHONE_ONLY =
  /성함|생년월일|주민|본인\s*확인|신분증|비밀번호|연락처|전화번호|계좌\s*번호를|계좌번호를|뒤\s*네\s*자리|지점|영업점|내점/;
const CLOSING =
  /추가로\s*궁금|다른\s*궁금|언제든|언제나|도움이\s*되|감사합니다|이용해\s*주셔|연락\s*주|문의\s*주/;

function slotOf(ask) {
  for (const [slot, re] of SLOT_RULES) if (re.test(ask)) return slot;
  return null;
}

const byTool = new Map();
let counted = 0;

for (const r of SRC.rows) {
  const tool = TOPIC_TO_TOOL[r.topic];
  if (!tool) continue;
  if (PHONE_ONLY.test(r.ask) || CLOSING.test(r.ask)) continue;
  const slot = slotOf(r.ask);
  if (!slot) continue;
  if (!byTool.has(tool)) byTool.set(tool, new Map());
  const m = byTool.get(tool);
  m.set(slot, (m.get(slot) ?? 0) + 1);
  counted++;
}

const priority = {};
for (const [tool, m] of byTool) {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  // 표본이 적으면 순서를 믿을 수 없다.
  if (total < 30) continue;
  priority[tool] = {
    total,
    order: [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slot, n]) => ({ slot, n, pct: +((n / total) * 100).toFixed(1) })),
  };
}

console.log(`집계 대상 ${counted}건 · 도구 ${Object.keys(priority).length}종\n`);
for (const [tool, v] of Object.entries(priority)) {
  const top = v.order.slice(0, 3).map((o) => `${o.slot} ${o.pct}%`).join("  ");
  console.log(`  ${tool.padEnd(22)} n=${String(v.total).padStart(5)}   ${top}`);
}

writeFileSync(
  "data/slot-priority.json",
  JSON.stringify(
    {
      _출처: SRC._출처,
      _집계: "scripts/build-slot-priority.js — 상담원이 업무별로 '무엇을 먼저 묻는가'. 문장은 버리고 순서만 쓴다.",
      _제외: "본인확인·계좌번호 구술·지점 방문 등 앱에 없는 되묻기, 마무리 인사",
      counted,
      priority,
    },
    null,
    2
  ),
  "utf8"
);
console.log("\n저장 data/slot-priority.json");
