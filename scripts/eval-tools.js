// 대형/소형 모델을 바꿔가며 도구 선택 정확도를 잰다. 배포된 프록시 없이 OpenAI API를 직접 호출한다.
//   실행: OPENAI_KEY=sk-... node scripts/eval-tools.js
//   소형 모델 대조: OPENAI_KEY=sk-... MODEL=gpt-3.5-turbo node scripts/eval-tools.js
import { readFileSync, writeFileSync } from "node:fs";
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { evaluateToolSelection } from "../src/eval/tool-eval.js";
import { CLARIFY, CLARIFY_TOOL } from "../src/tools/clarify.js";
import { buildSystemPrompt } from "../src/llm/system-prompt.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const MODEL = process.env.MODEL ?? "gpt-4o-mini";

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const cases = JSON.parse(readFileSync("data/eval-set.json", "utf8"));

// 임베딩 — 배치 호출 + 캐시. eval-relevance.js와 동일한 방식.
async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: index.dim }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  return (await res.json()).data.map((d) => Float32Array.from(d.embedding));
}

const cache = new Map();
const texts = [...new Set(cases.map((c) => c.utterance))];
for (let i = 0; i < texts.length; i += 200) {
  const chunk = texts.slice(i, i + 200);
  const vecs = await embedBatch(chunk);
  chunk.forEach((t, k) => cache.set(t, vecs[k]));
}
const embedFn = async (t) => cache.get(t) ?? (await embedBatch([t]))[0];

const router = createRouter({ items: index.items, dim: index.dim, embedFn });

// 프롬프트는 src/llm/system-prompt.js 하나만 쓴다.
// 예전에는 여기에 복사해뒀는데, 본체가 바뀌어도 이 사본은 그대로여서
// '실제와 다른 프롬프트'를 재고 있었다. 사본을 지운다.

const llm = {
  async chat(payload) {
    const { utterance, history = [], tools = [], menuCandidates = [] } = payload;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(menuCandidates) },
          ...history,
          { role: "user", content: utterance },
        ],
        tools: tools.length ? tools : undefined,
        max_tokens: 800,
      }),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const msg = json.choices?.[0]?.message ?? {};
    return {
      message: msg.content ?? "",
      toolCalls: (msg.tool_calls ?? []).map((t) => ({
        id: t.id,
        name: t.function.name,
        args: JSON.parse(t.function.arguments || "{}"),
      })),
    };
  },
};

const orchestrator = createOrchestrator({
  router, llm, authGate: createAuthGate(),
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS, [CLARIFY]: CLARIFY_TOOL },
});

const report = await evaluateToolSelection({ cases, orchestrator });
const pct = (ok, total) => (total ? ((ok / total) * 100).toFixed(1) : "0.0");

console.log(`\n모델 ${MODEL}`);
console.log(`전체 도구 선택 정확도 ${report.toolOk}/${report.total} (${pct(report.toolOk, report.total)}%)`);
for (const [level, v] of Object.entries(report.byLevel).sort()) {
  console.log(`  ${level}  ${v.ok}/${v.total} (${pct(v.ok, v.total)}%)`);
}

writeFileSync("data/tool-eval-report.json", JSON.stringify({ model: MODEL, ...report }, null, 2), "utf8");
console.log("저장 data/tool-eval-report.json");
