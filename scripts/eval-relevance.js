// 적합성 평가 — 엄격한 ID 일치가 과소평가하는 부분을 보정한다.
//
// 문제: 발화 하나에 대해 타당한 메뉴가 2,656개 중 여러 개일 수 있다.
//   "퇴직금 관리 어떻게 하죠?" → 은행 퇴직연금 / 증권 퇴직연금 / IRP …
//   ID 완전일치만 정답으로 치면 타당한 대안이 전부 오답이 된다.
//
// 그래서 두 숫자를 함께 낸다:
//   ① 엄격 지표(ID 일치)  — eval-coverage.js. 하한선.
//   ② 적합성 지표(본 스크립트) — 독립 LLM 심판이 "이 메뉴가 이 질문의 타당한 답인가"를 판정.
// 심판은 기대 메뉴가 무엇인지 모른 채 판정하므로 우리 쪽에 유리하게 기울지 않는다.
//
//   실행: OPENAI_KEY=sk-... node scripts/eval-relevance.js [표본수]
import { readFileSync, writeFileSync } from "node:fs";
import { createRouter } from "../src/router/menu-router.js";
import { AFFILIATE_NAME } from "../src/menu/utterance.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const SAMPLE = Number(process.argv[2] ?? 200);
const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const heldOut = JSON.parse(readFileSync("data/heldout.json", "utf8"));

// 결정론적 표본 — 재현 가능해야 한다 (Math.random 금지)
const pairs = [];
for (const [id, utts] of Object.entries(heldOut)) {
  for (const u of utts) pairs.push({ id, utterance: u });
}
const stride = Math.max(1, Math.floor(pairs.length / SAMPLE));
const sample = pairs.filter((_, i) => i % stride === 0).slice(0, SAMPLE);
console.log(`전체 ${pairs.length}건 중 ${sample.length}건 표본 (stride ${stride})`);

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
const texts = [...new Set(sample.map((s) => s.utterance))];
for (let i = 0; i < texts.length; i += 200) {
  const chunk = texts.slice(i, i + 200);
  const vecs = await embedBatch(chunk);
  chunk.forEach((t, k) => cache.set(t, vecs[k]));
}
const router = createRouter({
  items: index.items, dim: index.dim,
  embedFn: async (t) => cache.get(t) ?? (await embedBatch([t]))[0],
});

// 라우팅 결과 수집
const rows = [];
for (const s of sample) {
  const got = await router.search(s.utterance, { topK: 3 });
  rows.push({ ...s, got });
}

// LLM 심판 — 기대 메뉴를 알려주지 않는다
function label(node) {
  return `[${AFFILIATE_NAME[node.affiliate] ?? node.affiliate}] ${[...node.path, node.name].join(" > ")}`;
}

let judged = 0, top1Ok = 0, top3Ok = 0;
const BATCH = 20;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const listing = chunk
    .map((r, k) => `${k + 1}. 질문: "${r.utterance}"\n   후보1: ${label(r.got[0])}\n   후보2: ${label(r.got[1])}\n   후보3: ${label(r.got[2])}`)
    .join("\n");

  const prompt =
    `너는 은행 앱의 메뉴 검색 품질을 평가하는 심사자다.\n` +
    `각 항목에서, 고객의 질문에 대해 후보 메뉴가 "고객을 올바른 곳으로 데려다주는가"를 판정하라.\n` +
    `완벽히 같은 메뉴가 아니어도, 그 메뉴로 가면 고객이 원하는 일을 할 수 있으면 타당한 것으로 본다.\n` +
    `질문 자체가 메뉴와 무관하거나 너무 막연해 어떤 메뉴로도 답할 수 없으면 unanswerable로 표시하라.\n\n` +
    `JSON만 출력. 형식: {"1":{"top1":true,"top3":true,"unanswerable":false}, "2":{...}}\n` +
    `top1 = 후보1이 타당한가. top3 = 후보1~3 중 하나라도 타당한가.\n\n${listing}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) { console.error(`판정 배치 ${i} 실패 ${res.status}`); continue; }
  let parsed;
  try { parsed = JSON.parse((await res.json()).choices[0].message.content); }
  catch { console.error(`판정 배치 ${i} 파싱 실패`); continue; }

  chunk.forEach((r, k) => {
    const v = parsed[String(k + 1)];
    if (!v) return;
    r.judge = v;
    if (v.unanswerable) return;   // 애초에 답할 수 없는 질문은 분모에서 뺀다
    judged++;
    if (v.top1) top1Ok++;
    if (v.top3) top3Ok++;
  });
  console.log(`  판정 ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}

const unanswerable = rows.filter((r) => r.judge?.unanswerable).length;
const pct = (x) => (judged ? ((x / judged) * 100).toFixed(1) : "0.0");
console.log(`\n표본 ${rows.length}  판정 가능 ${judged}  답할 수 없는 질문 ${unanswerable}`);
console.log(`적합성 Top-1 ${top1Ok} (${pct(top1Ok)}%)`);
console.log(`적합성 Top-3 ${top3Ok} (${pct(top3Ok)}%)`);

writeFileSync(
  "data/relevance-report.json",
  JSON.stringify({ sample: rows.length, judged, unanswerable, top1Ok, top3Ok, rows }, null, 2),
  "utf8"
);
console.log("저장 data/relevance-report.json");
