// 실행 전 부수효과를 조사한다.
// 모르면 진행하지 않는다 — 확인 안 된 상태의 실행은 그 자체가 결함이다.
import { KB_DATA } from "../data/kb-data.js";

// 두 문자열이 공유하는 가장 긴 연속 부분 문자열의 길이.
// "통신비"와 "KT통신요금"처럼 고객의 구어체 표현과 실제 등록명이
// 정확히 일치하지 않아도 핵심 단어("통신")를 통해 매칭하기 위함이다.
function longestCommonSubstringLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  let max = 0;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > max) max = dp[i][j];
      }
    }
  }
  return max;
}

// 매칭 인정 최소 기준. 둘 다 만족해야 한다.
//   MIN_SCORE  — 우연한 한 글자 겹침을 배제한다.
//   MIN_RATIO  — 힌트/등록명 중 짧은 쪽 대비 겹치는 비중. "전기요금"↔"KT통신요금"처럼
//                끝의 "요금" 두 글자만 우연히 겹치는 경우(비중 0.5)를 걸러내기 위함이다.
const MIN_SCORE = 2;
const MIN_RATIO = 0.6;

// 힌트 한 개를 후보 목록에 맞춘다. namesOf(item)이 돌려주는 이름 중 가장 잘 맞는 것으로 채점한다.
// (수취인은 "아들"(관계)로도 "홍*동"(예금주)으로도 불릴 수 있어 이름이 여럿이다.)
// 확신이 서지 않으면 null 을 돌려준다 — 잘못 짚은 실행보다 멈추는 편이 항상 낫다.
function matchByName(hint, list, namesOf) {
  const h = String(hint).replace(/\s+/g, "");
  if (!h) return null;

  // ① 토큰 포함 검사를 먼저 한다.
  // 고객은 정식 명칭의 가운데를 자주 빼먹는다 — "고유가 [유류비] 지원금".
  // 그러면 연속 부분문자열은 "고유가" 3글자뿐이라 비율(3/6=0.5)에서 탈락한다.
  // 임계값을 낮추면 예전에 잡은 오탐("전기요금"↔"KT통신요금")이 되살아나므로,
  // 대신 "고객이 말한 토막이 전부 이름 안에 있는가"를 따로 본다.
  // "전기요금"은 "KT통신요금"의 부분문자열이 아니므로 이 경로로 새지 않는다.
  const tokens = String(hint).split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length) {
    const covered = list.filter((item) =>
      namesOf(item).some((raw) => {
        if (!raw) return false;
        const name = String(raw).replace(/\s+/g, "");
        return tokens.every((t) => name.includes(t));
      })
    );
    if (covered.length === 1) return covered[0];
    // 여럿이 걸리면 어느 쪽인지 확신할 수 없다 — ② 로 넘겨 점수로 가린다.
  }

  // ② 연속 부분문자열 점수
  const scored = list.map((item) => {
    let score = 0;
    let matchedLen = 0;
    for (const raw of namesOf(item)) {
      if (!raw) continue;
      const name = String(raw).replace(/\s+/g, "");
      const s = longestCommonSubstringLength(h, name);
      if (s > score) {
        score = s;
        matchedLen = name.length;
      }
    }
    return { item, score, matchedLen };
  });

  const bestScore = scored.reduce((m, s) => Math.max(m, s.score), 0);
  if (bestScore < MIN_SCORE) return null;

  const top = scored.filter((s) => s.score === bestScore);
  if (top.length !== 1) return null; // 동점이면 어느 쪽인지 확신할 수 없다 — 진행하지 않는다

  const best = top[0];
  if (bestScore / Math.min(h.length, best.matchedLen) < MIN_RATIO) return null;
  return best.item;
}

// LLM은 내부 ID를 알 수 없다. 이름 힌트를 실제 항목으로 바꾸는 일은
// 개인정보를 다루므로 LLM 경계 밖(여기)에서 한다.
export function resolveAutopay({ autopay_id, name_hint } = {}) {
  const list = KB_DATA.bank.autopays;

  // 명시적 id가 주어졌다면 그것만 신뢰한다. 존재하지 않는 id는 여기서 바로 실패해야 한다 —
  // name_hint로 슬쩍 폴백하면 "잘못된 id인데 그럴듯한 이름이라 우연히 맞았다"는 사고가 난다.
  if (autopay_id) {
    return list.find((a) => a.id === autopay_id) ?? null;
  }

  if (name_hint) return matchByName(name_hint, list, (a) => [a.name]);
  return null;
}

