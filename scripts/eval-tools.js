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
import { AFFILIATE_NAME } from "../src/menu/utterance.js";

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

// api/chat.js가 실제로 반환하는 모양을 그대로 흉내내는 어댑터.
// api/chat.js의 시스템 프롬프트를 그대로 옮긴다 — 프록시 배포 없이 같은 결과를 재현하기 위함.
function buildSystemPrompt(menuCandidates) {
  return (
    "너는 KB 금융 앱의 실행형 에이전트다. 고객은 메뉴 용어를 모른다.\n" +
    "1) 무엇을 하려는지 파악하고, 모호하면 한 번에 하나씩 되묻는다.\n" +
    "2) 실행 가능한 도구가 있으면 호출한다. 없으면 아래 후보 메뉴 위치를 안내한다.\n" +
    "3) 금액·계좌번호를 지어내지 않는다. 도구 결과에 있는 값만 말한다.\n\n" +
    `후보 메뉴:\n${menuCandidates.map((m) => `- [${AFFILIATE_NAME[m.affiliate] ?? m.affiliate}] ${[...m.path, m.name].join(" > ")}`).join("\n")}`
  );
}

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
        name: t.function.name,
        args: JSON.parse(t.function.arguments || "{}"),
      })),
    };
  },
};

const orchestrator = createOrchestrator({
  router, llm, authGate: createAuthGate(),
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS },
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
