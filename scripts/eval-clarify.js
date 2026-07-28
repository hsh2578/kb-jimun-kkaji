// 되묻기가 상담원처럼 되는지 잰다. 무엇을 주입했느냐를 바꿔가며 비교한다.
//
// 비교 대상(주입군):
//   ① 없음        — 규칙만 (지금까지의 프롬프트)
//   ② 합성 64건   — 내가 지어낸 사례
//   ③ 실제 300건  — AI Hub 「금융분야 고객상담 데이터」에서 뽑아 앱 맥락에 맞게 고른 것
//
// 시험 세트는 셋 모두에 같은 것을 쓰고, 주입한 것은 시험에서 뺀다.
// 주입한 사례로 시험하면 외운 것을 재는 셈이다(색인 발화도 같은 이유로
// 학습/시험을 반씩 갈랐다 — src/menu/utterance.js).
//
// 재는 것:
//   ① 되묻기 판정   — 되물어야 할 때 되묻고, 아닐 때는 안 묻는가
//   ② 첫 질문 슬롯  — 되물었다면 '무엇을' 먼저 물었는가
//
// 슬롯 일치는 낱말로 판정한다. LLM 심판을 쓰면 심판이 또 gpt-4o-mini 라
// 자기채점이 된다. 낱말 판정은 거칠지만 결정적이고 재현된다.
//
//   실행: OPENAI_KEY=sk-... node scripts/eval-clarify.js
import { readFileSync, writeFileSync } from "node:fs";

import { createAuthGate } from "../src/exec/auth-gate.js";
import { pickExamples } from "../src/llm/consult-examples.js";
import { buildSystemPrompt } from "../src/llm/system-prompt.js";
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { CLARIFY, CLARIFY_TOOL } from "../src/tools/clarify.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");
const MODEL = process.env.MODEL ?? "gpt-4o-mini";

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const SYNTH = JSON.parse(readFileSync("data/consult-scenarios.json", "utf8")).scenarios;
const REAL = JSON.parse(readFileSync("data/consult-real.json", "utf8")).scenarios;
const PRIORITY = JSON.parse(readFileSync("data/slot-priority.json", "utf8")).priority;

// 슬롯별로 '이 낱말이 있으면 그 슬롯을 물은 것'으로 본다.
const SLOT_WORDS = {
  to: ["어느 분", "누구", "어떤 분", "받는 분", "수취인", "누구에게", "누구한테"],
  amount: ["얼마", "금액", "몇 원"],
  card: ["어느 카드", "어떤 카드", "카드를"],
  item: ["어떤 것", "어느 것", "어떤 결제", "어떤 자동이체", "무엇을", "어떤 거래"],
  months: ["몇 개월", "개월"],
  account: ["어느 계좌", "어떤 계좌", "계좌를", "통장"],
  month: ["어느 달", "몇 월", "기간"],
  when: ["언제", "날짜", "일시", "며칠"],
  kind: ["어떤 용도", "무슨 서류", "어떤 서류", "어떤 방식", "어떤 종류"],
  currency: ["어떤 통화", "무슨 화폐"],
  subsidy: ["어떤 지원금", "어느 지원금", "지원금을"],
};

function slotOf(question) {
  const q = String(question);
  // 여러 낱말이 걸리면 '먼저 나온 것'을 택한다 — 한국어 의문문은 묻는 대상이 앞에 온다.
  let best = null;
  let bestAt = Infinity;
  for (const [slot, words] of Object.entries(SLOT_WORDS)) {
    for (const w of words) {
      const at = q.indexOf(w);
      if (at >= 0 && at < bestAt) { bestAt = at; best = slot; }
    }
  }
  return best;
}

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: index.dim }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  return (await res.json()).data.map((d) => Float32Array.from(d.embedding));
}

// 주입군에서 프롬프트에 실제로 들어가는 것만 골라 시험에서 뺀다.
const injSynth = new Set(pickExamples(SYNTH).map((s) => s.id));
const injReal = new Set(pickExamples(REAL).map((s) => s.id));

// 시험 세트 — 어느 주입군에도 들어가지 않은 것만.
const testSynth = SYNTH.filter((s) => !injSynth.has(s.id)).slice(0, 40);
const testReal = REAL.filter((s) => !injReal.has(s.id)).slice(0, 40);

