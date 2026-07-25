// 전체 커버리지 측정. 미커버 목록을 반드시 남긴다 — 없으면 보강이 불가능하다.
//   실행: OPENAI_KEY=sk-... node scripts/eval-coverage.js
import { readFileSync, writeFileSync } from "node:fs";
import { createRouter } from "../src/router/menu-router.js";
import { evaluateCoverage } from "../src/eval/coverage.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const heldOut = JSON.parse(readFileSync("data/heldout.json", "utf8"));

const cache = new Map();
async function embedFn(text) {
  if (cache.has(text)) return cache.get(text);
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text, dimensions: index.dim }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const json = await res.json();
  const v = Float32Array.from(json.data[0].embedding);
  cache.set(text, v);
  return v;
}

const router = createRouter({ items: index.items, dim: index.dim, embedFn });
const report = await evaluateCoverage({
  router, heldOut,
  onProgress: (i, n) => { if (i % 50 === 0) console.log(`${i}/${n}`); },
});

const pct = (x) => (report.total ? ((x / report.total) * 100).toFixed(1) : "0.0");
console.log(`\n총 시험 발화 ${report.total}`);
console.log(`Top-1 ${report.top1} (${pct(report.top1)}%)`);
console.log(`Top-3 ${report.top3} (${pct(report.top3)}%)`);
console.log(`계열사 오분류 ${report.affiliateError} (${pct(report.affiliateError)}%)`);
console.log(`미커버 ${report.misses.length}건 — data/coverage-report.json 참조`);

writeFileSync("data/coverage-report.json", JSON.stringify(report, null, 2), "utf8");
