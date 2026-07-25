// 메뉴마다 사용자 발화 변형 8개를 LLM으로 생성한다.
//   실행: OPENAI_KEY=sk-... node scripts/gen-utterances.js
//   이미 생성된 메뉴는 건너뛴다(중단 후 재개 가능).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { AFFILIATE_NAME } from "../src/menu/utterance.js";

const KEY = process.env.OPENAI_KEY;
if (!KEY) throw new Error("OPENAI_KEY 환경변수가 필요합니다");

const menus = JSON.parse(readFileSync("data/menus.json", "utf8"));
const OUT = "data/utterances.json";
const store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const BATCH = 20;
const todo = menus.filter((m) => !store[m.id]);
console.log(`대상 ${todo.length} / 전체 ${menus.length}`);

for (let i = 0; i < todo.length; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const list = chunk
    .map((m, k) => `${k + 1}. [${AFFILIATE_NAME[m.affiliate]}] ${[...m.path, m.name].join(" > ")}`)
    .join("\n");

  const prompt =
    `아래는 금융 앱의 메뉴 목록이다. 각 메뉴에 대해, 그 메뉴를 찾는 실제 고객이 할 법한 말을 8개씩 만들어라.\n` +
    `조건:\n` +
    `- 메뉴명을 그대로 쓰지 마라. 고객은 메뉴 용어를 모른다.\n` +
    `- 구어체로. "통신비 자동으로 나가는 거 그만하고 싶어" 같은 톤.\n` +
    `- 8개 중 3개는 무엇이 필요한지도 모르는 막연한 표현으로.\n` +
    `- JSON만 출력. 형식: {"1":["...","..."],"2":[...]}\n\n${list}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 1,
    }),
  });
  if (!res.ok) {
    console.error(`배치 ${i} 실패 ${res.status} — 건너뜀`);
    continue;
  }
  const json = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(json.choices[0].message.content);
  } catch {
    console.error(`배치 ${i} JSON 파싱 실패 — 건너뜀`);
    continue;
  }

  chunk.forEach((m, k) => {
    const arr = parsed[String(k + 1)];
    if (Array.isArray(arr) && arr.length) store[m.id] = arr.map(String);
  });

  writeFileSync(OUT, JSON.stringify(store), "utf8");
  console.log(`진행 ${Object.keys(store).length}/${menus.length}`);
}

const total = Object.values(store).reduce((s, a) => s + a.length, 0);
console.log(`완료 — 메뉴 ${Object.keys(store).length}건, 발화 ${total}개`);
