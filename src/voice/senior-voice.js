// 고령층 음성 6원칙
//   ① 한 번에 하나만 묻는다   ② 침묵을 기다린다      ③ 진행 전 동의를 구한다
//   ④ 숫자는 두 번 말한다     ⑤ 되풀이해 확인한다     ⑥ 실행은 기존 인증
// ChatGPT 음성 모드는 빠르고 자연스러운 대화가 목표지만,
// 고령층에게는 천천히·확인하며·반복하는 대화가 맞다. "창구 직원처럼"이다.

const MONEY = /\d{1,3}(?:,\d{3})+원|\d+원/g;

export function toSeniorSpeech(text) {
  return String(text).replace(MONEY, (m) => `${m}. ${m}`);
}

const ORDINAL = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째", "여섯 번째"];

export function chunkOneAtATime(items) {
  return items.map((it, i) => {
    const ord = ORDINAL[i] ?? `${i + 1} 번째`;
    const amount = it.amount != null ? `, ${Number(it.amount).toLocaleString("ko-KR")}원` : "";
    return toSeniorSpeech(`${ord}, ${it.name}${amount}.`);
  });
}

export function buildConfirmation({ verb, target, effect }) {
  return [
    `${target}을(를) ${verb}실까요?`,
    `${effect}.`,
    `맞으시면 "네"라고 말씀해 주세요.`,
  ].join(" ");
}

// 침묵 허용 시간 — 고령층은 반응이 느리다. 끊으면 대화가 무너진다.
export const SILENCE_TOLERANCE_MS = 3000;
