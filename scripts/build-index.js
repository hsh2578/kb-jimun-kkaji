// 메뉴 문서를 임베딩해 data/index.json 을 만든다.
//   실행: OPENAI_KEY=sk-... node scripts/build-index.js
import { readFileSync, writeFileSync } from "node:fs";
import { buildIndexText, splitVariants } from "../src/menu/utterance.js";
import { quantizeVector } from "../src/menu/quantize.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const DIM = 256;
const menus = JSON.parse(readFileSync("data/menus.json", "utf8"));
const utter = JSON.parse(readFileSync("data/utterances.json", "utf8"));

const docs = menus.map((m) => {
  const { train, test } = splitVariants(utter[m.id] ?? []);
  return { node: m, text: buildIndexText(m, train), test };
});

async function embed(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => Float32Array.from(d.embedding));
}

const items = [];
const heldOut = {};
const BATCH = 100;
for (let i = 0; i < docs.length; i += BATCH) {
  const chunk = docs.slice(i, i + BATCH);
  const vecs = await embed(chunk.map((d) => d.text));
  chunk.forEach((d, k) => {
    const { q, scale } = quantizeVector(vecs[k]);
    items.push({ ...d.node, scale, q: Array.from(q) });
    if (d.test.length) heldOut[d.node.id] = d.test;
  });
  console.log(`임베딩 ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
}

writeFileSync("data/index.json", JSON.stringify({ dim: DIM, items }), "utf8");
writeFileSync("data/heldout.json", JSON.stringify(heldOut), "utf8");
console.log(`저장 data/index.json — ${items.length}건`);
console.log(`저장 data/heldout.json — 시험 대상 ${Object.keys(heldOut).length}건`);
