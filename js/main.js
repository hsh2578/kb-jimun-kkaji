// 진입점. data/index.json이 아직 없어도(백그라운드 생성 중) 화면은 죽지 않는다.
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
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
const authGate = createAuthGate();
const orchestrator = createOrchestrator({
  router, llm, authGate,
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS },
});

const history = [];
const ui = createUI(document.getElementById("app"), {
  onSend: async (text) => {
    const r = await orchestrator.handle(text, history);
    history.push({ role: "user", content: text });
    if (r.message) history.push({ role: "assistant", content: r.message });
    ui.renderResult(r);
  },
  onConfirm: async (planId) => orchestrator.confirm(planId, authGate.issue(planId)),
});

if (!indexReady) {
  ui.renderNotice("메뉴 인덱스가 아직 준비되지 않았습니다");
}

ui.append("bot", `안녕하세요. 무엇을 도와드릴까요? (메뉴 ${router.size}건을 알고 있습니다)`);
