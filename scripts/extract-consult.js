// AI Hub 「금융분야 고객상담 데이터」에서 되묻기 사례를 뽑는다.
//
// 지금까지 쓰던 사례 64건은 내가 지어낸 것이라 '상담원이 실제로 무엇을 먼저
// 묻는가'가 빠져 있었다. 이 데이터에는 상담 녹취가 TX(상담사)/RX(고객)로
// 화자 구분되어 들어 있다 — 상담원의 첫 되물음이 그대로 남아 있다.
//
// 데이터: 과기정통부·NIA, 은행/증권/보험, 비식별 처리(●●● ★★ ▲▲ OO).
// 우리는 은행·증권만 쓴다(카드 업무는 은행 상담에 섞여 있다).
//
// 뽑는 것:
//   고객 첫 발화(RX 첫 줄) → 그 뒤 상담사가 처음 던진 질문(TX 의문문) → 주제
//
// 실행: node scripts/extract-consult.js <압축푼폴더> [...]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = process.argv.slice(2);
if (!ROOTS.length) throw new Error("압축 푼 폴더를 인자로 주세요");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".json")) out.push(p);
  }
  return out;
}

// 상담사가 되묻는 문장인가. 확인·요청형까지 포함한다 —
// 실제 상담은 "…맞으신가요?" "…알려주시겠어요?" 처럼 물음표 없이 끝나기도 한다.
const ASKS =
  /(무엇|어떤|어느|어디|언제|얼마|몇|누구).*(신가요|실까요|세요|시겠|나요|까요|죠)|알려주(시|실)|말씀해\s*주(시|실)|여쭤|확인해\s*주(시|실)/;

// 인사·안내·마무리는 되묻기가 아니다.
const NOT_ASK =
  /안녕하세|감사합니다|도와드릴까요|고객센터입니다|또 궁금|더 궁금|이용해 주셔|좋은 하루|상담|잠시만/;

// 전화 상담에만 있는 되묻기는 뺀다. 앱은 이미 로그인 상태라 본인확인이 없다.
// 이걸 넣으면 에이전트가 "성함과 생년월일을 말씀해 주세요"를 배운다 — 앱에서는 틀린 행동이다.
const PHONE_ONLY =
  /성함|생년월일|주민(등록)?번호|본인\s*확인|신분증|비밀번호를\s*입력|연락처를\s*(알려|말씀)|전화번호/;

// 안내·약속·사과는 되묻기가 아니다. 1차 필터를 빠져나온 것들을 여기서 잡는다.
const PROMISE =
  /안내해\s*드리|알려드리|발송해\s*드리|처리해\s*드리|죄송|양해|도와드리|확인해\s*보겠|연결해\s*드리/;

// 업무 슬롯을 묻는 것만 남긴다 — 이것이 우리가 배우려는 되묻기다.
const SLOT_ASK =
  /계좌|금액|얼마|기간|날짜|언제|카드|어떤\s*(것|상품|업무|서류|통화)|어느\s*(것|계좌|카드|은행)|몇\s*(개월|월|건)|통화|환전|한도|수량|종목/;

// 화자 라벨이 뒤바뀐 건이 섞여 있다 — 고객 발화 자리에 상담사 대사가 들어온 경우.
const AGENT_LINE =
  /고객센터입니다|도와드릴까요|저희\s*(은행|증권)|연락\s*주셔서\s*감사/;

function firstAsk(lines, afterIdx) {
  for (let i = afterIdx + 1; i < lines.length; i++) {
    const { who, text } = lines[i];
    if (who !== "TX") continue;
    if (NOT_ASK.test(text)) continue;
    if (PHONE_ONLY.test(text)) continue;
    if (PROMISE.test(text)) continue;
    if (!ASKS.test(text)) continue;
    if (!SLOT_ASK.test(text)) continue;
    if (text.length < 8 || text.length > 90) continue;
    return text;
  }
  return null;
}

function parse(content) {
  return String(content)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(TX|RX)\s+(.*)$/);
      return m ? { who: m[1], text: m[2].trim() } : null;
    })
    .filter(Boolean);
}

const rows = [];
const topics = new Map();
let files = 0;

for (const root of ROOTS) {
  for (const p of walk(root)) {
    files++;
    let d;
    try {
      d = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    const lines = parse(d?.source?.consulting_content ?? "");
    if (lines.length < 4) continue;

    const firstRx = lines.findIndex((l) => l.who === "RX");
    if (firstRx < 0) continue;
    const opening = lines[firstRx].text;
    if (opening.length < 6 || opening.length > 90) continue;
    // 화자 라벨이 어긋난 건은 버린다.
    if (AGENT_LINE.test(opening)) continue;

    const ask = firstAsk(lines, firstRx);
    if (!ask) continue;

    const topic = d?.consulting?.consulting_topic ?? "";
    const category = d?.consulting?.consulting_category ?? "";
    topics.set(topic, (topics.get(topic) ?? 0) + 1);

    rows.push({
      id: d?.source?.source_id ?? "",
      institution: d?.source?.source_institution ?? "",
      category, topic,
      purpose: d?.qa_data?.[0]?.consulting_purpose ?? "",
      situation: d?.qa_data?.[0]?.consulting_situation ?? "",
      opening, ask,
    });
  }
}

const top = [...topics.entries()].sort((a, b) => b[1] - a[1]);
console.log(`파일 ${files}건 → 되묻기 추출 ${rows.length}건`);
console.log("\n주제 상위 20:");
for (const [t, n] of top.slice(0, 20)) console.log(`  ${String(n).padStart(5)}  ${t}`);

writeFileSync(
  "data/consult-extracted.json",
  JSON.stringify(
    {
      _출처: "AI Hub 「금융분야 고객상담 데이터」 (과기정통부·NIA, 2025 구축) — 은행·증권",
      _추출: "scripts/extract-consult.js — 고객 첫 발화와 그 뒤 상담사의 첫 되물음",
      _비식별: "원본이 ●●●(금액) ★★(기관) ▲▲(타사) OO(계좌) 로 치환된 상태로 배포됨",
      files, total: rows.length,
      topics: Object.fromEntries(top),
      rows,
    },
    null,
    2
  ),
  "utf8"
);
console.log("\n저장 data/consult-extracted.json");
