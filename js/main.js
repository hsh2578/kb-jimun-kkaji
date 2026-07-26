// 진입점. data/index.json이 아직 없어도(백그라운드 생성 중) 화면은 죽지 않는다.
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { createWebAuthnProvider, verifyAuthProof, createFallbackProof } from "../src/auth/webauthn.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { createUI } from "./ui.js";

const cfg = window.KB_CONFIG ?? { mode: "rules" };

let index = { items: [], dim: 0 };
let indexReady = true;
try {
  const res = await fetch("./data/index.json");
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  index = await res.json();
} catch {
  indexReady = false;
}

const llm = createLLMAdapter({
  kind: cfg.mode === "proxy" ? "proxy" : "stub",
  proxyUrl: cfg.proxyUrl ?? "",
});

const embedCache = new Map();
async function embedFn(text) {
  if (embedCache.has(text)) return embedCache.get(text);
  const v = await llm.embed(text);
  embedCache.set(text, v);
  return v;
}

const router = createRouter({ items: index.items ?? [], dim: index.dim, embedFn });
// AuthGate는 기본값이 fail-closed다 — verifyAuthProof를 명시적으로 주입해야만
// (그리고 그 검증을 통과하는 proof를 받아야만) 토큰을 낸다.
const authGate = createAuthGate({ verifyProof: verifyAuthProof });
const webauthn = createWebAuthnProvider();
const orchestrator = createOrchestrator({
  router, llm, authGate,
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS },
});

const history = [];
const ui = createUI(document.getElementById("app"), {
  onSend: async (text) => {
    const r = await orchestrator.handle(text, history);
    history.push({ role: "user", content: text });
    // assistant 턴은 반드시 남긴다 — 도구만 호출하고 텍스트가 없어도 마찬가지다.
    // 빠뜨리면 이력이 기형이 되고 모델이 첫 턴 의도에 고정된다.
    history.push(orchestrator.historyTurn(r));
    ui.renderResult(r);
  },
  // 🔒 버튼이 부르는 지점. 발급(issue)과 소비(confirm) 사이에 실제 인증 세리머니가
  // 끼어 있다 — 예전에는 이 한 줄이 발급과 소비를 동시에 해서 인증을 검사할 자리가
  // 아예 없었다. isAvailable()이 거짓이면(심사 노트북 등) 대체 인증으로 정직하게
  // 넘어간다 — src/auth/webauthn.js 상단 고지 참고.
  onConfirm: async (planId) => {
    const proof = webauthn.isAvailable()
      ? await webauthn.authenticate(planId)
      : createFallbackProof(planId);
    const token = authGate.issue(planId, proof);
    const result = await orchestrator.confirm(planId, token);
    return { ...result, authProof: proof };
  },
});

if (!indexReady) {
  ui.renderNotice("메뉴 인덱스가 아직 준비되지 않았습니다");
}

ui.append("bot", `안녕하세요. 무엇을 도와드릴까요? (메뉴 ${router.size}건을 알고 있습니다)`);
