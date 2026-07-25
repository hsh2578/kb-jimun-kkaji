// 전체 커버리지 측정. 미커버 목록을 반드시 남긴다 — 없으면 보강이 불가능하다.
//   실행: OPENAI_KEY=sk-... node scripts/eval-coverage.js
//         OPENAI_KEY=... VECTOR_WEIGHT=0.5 node scripts/eval-coverage.js   (가중치 튜닝)
//
// 시험 발화가 1만 건 규모라 단건 임베딩으로는 한 시간이 걸린다.
// 그래서 평가 전에 전량을 배치로 미리 임베딩해 캐시에 채워둔다.
// (라우터는 embedFn을 단건 인터페이스로 부르므로, 캐시가 그 간극을 흡수한다.)
import { readFileSync, writeFileSync } from "node:fs";
import { createRouter } from "../src/router/menu-router.js";
import { evaluateCoverage } from "../src/eval/coverage.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const heldOut = JSON.parse(readFileSync("data/heldout.json", "utf8"));

const cache = new Map();

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: index.dim }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => Float32Array.from(d.embedding));
}

// 평가에 쓰일 모든 발화를 미리 채운다.
const allUtterances = [...new Set(Object.values(heldOut).flat())];
const BATCH = 200;
console.log(`시험 발화 ${allUtterances.length}건 사전 임베딩 시작 (배치 ${BATCH})`);
for (let i = 0; i < allUtterances.length; i += BATCH) {
  const chunk = allUtterances.slice(i, i + BATCH);
  const vecs = await embedBatch(chunk);
  chunk.forEach((t, k) => cache.set(t, vecs[k]));
  console.log(`  임베딩 ${Math.min(i + BATCH, allUtterances.length)}/${allUtterances.length}`);
}

async function embedFn(text) {
  const hit = cache.get(text);
  if (hit) return hit;
  const [v] = await embedBatch([text]); // 캐시 미스는 사실상 없다
  cache.set(text, v);
  return v;
}

const vectorWeight = process.env.VECTOR_WEIGHT ? Number(process.env.VECTOR_WEIGHT) : undefined;
if (vectorWeight !== undefined) console.log(`가중치 실험: vector=${vectorWeight} lexical=${(1 - vectorWeight).toFixed(2)}`);
const router = createRouter({ items: index.items, dim: index.dim, embedFn, vectorWeight });
const report = await evaluateCoverage({
  router, heldOut,
  onProgress: (i, n) => { if (i % 200 === 0) console.log(`  평가 ${i}/${n}`); },
});

const pct = (x) => (report.total ? ((x / report.total) * 100).toFixed(1) : "0.0");
console.log(`\n총 시험 발화 ${report.total}`);
console.log(`Top-1 ${report.top1} (${pct(report.top1)}%)`);
console.log(`Top-3 ${report.top3} (${pct(report.top3)}%)`);
console.log(`계열사 오분류 ${report.affiliateError} (${pct(report.affiliateError)}%)`);
console.log(`미커버 ${report.misses.length}건 — data/coverage-report.json 참조`);

writeFileSync("data/coverage-report.json", JSON.stringify(report, null, 2), "utf8");