const openings = [...new Set([...testSynth, ...testReal].map((s) => s.opening))];
const cache = new Map();
for (let i = 0; i < openings.length; i += 200) {
  const chunk = openings.slice(i, i + 200);
  const vecs = await embedBatch(chunk);
  chunk.forEach((t, k) => cache.set(t, vecs[k]));
}
const embedFn = async (t) => cache.get(t) ?? (await embedBatch([t]))[0];
const router = createRouter({ items: index.items, dim: index.dim, embedFn });

function makeOrchestrator(consultScenarios, slotPriority = {}) {
  const llm = {
    async chat({ utterance, history = [], tools = [], menuCandidates = [] }) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt(menuCandidates, consultScenarios, slotPriority) },
            ...history,
            { role: "user", content: utterance },
          ],
          tools: tools.length ? tools : undefined,
          max_tokens: 800,
          temperature: 0,
        }),
      });
      if (!res.ok) throw new Error(`upstream ${res.status}: ${await res.text()}`);
      const msg = (await res.json()).choices?.[0]?.message ?? {};
      return {
        message: msg.content ?? "",
        toolCalls: (msg.tool_calls ?? []).map((t) => ({
          id: t.id, name: t.function.name, args: JSON.parse(t.function.arguments || "{}"),
        })),
      };
    },
  };
  return createOrchestrator({
    router, llm, authGate: createAuthGate(),
    tools: { ...QUERY_TOOLS, ...ACTION_TOOLS, [CLARIFY]: CLARIFY_TOOL },
  });
}

async function run(arm, consultScenarios, cases, slotPriority = {}) {
  const orchestrator = makeOrchestrator(consultScenarios, slotPriority);
  let judgeOk = 0, slotOk = 0, askedCount = 0, shouldTotal = 0;
  const rows = [];

  for (const s of cases) {
    const shouldAsk = Boolean(s.asks?.length);
    let asked = null;
    try {
      const r = await orchestrator.handle(s.opening, []);
      const calls = r.audit?.calls ?? [];
      const call = calls.find((c) => c.name === CLARIFY);
      asked = call ? String(call.args?.question ?? "") : (r.layer === "ASK" ? r.message : null);
    } catch (e) {
      rows.push({ id: s.id, error: String(e.message).slice(0, 80) });
      continue;
    }
    const didAsk = Boolean(asked);
    if (didAsk === shouldAsk) judgeOk++;
    let got = null;
    if (shouldAsk) {
      shouldTotal++;
      if (didAsk) {
        askedCount++;
        got = slotOf(asked);
        if (got === s.asks[0].slot) slotOk++;
      }
    }
    rows.push({ id: s.id, opening: s.opening, shouldAsk, didAsk,
      want: shouldAsk ? s.asks[0].slot : null, got, asked });
  }
  return { arm, judgeOk, total: cases.length, askedCount, shouldTotal, slotOk, rows };
}

const ARMS = [
  ["① 없음 (규칙만)", [], {}],
  ["② 합성 64건", SYNTH, {}],
  ["③ 실제 문장 300건", REAL, {}],
  ["④ 합성 + 실제 순서통계", SYNTH, PRIORITY],
];
const SETS = [
  ["합성 시험 40건", testSynth],
  ["실제 시험 40건", testReal],
];

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0") + "%";
const out = [];

for (const [setName, cases] of SETS) {
  console.log(`\n${"━".repeat(58)}\n시험 세트: ${setName}`);
  for (const [armName, scen, prio] of ARMS) {
    const r = await run(armName, scen, cases, prio);
    out.push({ set: setName, ...r });
    console.log(`  ${armName.padEnd(20)} 판정 ${String(r.judgeOk).padStart(2)}/${r.total} (${pct(r.judgeOk, r.total).padStart(6)})`
      + `  물음 ${String(r.askedCount).padStart(2)}/${r.shouldTotal} (${pct(r.askedCount, r.shouldTotal).padStart(6)})`
      + `  슬롯 ${r.slotOk}/${r.askedCount}`);
  }
}

writeFileSync(
  "data/clarify-eval-report.json",
  JSON.stringify({ model: MODEL,
    injected: { synth: [...injSynth].length, real: [...injReal].length },
    tested: { synth: testSynth.length, real: testReal.length },
    results: out }, null, 2),
  "utf8"
);
console.log("\n저장 data/clarify-eval-report.json");