// 이체 수취인 해석. 계좌번호·예금주는 LLM에 한 번도 가지 않는다 —
// LLM은 "아들" 같은 관계 라벨만 힌트로 넘기고, 실제 계좌는 여기서만 붙는다.
//   use_last_recipient — "최근에 이체한 계좌에 보내줘" 처럼 지시대명사로 부를 때 쓴다.
export function resolveRecipient({ contact_id, recipient_hint, use_last_recipient } = {}) {
  const list = KB_DATA.bank.contacts;

  if (contact_id) return list.find((c) => c.id === contact_id) ?? null;

  if (use_last_recipient) {
    const last = KB_DATA.bank.transfers[0]; // transfers 는 최신순으로 유지한다
    return last ? (list.find((c) => c.id === last.contactId) ?? null) : null;
  }

  if (recipient_hint) return matchByName(recipient_hint, list, (c) => [c.label, c.holder]);
  return null;
}

// 지원금 해석. 고객은 "고유가 지원금"처럼 정식 명칭의 일부만 말한다.
export function resolveSubsidy({ subsidy_id, name_hint } = {}) {
  const list = KB_DATA.card.subsidies;
  if (subsidy_id) return list.find((s) => s.id === subsidy_id) ?? null;
  if (name_hint) return matchByName(name_hint, list, (s) => [s.name]);
  return null;
}

// 카드 해석. 고객은 내부 id 를 모르고 "톡톡카드"처럼 부른다.
export function resolveCard({ card_id, name_hint } = {}) {
  const list = KB_DATA.card.cards;
  if (card_id) return list.find((c) => c.id === card_id) ?? null;
  if (name_hint) return matchByName(name_hint, list, (c) => [c.name, `****${c.last4}`]);
  return null;
}

// 할부 해석. 고객은 "노트북 할부"처럼 가맹점 이름으로 부른다.
export function resolveInstallment({ installment_id, name_hint } = {}) {
  const list = KB_DATA.card.installments;
  if (installment_id) return list.find((i) => i.id === installment_id) ?? null;
  if (name_hint) return matchByName(name_hint, list, (i) => [i.merchant]);
  // 진행 중인 할부가 하나뿐이면 그것을 가리킨 것이 분명하다.
  return list.length === 1 ? list[0] : null;
}

// 이체 출금 계좌. 지정이 없으면 주거래 입출금 계좌를 쓴다.
export function fromAccount(accountId) {
  const list = KB_DATA.bank.accounts;
  if (accountId) return list.find((a) => a.id === accountId) ?? null;
  return list.find((a) => a.type === "입출금") ?? null;
}

