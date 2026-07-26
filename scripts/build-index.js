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
const lifeEvents = JSON.parse(readFileSync("data/life-events.json", "utf8"));

// 오타 난 메뉴 ID는 조용히 아무 일도 하지 않는다 — 그러면 구멍을 메운 줄 알고 넘어간다.
// 여기서 즉시 실패시킨다. ("_" 로 시작하는 키는 주석이므로 건너뛴다.)
const menuIds = new Set(menus.map((m) => m.id));
const badIds = Object.keys(lifeEvents).filter((k) => !k.startsWith("_") && !menuIds.has(k));
if (badIds.length) {
  throw new Error(`data/life-events.json에 존재하지 않는 메뉴 ID: ${badIds.join(", ")}`);
}

const docs = menus.map((m) => {
  const { train, test } = splitVariants(utter[m.id] ?? []);
  return { node: m, text: buildIndexText(m, train, lifeEvents[m.id] ?? []), test };
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

// 생활사건 발화는 자기 벡터를 하나씩 더 갖는다.
//
// 메뉴 하나에 벡터 하나만 두면, 발화 12개를 한 문서로 뭉친 평균 벡터가 흐려진다.
// 그래서 "애 낳았는데 통장 하나 만들어주고 싶어"가 「우리 아이를 위한」이 아니라
// 짧아서 신호가 진한 「통장사본」으로 갔다(실측). 큐레이션한 60여 개 발화에만
// 개별 벡터를 주면 이 문제가 사라진다 — 인덱스는 2% 커지고, 검색은 정확해진다.
// 같은 메뉴가 후보에 중복으로 뜨는 건 menu-router.js 의 search()가 걷어낸다.
const eventDocs = [];
for (const [menuId, says] of Object.entries(lifeEvents)) {
  if (menuId.startsWith("_")) continue;
  const node = menus.find((m) => m.id === menuId);
  for (const say of says) eventDocs.push({ node, text: say });
}
for (let i = 0; i < eventDocs.length; i += BATCH) {
  const chunk = eventDocs.slice(i, i + BATCH);
  const vecs = await embed(chunk.map((d) => d.text));
  chunk.forEach((d, k) => {
    const { q, scale } = quantizeVector(vecs[k]);
    items.push({ ...d.node, scale, q: Array.from(q) });
  });
}
console.log(`생활사건 발화 벡터 ${eventDocs.length}건 추가`);

writeFileSync("data/index.json", JSON.stringify({ dim: DIM, items }), "utf8");
writeFileSync("data/heldout.json", JSON.stringify(heldOut), "utf8");
console.log(`저장 data/index.json — ${items.length}건`);
console.log(`저장 data/heldout.json — 시험 대상 ${Object.keys(heldOut).length}건`);
