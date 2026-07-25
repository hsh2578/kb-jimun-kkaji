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

// LLM은 내부 ID를 알 수 없다. 이름 힌트를 실제 항목으로 바꾸는 일은
// 개인정보를 다루므로 LLM 경계 밖(여기)에서 한다.
export function resolveAutopay({ autopay_id, name_hint } = {}) {
  const list = KB_DATA.bank.autopays;
  if (autopay_id) {
    const byId = list.find((a) => a.id === autopay_id);
    if (byId) return byId;
  }
  if (name_hint) {
    const hint = String(name_hint).replace(/\s+/g, "");
    if (!hint) return null;
    let best = null;
    let bestScore = 0;
    for (const a of list) {
      const name = a.name.replace(/\s+/g, "");
      const score = longestCommonSubstringLength(hint, name);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    // 2글자 미만의 우연한 일치는 오해를 부를 수 있어 매칭으로 인정하지 않는다.
    return bestScore >= 2 ? best : null;
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
