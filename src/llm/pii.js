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

// 필드 이름만 허용 목록에 있다고 안전한 게 아니다 — 값 자체에 PII 패턴이
// 남아 있으면(예: 스크럽되지 않은 history) 여기서 잡아낸다.
function containsPII(text) {
  return PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

export function assertNoPII(payload) {
  for (const key of Object.keys(payload)) {
    if (!ALLOWED.has(key)) {
      throw new Error(`LLM 페이로드에 허용되지 않은 필드: ${key}`);
    }
  }

  if (typeof payload.utterance === "string" && containsPII(payload.utterance)) {
    throw new Error("LLM 페이로드의 utterance에 개인정보로 보이는 값이 남아 있습니다");
  }

  if (Array.isArray(payload.history)) {
    payload.history.forEach((turn, i) => {
      if (turn && typeof turn.content === "string" && containsPII(turn.content)) {
        throw new Error(`LLM 페이로드의 history[${i}].content에 개인정보로 보이는 값이 남아 있습니다`);
      }
    });
  }
}
