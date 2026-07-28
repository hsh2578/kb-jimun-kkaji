// 상담 시나리오를 프롬프트에 넣을 예시로 바꾼다.
//
// 되묻기 규칙을 말로만 적어두면 모델이 '언제 묻는가'는 지키는데
// '무엇을 먼저 묻는가'는 제멋대로다. 실측으로 본 KB 챗봇도 같은 문제였다 —
// "아들한테 30만원 보내줘"에 "출금계좌를 선택해 주세요"라고 답했다.
// 고객이 말한 것을 버리고 자기가 아는 것부터 물은 것이다.
//
// 규칙 대신 '사례'를 보여주면 순서가 잡힌다. 여기가 그 자리다.
// 지금 사례는 합성이고, KB에 적용할 때 상담 이력에서 뽑은 것으로 갈아끼운다.
// 갈아끼우는 것은 이 파일이 읽는 JSON 하나뿐이다.

// 프롬프트에 넣을 사례 수. 전부 넣으면 프롬프트가 길어져 비용과 지연이 커진다.
// 되묻기가 실제로 갈리는 것은 '빠진 것이 있는' 경우이므로 그쪽을 먼저 채운다.
//
// 12로 뒀을 때 되묻기 사례가 8건뿐이라 유형이 다 덮이지 않았다
// (실측: 되물어야 할 때 물음 6~7/13). 유형별로 최소 한 건은 들어가도록 늘린다.
const MAX_EXAMPLES = 24;

/** 되묻기가 있는 사례를 앞에, 없는 사례(바로 실행/조회)를 뒤에 둔다. */
export function pickExamples(scenarios, limit = MAX_EXAMPLES) {
  const withAsk = scenarios.filter((s) => s.asks?.length);
  const noAsk = scenarios.filter((s) => !s.asks?.length);
  // 되묻는 사례를 2/3, 되묻지 않는 사례를 1/3 — 후자가 없으면 모델이 전부 되묻는다.
  const askQuota = Math.ceil(limit * (2 / 3));
  return [...withAsk.slice(0, askQuota), ...noAsk.slice(0, limit - Math.min(askQuota, withAsk.length))];
}

/** 사례 하나를 사람이 읽는 형태로 적는다. 도구 호출 문법은 절대 쓰지 않는다. */
function render(s) {
  const lines = [`고객: "${s.opening}"`];
  if (!s.asks?.length) {
    lines.push("→ 되묻지 않는다. 바로 처리한다.");
  } else {
    s.asks.forEach((a, i) => {
      lines.push(`→ ${i + 1}번째로 묻는다: "${a.say}"`);
    });
  }
  return lines.join("\n");
}

// 실제 상담에서 집계한 '업무별로 먼저 묻는 것'을 짧은 규칙으로 적는다.
//
// 문장을 그대로 넣는 실험은 실패했다(실측: 되묻기 30.8% → 0%).
// 전화 상담의 되묻기는 안내가 섞인 긴 문장이라, 모델이 '도구를 부르라'가 아니라
// '이렇게 글로 답하라'로 배웠다. 순서는 문장 형식과 무관하므로 이것만 가져온다.
//
// 도구 이름을 그대로 쓰지 않는 이유: 프롬프트에 함수명을 늘어놓으면 모델이
// 그 이름을 답변 글에 베껴 쓴다(실측으로 두 번 당했다). 우리말로 적는다.
const TOOL_LABEL = {
  transfer_money: "이체",
  change_transfer_limit: "이체한도 변경",
  get_fx_rates: "환전·환율",
  get_monthly_outflow: "출금 내역 조회",
  list_autopays: "자동이체",
  list_maturities: "만기 상품",
  get_loan_status: "대출·이자",
  get_sec_holdings: "증권 보유 종목",
  issue_certificate: "증명서 발급",
  list_pensions: "연금",
};

const SLOT_LABEL = {
  금액: "금액", 시점: "기준 시점(언제인지)", 통화: "통화",
  종류: "종류", 계좌: "계좌", 대상: "대상(종목·건)",
};

/** 1순위 슬롯이 같은 업무끼리 묶어 줄 수를 줄인다. */
export function buildPriorityBlock(priority = {}) {
  const groups = new Map();
  for (const [tool, v] of Object.entries(priority)) {
    const first = v?.order?.[0];
    const label = TOOL_LABEL[tool];
    if (!first || !label) continue;
    const slot = SLOT_LABEL[first.slot] ?? first.slot;
    if (!groups.has(slot)) groups.set(slot, []);
    groups.get(slot).push(label);
  }
  if (!groups.size) return "";

  const lines = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([slot, tools]) => `· ${tools.join(" · ")} → ${slot}을 먼저 확인한다`);

  return (
    "[업무별로 먼저 묻는 것]\n" +
    "실제 상담 기록을 집계한 결과다. 되물어야 할 때 아래 순서를 따른다.\n" +
    lines.join("\n") +
    "\n\n"
  );
}

/**
 * 시스템 프롬프트에 붙일 블록을 만든다.
 * scenarios 가 비면 빈 문자열을 돌려준다 — 데이터가 없어도 동작은 해야 한다.
 */
export function buildConsultBlock(scenarios = [], limit = MAX_EXAMPLES) {
  const picked = pickExamples(scenarios, limit);
  if (!picked.length) return "";
  return (
    "[상담 사례 — 이 순서를 따라라]\n" +
    "아래는 같은 상황에서 상담원이 무엇을 먼저 물었는지 모은 것이다.\n" +
    "고객이 이미 말한 것은 되짚어 확인해 주고, 빠진 것만 순서대로 묻는다.\n" +
    "네가 아는 것(계좌 목록 같은 것)부터 묻지 마라.\n\n" +
    picked.map(render).join("\n\n") +
    "\n\n"
  );
}
