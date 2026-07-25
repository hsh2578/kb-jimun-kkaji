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

// LLM은 내부 ID를 알 수 없다. 이름 힌트를 실제 항목으로 바꾸는 일은
// 개인정보를 다루므로 LLM 경계 밖(여기)에서 한다.
export function resolveAutopay({ autopay_id, name_hint } = {}) {
  const list = KB_DATA.bank.autopays;

  // 명시적 id가 주어졌다면 그것만 신뢰한다. 존재하지 않는 id는 여기서 바로 실패해야 한다 —
  // name_hint로 슬쩍 폴백하면 "잘못된 id인데 그럴듯한 이름이라 우연히 맞았다"는 사고가 난다.
  if (autopay_id) {
    return list.find((a) => a.id === autopay_id) ?? null;
  }

  if (name_hint) {
    const hint = String(name_hint).replace(/\s+/g, "");
    if (!hint) return null;

    const scored = list.map((a) => ({
      a,
      score: longestCommonSubstringLength(hint, a.name.replace(/\s+/g, "")),
    }));
    const bestScore = scored.reduce((m, s) => Math.max(m, s.score), 0);
    if (bestScore < MIN_SCORE) return null;

    const top = scored.filter((s) => s.score === bestScore);
    if (top.length !== 1) return null; // 동점이면 어느 쪽인지 확신할 수 없다 — 진행하지 않는다

    const best = top[0].a;
    const minLen = Math.min(hint.length, best.name.replace(/\s+/g, "").length);
    if (bestScore / minLen < MIN_RATIO) return null;

    return best;
  }
  return null;
}

export async function analyzeImpact(toolName, args) {
  if (toolName === "cancel_autopay" || toolName === "change_autopay_account") {
    const ap = resolveAutopay(args);
    if (!ap) {
      return { warnings: [], blocked: true, reason: "해당 자동이체를 확인할 수 없어 진행하지 않습니다." };
    }
    return {
      warnings: toolName === "cancel_autopay" ? [ap.impactIfCancelled] : [],
      blocked: false,
    };
  }

  if (toolName === "change_installment") {
    const inst = KB_DATA.card.installments.find((i) => i.id === args.installment_id);
    if (!inst) {
      return { warnings: [], blocked: true, reason: "해당 할부 건을 확인할 수 없어 진행하지 않습니다." };
    }
    return {
      warnings: [`할부 기간을 늘리면 수수료가 추가됩니다. 현재 적용 요율 ${inst.feeRate}.`],
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
