// LLM 경계. 이 선을 넘는 개인정보가 없음을 구조로 보장한다.

const PATTERNS = [
  { kind: "rrn", re: /\d{6}\s?-\s?\d{7}/g },
  { kind: "phone", re: /01[016789]-?\d{3,4}-?\d{4}/g },
  { kind: "account", re: /\d{3}-\d{2}-\d{6}/g },
  { kind: "card", re: /\d{4}-\d{4}-\d{4}-\d{4}/g },
];

export function scrubPII(text) {
  let out = String(text);
  const removed = [];
  for (const { kind, re } of PATTERNS) {
    if (re.test(out)) {
      removed.push(kind);
      out = out.replace(re, `[${kind}]`);
    }
    re.lastIndex = 0;
  }
  return { text: out, removed };
}

// LLM에 넘길 페이로드에 허용되지 않은 키가 있으면 즉시 실패시킨다.
const ALLOWED = new Set(["utterance", "history", "tools", "menuCandidates", "locale"]);

export function assertNoPII(payload) {
  for (const key of Object.keys(payload)) {
    if (!ALLOWED.has(key)) {
      throw new Error(`LLM 페이로드에 허용되지 않은 필드: ${key}`);
    }
  }
}
