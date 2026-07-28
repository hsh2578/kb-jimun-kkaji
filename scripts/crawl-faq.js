// KB국민은행 고객센터 「자주찾는 질문」을 긁는다.
//
// 왜 필요한가: 되묻기 사례 40건은 내가 지어낸 것이라 '고객이 실제로 어떻게
// 묻는가'가 빠져 있다. FAQ 는 KB가 공개한 실제 고객 질문이다 — 합성이 아니다.
//
// 다만 FAQ 질문은 이미 잘 다듬어진 문장이다. 우리 문제는 '질문을 못 만드는
// 고객'이므로, 이 데이터는 그대로 쓰지 않고 '어떤 주제가 실제로 올라오는가'의
// 근거로 쓴다. 사례의 opening 을 지어낼 때 이 주제 분포를 따른다.
//
// 실행: node scripts/crawl-faq.js
import { writeFileSync } from "node:fs";

const BASE = "https://obank.kbstar.com/quics?page=";

// 상담분야 → 페이지 코드. FAQ 목차에서 그대로 뽑았다.
const CATEGORIES = {
  "예금상담": "C019772",
  "신탁/펀드상담": "C019773",
  "대출상담": "C019774",
  "청약상담": "C019775",
  "외환상담": "C019776",
  "myQ카드(금융IC카드)상담": "C019780",
  "퇴직연금상담": "C025066",
  "홈페이지": "C019791",
  "인터넷뱅킹 서비스": "C019795",
  "로그인관련": "C019807",
  "공동인증서": "C019799",
  "KB 에스크로 이체": "C019788",
  "KB mobile 서비스": "C019801",
  "자동화기기/제휴업무": "C019790",
  "폰뱅킹 서비스": "C019785",
};

// 태그를 걷어내고 줄 단위 텍스트로 만든다. 파서를 붙이지 않는 이유는
// 의존성 0 을 지키기 위해서다(tests/repo-hygiene.test.js 가 강제한다).
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 질문처럼 생긴 줄만 남긴다.
const LOOKS_LIKE_QUESTION =
  /[?？]\s*$|하나요|한가요|인가요|되나요|있나요|되는지|어떻게|무엇인가|뭔가요|가능한가|합니까|입니까|알고 싶|궁금/;

function pickQuestions(lines) {
  const out = [];
  for (const raw of lines) {
    // 목록 앞머리의 번호를 뗀다: "32\t주택청약..." → "주택청약..."
    const s = raw.replace(/^\d+\s*[.\t]?\s*/, "").trim();
    if (s.length < 10 || s.length > 140) continue;
    if (!LOOKS_LIKE_QUESTION.test(s)) continue;
    // 메뉴·안내 문구가 섞여 들어오는 것을 막는다.
    if (/로그인|바로가기|더보기|이전|다음 페이지|검색|목록/.test(s)) continue;
    // 모든 분야 페이지 상단에 같은 안내 문구가 있다 — 질문이 아니다.
    if (/궁금하신 문제를 가장 빨리/.test(s)) continue;
    out.push(s);
  }
  return [...new Set(out)];
}

const result = {};
let total = 0;

for (const [name, code] of Object.entries(CATEGORIES)) {
  try {
    const res = await fetch(BASE + code, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; kb-jimun-kkaji/0.1)" },
    });
    if (!res.ok) {
      console.log(`  ! ${name} — HTTP ${res.status}`);
      continue;
    }
    const qs = pickQuestions(toText(await res.text()));
    result[name] = qs;
    total += qs.length;
    console.log(`  ${name}  ${qs.length}건`);
  } catch (e) {
    console.log(`  ! ${name} — ${e.message}`);
  }
}

writeFileSync(
  "data/kb-faq.json",
  JSON.stringify(
    {
      _출처: "KB국민은행 고객센터 「자주찾는 질문」 (공개 페이지)",
      _수집: "scripts/crawl-faq.js",
      _용도: "되묻기 사례의 주제 분포 근거. 질문 문장 자체는 이미 다듬어져 있어 그대로 쓰지 않는다.",
      total,
      categories: result,
    },
    null,
    2
  ),
  "utf8"
);
console.log(`\n총 ${total}건 → data/kb-faq.json`);