export async function analyzeImpact(toolName, args) {
  if (toolName === "cancel_autopay" || toolName === "change_autopay_account") {
    const ap = resolveAutopay(args);
    if (!ap) {
      return { warnings: [], blocked: true, reason: "해당 자동이체를 확인할 수 없어 진행하지 않습니다." };
    }
    if (toolName === "cancel_autopay") {
      return { warnings: [ap.impactIfCancelled], blocked: false };
    }
    // (M3) 계좌 변경도 해지 못지않게 부수효과가 있다 — 출금일에 새 계좌 잔액이
    // 부족하면 같은 방식으로 납부가 실패한다. 스펙 §5-1②가 이 분기를 명시한다.
    const acc = KB_DATA.bank.accounts.find((x) => x.id === args.account_id);
    const accName = acc?.name ?? "새 계좌";
    return {
      warnings: [`${accName}(으)로 변경하면, 출금일에 ${accName} 잔액이 부족할 경우 ${ap.name} 납부가 실패할 수 있습니다.`],
      blocked: false,
    };
  }

  if (toolName === "change_installment") {
    const inst = resolveInstallment(args);
    if (!inst) {
      return { warnings: [], blocked: true, reason: "어느 할부 건인지 확인할 수 없습니다. 가맹점 이름을 말씀해 주세요." };
    }
    return {
      warnings: [`할부 기간을 늘리면 수수료가 추가됩니다. 현재 적용 요율 ${inst.feeRate}.`],
      blocked: false,
    };
  }

  // 이체는 이 서비스에서 가장 위험한 실행이다 — 나간 돈은 되돌리기 어렵다.
  // 수취인·금액·잔액 중 하나라도 확신이 없으면 계획 자체를 만들지 않는다.
  if (toolName === "transfer_money") {
    const to = resolveRecipient(args);
    if (!to) {
      return { warnings: [], blocked: true, reason: "받는 분을 확정할 수 없어 진행하지 않습니다. 누구에게 보낼지 다시 말씀해 주세요." };
    }
    const amount = Number(args?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { warnings: [], blocked: true, reason: "보낼 금액을 확인할 수 없어 진행하지 않습니다. 얼마를 보낼지 말씀해 주세요." };
    }
    const from = fromAccount(args?.account_id);
    if (!from) {
      return { warnings: [], blocked: true, reason: "출금 계좌를 확인할 수 없어 진행하지 않습니다." };
    }
    if (from.balance < amount) {
      return {
        warnings: [],
        blocked: true,
        reason: `${from.name} 잔액이 부족합니다. 현재 잔액으로는 보낼 수 없어 진행하지 않습니다.`,
      };
    }

    const warnings = ["이체는 실행 후 취소·반환이 어렵습니다. 받는 분과 금액을 다시 확인하세요."];
    if (to.bank !== "KB국민은행") warnings.push(`${to.bank} 계좌로 보냅니다. 타행 이체는 수수료가 붙을 수 있습니다.`);
    if (amount >= 1_000_000) warnings.push("100만원 이상 이체는 지연이체·보이스피싱 확인 대상일 수 있습니다.");
    return { warnings, blocked: false };
  }

  // 명세서 내보내기는 돈이 움직이지 않지만, 파일 자체가 개인정보 덩어리다.
  if (toolName === "export_card_statement") {
    const card = KB_DATA.card.cards.find((c) => c.id === args?.card_id) ?? KB_DATA.card.cards[0];
    if (!card) {
      return { warnings: [], blocked: true, reason: "해당 카드를 확인할 수 없어 진행하지 않습니다." };
    }
    return {
      warnings: ["명세서 파일에는 가맹점명과 결제 일시가 그대로 담깁니다. 받는 곳을 확인하세요."],
      blocked: false,
    };
  }

  if (toolName === "apply_subsidy") {
    const sb = resolveSubsidy(args);
    if (!sb) {
      return { warnings: [], blocked: true, reason: "해당 지원금을 확인할 수 없어 진행하지 않습니다." };
    }
    if (!sb.eligible) {
      return { warnings: [], blocked: true, reason: `${sb.name}은(는) 신청 대상이 아닙니다. (${sb.basis})` };
    }
    const warnings = [];
    if (sb.requires) warnings.push(`신청 후 ${sb.requires}을(를) 별도로 제출해야 지급됩니다.`);
    if (sb.deadline) warnings.push(`신청 마감은 ${sb.deadline}입니다.`);
    return { warnings, blocked: false };
  }

  // 서류 발급. 여기에 분기가 없어서 name 이 비어 있어도 계획이 만들어졌고,
  // "undefined 발급을 진행합니다." 라는 계획이 지문 버튼까지 갔다가 실행에서
  // 터졌다(실측). "모르면 진행하지 않는다"가 이 도구에만 빠져 있었다.
  if (toolName === "issue_certificate" || toolName === "issue_sec_tax_document") {
    const wanted = args?.name;
    if (!wanted) {
      return { warnings: [], blocked: true, reason: "어떤 서류가 필요하신지 말씀해 주세요." };
    }
    const here = toolName === "issue_certificate" ? KB_DATA.bank.certificates : KB_DATA.sec.taxDocs;
    if (here.some((d) => d.name === wanted)) return { warnings: [], blocked: false };

    // 같은 서류가 계열사마다 이름이 다르다. 다른 쪽에 있으면 어디인지 알려준다 —
    // "발급할 수 없습니다"로 끝내면 고객은 다시 헤맨다.
    const elsewhere =
      toolName === "issue_certificate"
        ? KB_DATA.sec.taxDocs.find((d) => d.name === wanted) && "KB증권"
        : KB_DATA.bank.certificates.find((d) => d.name === wanted) && "KB국민은행";
    return {
      warnings: [],
      blocked: true,
      reason: elsewhere
        ? `${wanted}은(는) ${elsewhere}에서 발급하는 서류입니다. 그쪽으로 신청해 드릴까요?`
        : `${wanted}은(는) 발급 목록에서 찾지 못했습니다. 어떤 서류인지 다시 말씀해 주세요.`,
    };
  }

  if (toolName === "report_lost_card") {
    const c = resolveCard(args);
    if (!c) {
      return { warnings: [], blocked: true, reason: "어느 카드인지 확인할 수 없습니다. 카드 이름을 말씀해 주세요." };
    }
    return {
      warnings: [`${c.name} 사용이 즉시 정지됩니다. 이 카드로 걸어둔 자동납부도 함께 실패할 수 있습니다.`],
      blocked: false,
    };
  }

  if (toolName === "change_transfer_limit") {
    return {
      warnings: ["이체한도 증액은 보이스피싱 피해 규모를 키울 수 있습니다. 필요한 만큼만 올리세요."],
      blocked: false,
    };
  }

  return { warnings: [], blocked: false };
}
