# 「지문까지」 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KB 3사(은행·카드·증권) 전체 메뉴 2,655개를 라우팅하고 그중 대표 업무를 대신 실행하는 3계층 금융 에이전트를, 2026-08-03 16:00 마감에 맞춰 개인이 완성한다.

**Architecture:** 빌드 스텝 없는 바닐라 JS(ESM) 정적 사이트 + Vercel 서버리스 LLM 프록시. 오프라인 Node 스크립트가 메뉴를 크롤링하고 발화 변형을 생성해 임베딩 인덱스(int8 양자화)를 만들어 정적 파일로 배포하면, 브라우저가 하이브리드 검색(벡터+키워드)으로 라우팅한다. 개인정보는 LLM 경계 밖에 두고, 실행 함수는 AuthGate 토큰 없이 호출 불가능하게 만든다.

**Tech Stack:** Vanilla JS (ES Modules, 빌드 없음) / Node.js 20+ 내장 테스트 러너 `node --test` / Vercel Serverless Functions / OpenAI Chat + Embeddings API (어댑터 뒤에 격리) / GitHub Pages

## Global Constraints

- **기존 저장소 `hsh2578/im-ai-bank`는 어떤 경우에도 수정·푸시하지 않는다.** iM뱅크 공모전 제출 데모 링크가 그곳을 가리킨다. 신규 저장소에서만 작업한다.
- 신규 저장소 이름: `kb-jimun-kkaji`. 로컬 경로: `C:\Users\hsh\Desktop\공모전\kb-jimun-kkaji`
- **2026-08-03 16:00 이후 커밋 금지.** 대회 FAQ: "접수기간 이후 수정·변경 이력 확인 시 심사 대상 제외"
- **빌드 스텝을 도입하지 않는다.** 번들러·트랜스파일러 없이 브라우저가 ESM을 직접 로드한다.
- **테스트는 `node --test`만 사용한다.** Node 24 Windows에서 `node --test tests/`는 디렉터리를 모듈로 해석해 실패하므로, 인자 없는 `node --test`(자동 탐색)를 쓴다. 외부 테스트 의존성을 추가하지 않는다.
- **개인정보는 LLM 계층에 전달하지 않는다.** `Understander`/`ToolSelector`의 입력 타입에 계좌번호·잔액·성명 필드를 두지 않는다.
- **실행 함수는 AuthGate 토큰 없이 호출할 수 없다.** "조심한다"가 아니라 구조로 막는다.
- API 키는 Vercel 환경변수에만 존재한다. 저장소에 키를 커밋하지 않는다.
- 임베딩 차원은 **256**으로 고정한다(`text-embedding-3-small`, `dimensions: 256`). 인덱스는 **int8 양자화**하여 배포한다.
- 서비스명 표기는 **「지문까지」**, 과제명은 **「지문까지」 — 메뉴를 대신 걷는 실행형 AI 에이전트**로 통일한다.
- 모든 더미 데이터는 가상임을 화면과 코드 주석에 명시한다.
- **사용자 입력이나 도구 결과를 `innerHTML`에 넣지 않는다.** 정적 골격에만 `innerHTML`을 쓰고, 값은 반드시 `textContent`로 넣는다.

---

### Task 1: 신규 저장소 셋업과 KB 전환

**Files:**
- Create: `kb-jimun-kkaji/.gitignore`
- Create: `kb-jimun-kkaji/README.md`
- Create: `kb-jimun-kkaji/package.json`
- Create: `kb-jimun-kkaji/index.html`
- Create: `kb-jimun-kkaji/config.example.js`
- Test: `kb-jimun-kkaji/tests/repo-hygiene.test.js`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 저장소 루트 경로 `kb-jimun-kkaji/`, `package.json`의 `"type": "module"`, npm 스크립트 `test`

- [ ] **Step 1: 기존 저장소가 손대지지 않았음을 확인**

```bash
cd "/c/Users/hsh/Desktop/im뱅크 공모전/prototype"
git status --short
git log --oneline -1
```

Expected: 출력이 비어 있고(작업 트리 청결), 최신 커밋이 `2e3792e`.
이 확인 이후 이 디렉터리로 다시 들어가지 않는다.

- [ ] **Step 2: 신규 저장소 생성**

```bash
mkdir -p "/c/Users/hsh/Desktop/공모전/kb-jimun-kkaji"
cd "/c/Users/hsh/Desktop/공모전/kb-jimun-kkaji"
git init -b main
```

- [ ] **Step 3: `.gitignore` 작성**

```gitignore
config.local.js
.env
.env.local
.vercel/
node_modules/
data/raw/
*.log
```

- [ ] **Step 4: `package.json` 작성**

```json
{
  "name": "kb-jimun-kkaji",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "지문까지 — 메뉴를 대신 걷는 실행형 AI 에이전트",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 5: 위생 테스트를 작성 (실패 예상)**

`tests/repo-hygiene.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("package.json은 ESM이고 외부 의존성이 없다", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test(".gitignore가 비밀 파일을 제외한다", () => {
  const ig = readFileSync(".gitignore", "utf8");
  for (const p of ["config.local.js", ".env", ".vercel/"]) {
    assert.ok(ig.includes(p), `${p} 누락`);
  }
});

test("저장소에 iM 브랜딩이 남아 있지 않다", () => {
  const files = ["index.html", "README.md", "config.example.js"];
  for (const f of files) {
    assert.ok(existsSync(f), `${f} 없음`);
    const s = readFileSync(f, "utf8");
    assert.ok(!/iM뱅크|im-ai-bank|IM_CONFIG/.test(s), `${f}에 iM 흔적`);
  }
});
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `index.html 없음`

- [ ] **Step 7: `config.example.js` 작성**

```js
// 복사해서 config.local.js 로 쓰세요. config.local.js 는 커밋되지 않습니다.
window.KB_CONFIG = {
  mode: "rules",              // "rules" | "proxy"
  proxyUrl: "",               // 예: https://<project>.vercel.app/api
};
```

- [ ] **Step 8: `index.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>지문까지 — 메뉴를 대신 걷는 실행형 AI 에이전트</title>
  <link rel="stylesheet" href="./css/style.css" />
</head>
<body>
  <header>
    <h1>지문까지</h1>
    <p>말하면, 지문까지 데려다 드립니다</p>
  </header>
  <main id="app"></main>
  <footer>
    <small>본 화면의 모든 계좌·카드·거래 정보는 가상의 데모 데이터입니다.</small>
  </footer>
  <script src="./config.local.js" onerror="window.KB_CONFIG={mode:'rules'}"></script>
  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 9: `README.md` 작성**

```markdown
# 지문까지

2026 제8회 KB Future Finance A.I. Challenge 출품작
**「지문까지」 — 메뉴를 대신 걷는 실행형 AI 에이전트**

안내하지 않습니다. 대신 합니다.

## 구조

- L1 라우팅 — KB 3사 전체 메뉴 인덱스에서 "그건 여기 있습니다"
- L2 조회 — 데이터를 조합해 바로 답변
- L3 실행 — 부수효과 경고 후 본인 인증으로 실행

## 실행

정적 사이트입니다. 빌드가 필요 없습니다.

```
python -m http.server 8000
```

## 테스트

```
npm test
```

## 고지

모든 계좌·카드·거래 정보는 가상의 데모 데이터입니다.
```

- [ ] **Step 10: 빈 CSS와 진입점 스텁 생성**

`css/style.css`:

```css
:root { color-scheme: light dark; }
body { font-family: system-ui, -apple-system, "Malgun Gothic", sans-serif; margin: 0; }
header { padding: 1rem; }
main { padding: 1rem; }
footer { padding: 1rem; opacity: .7; }
```

`js/main.js`:

```js
// 진입점. 이후 태스크에서 오케스트레이터를 연결한다.
const app = document.getElementById("app");
app.textContent = "초기화됨";
```

- [ ] **Step 11: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 3 tests

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "chore: KB 전용 저장소 초기화 (지문까지)"
```

---

### Task 2: KB 3사 메뉴 크롤러와 정규화

**Files:**
- Create: `scripts/crawl-menus.js`
- Create: `src/menu/normalize.js`
- Test: `tests/normalize.test.js`
- Test fixture: `tests/fixtures/bank-menu.html`

**Interfaces:**
- Consumes: Task 1의 저장소 구조
- Produces:
  - `normalizeMenuNode({ affiliate, path, name }) -> MenuNode`
    - `MenuNode = { id: string, affiliate: "bank"|"card"|"sec", name: string, path: string[], depth: number, isAction: boolean, keywords: string[] }`
  - `parseMenuHtml(html, affiliate) -> MenuNode[]`
  - 산출 파일 `data/menus.json` — `MenuNode[]`

- [ ] **Step 1: 정규화 테스트 작성 (실패 예상)**

`tests/normalize.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMenuNode, parseMenuHtml } from "../src/menu/normalize.js";
import { readFileSync } from "node:fs";

test("normalizeMenuNode는 안정적인 id와 depth를 만든다", () => {
  const n = normalizeMenuNode({
    affiliate: "bank",
    path: ["개인뱅킹", "이체", "자동이체"],
    name: "자동이체내역 조회/해지/변경",
  });
  assert.equal(n.affiliate, "bank");
  assert.equal(n.depth, 4);
  assert.equal(n.isAction, true);
  assert.ok(n.id.startsWith("bank:"));
  assert.deepEqual(n.path, ["개인뱅킹", "이체", "자동이체"]);
});

test("동작 동사가 없는 메뉴는 isAction=false", () => {
  const n = normalizeMenuNode({ affiliate: "sec", path: ["금융상품"], name: "펀드몰" });
  assert.equal(n.isAction, false);
});

test("같은 입력은 같은 id를 낳는다", () => {
  const a = normalizeMenuNode({ affiliate: "card", path: ["카드이용"], name: "명세서조회" });
  const b = normalizeMenuNode({ affiliate: "card", path: ["카드이용"], name: "명세서조회" });
  assert.equal(a.id, b.id);
});

test("keywords는 슬래시와 괄호를 분해한다", () => {
  const n = normalizeMenuNode({
    affiliate: "bank", path: ["뱅킹관리"], name: "통장/인감분실 재발행",
  });
  assert.ok(n.keywords.includes("통장"));
  assert.ok(n.keywords.includes("인감분실"));
  assert.ok(n.keywords.includes("재발행"));
});

test("parseMenuHtml은 fixture에서 메뉴를 뽑는다", () => {
  const html = readFileSync("tests/fixtures/bank-menu.html", "utf8");
  const nodes = parseMenuHtml(html, "bank");
  assert.ok(nodes.length >= 3, `추출 ${nodes.length}건`);
  assert.ok(nodes.every((n) => n.affiliate === "bank"));
  assert.ok(nodes.some((n) => n.name.includes("자동이체")));
});
```

- [ ] **Step 2: fixture 작성**

`tests/fixtures/bank-menu.html`:

```html
<div class="menu">
  <h3>이체</h3>
  <ul>
    <li><a href="/quics?page=C001">계좌이체</a></li>
    <li><a href="/quics?page=C002">자동이체내역 조회/해지/변경</a></li>
    <li><a href="/quics?page=C003">자동이체 등록</a></li>
  </ul>
  <h3>뱅킹관리</h3>
  <ul>
    <li><a href="/quics?page=C010">예금잔액증명서</a></li>
    <li><a href="/quics?page=C011">통장/인감분실 재발행</a></li>
  </ul>
</div>
```

- [ ] **Step 3: 테스트 실행하여 실패 확인**

Run: `node --test tests/normalize.test.js`
Expected: FAIL — `Cannot find module '../src/menu/normalize.js'`

- [ ] **Step 4: `src/menu/normalize.js` 구현**

```js
// 메뉴 노드 정규화. 크롤러와 인덱서가 공유한다.

const ACTION_VERBS =
  /(조회|신청|변경|해지|발급|등록|납부|이체|가입|취소|재발행|재발급|설정|매수|매도|청약|출력|검증|제출)/;

// 화면 표기용 구분자를 낱말로 쪼갠다.
export function splitKeywords(name) {
  return name
    .split(/[/·,()\[\]{}]|\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export function normalizeMenuNode({ affiliate, path, name }) {
  const cleanPath = path.map((p) => p.trim()).filter(Boolean);
  const cleanName = name.replace(/\s+/g, " ").trim();
  const id = `${affiliate}:${[...cleanPath, cleanName].join(">")}`;
  return {
    id,
    affiliate,
    name: cleanName,
    path: cleanPath,
    depth: cleanPath.length + 1,
    isAction: ACTION_VERBS.test(cleanName),
    keywords: splitKeywords(cleanName),
  };
}

// 태그를 벗겨 <h3> 헤딩을 상위 경로로, <a> 텍스트를 잎으로 삼는다.
export function parseMenuHtml(html, affiliate) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");

  const nodes = [];
  const seen = new Set();
  let section = "";

  const token = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<a[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = token.exec(stripped)) !== null) {
    const heading = m[1] && text(m[1]);
    const link = m[2] && text(m[2]);
    if (heading) {
      section = heading;
      continue;
    }
    if (!link || link.length < 2 || link.length > 30) continue;
    const node = normalizeMenuNode({
      affiliate,
      path: section ? [section] : [],
      name: link,
    });
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  return nodes;
}

function text(fragment) {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#47;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 5: 테스트 실행하여 통과 확인**

Run: `node --test tests/normalize.test.js`
Expected: PASS — 5 tests

- [ ] **Step 6: 크롤러 작성**

`scripts/crawl-menus.js`:

```js
// KB 3사 메뉴 트리를 수집해 data/menus.json 으로 저장한다.
//   실행: node scripts/crawl-menus.js
//   네트워크가 막히면 data/raw/*.html 을 읽어 오프라인으로 동작한다.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { parseMenuHtml } from "../src/menu/normalize.js";

const SOURCES = [
  { affiliate: "bank", url: "https://obank.kbstar.com/quics?page=C030037&QSL=F", raw: "data/raw/bank.html" },
  { affiliate: "bank", url: "https://obank.kbstar.com/quics?page=C016535&QSL=F", raw: "data/raw/bank-mgmt.html" },
  { affiliate: "card", url: "https://card.kbcard.com/", raw: "data/raw/card.html" },
  { affiliate: "sec",  url: "https://www.kbsec.com/",  raw: "data/raw/sec.html" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140";

async function fetchOrCache({ url, raw }) {
  if (existsSync(raw)) return readFileSync(raw, "utf8");
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const html = await res.text();
  mkdirSync("data/raw", { recursive: true });
  writeFileSync(raw, html, "utf8");
  return html;
}

const all = new Map();
for (const src of SOURCES) {
  try {
    const html = await fetchOrCache(src);
    for (const node of parseMenuHtml(html, src.affiliate)) all.set(node.id, node);
    console.log(`${src.affiliate} ${src.url} -> 누적 ${all.size}`);
  } catch (e) {
    console.error(`실패 ${src.url}: ${e.message}`);
  }
}

const nodes = [...all.values()];
mkdirSync("data", { recursive: true });
writeFileSync("data/menus.json", JSON.stringify(nodes, null, 0), "utf8");
console.log(`저장 data/menus.json — ${nodes.length}건`);
console.log(
  "계열사별:",
  ["bank", "card", "sec"].map((a) => `${a}=${nodes.filter((n) => n.affiliate === a).length}`).join(" ")
);
```

- [ ] **Step 7: 크롤러 실행**

Run: `node scripts/crawl-menus.js`
Expected: `저장 data/menus.json — <N>건` 출력. N이 1,500 이상이면 성공.
1,500 미만이면 `data/raw/*.html`이 로그인 페이지로 대체된 것이므로, 브라우저로 해당 URL을 열어 `Ctrl+S`로 저장한 뒤 `data/raw/` 에 넣고 재실행한다.

- [ ] **Step 8: 커밋**

```bash
git add scripts/crawl-menus.js src/menu/normalize.js tests/normalize.test.js tests/fixtures/bank-menu.html data/menus.json
git commit -m "feat: KB 3사 메뉴 크롤러와 정규화"
```

---

### Task 3: 발화 변형 생성 (학습용 4 / 시험용 4)

**Files:**
- Create: `scripts/gen-utterances.js`
- Create: `src/menu/utterance.js`
- Test: `tests/utterance.test.js`

**Interfaces:**
- Consumes: `data/menus.json` (Task 2), `MenuNode` 타입
- Produces:
  - `splitVariants(variants) -> { train: string[], test: string[] }` — 짝수 인덱스는 train, 홀수 인덱스는 test
  - `buildIndexText(node, trainVariants) -> string` — 임베딩에 넣을 문서 텍스트
  - 산출 파일 `data/utterances.json` — `{ [menuId]: { train: string[], test: string[] } }`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/utterance.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitVariants, buildIndexText } from "../src/menu/utterance.js";

test("splitVariants는 학습/시험을 반씩 나눈다", () => {
  const v = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const { train, test: te } = splitVariants(v);
  assert.equal(train.length, 4);
  assert.equal(te.length, 4);
  // 겹치면 시험이 무의미해진다
  assert.equal(train.filter((x) => te.includes(x)).length, 0);
});

test("홀수 개여도 겹치지 않는다", () => {
  const { train, test: te } = splitVariants(["a", "b", "c"]);
  assert.equal(train.length + te.length, 3);
  assert.equal(train.filter((x) => te.includes(x)).length, 0);
});

test("buildIndexText는 경로·이름·학습변형을 한 문서로 합친다", () => {
  const node = {
    id: "bank:개인뱅킹>이체>자동납부 등록/해지",
    affiliate: "bank",
    name: "자동납부 등록/해지",
    path: ["개인뱅킹", "이체"],
  };
  const s = buildIndexText(node, ["통신비 자동으로 나가는 거 그만하고 싶어"]);
  assert.ok(s.includes("자동납부 등록/해지"));
  assert.ok(s.includes("개인뱅킹"));
  assert.ok(s.includes("통신비 자동으로"));
  assert.ok(s.includes("KB국민은행"));
});

test("buildIndexText는 계열사를 한국어 이름으로 쓴다", () => {
  const card = buildIndexText({ id: "x", affiliate: "card", name: "명세서조회", path: [] }, []);
  const sec = buildIndexText({ id: "y", affiliate: "sec", name: "잔고증명서발급", path: [] }, []);
  assert.ok(card.includes("KB국민카드"));
  assert.ok(sec.includes("KB증권"));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/utterance.test.js`
Expected: FAIL — `Cannot find module '../src/menu/utterance.js'`

- [ ] **Step 3: `src/menu/utterance.js` 구현**

```js
export const AFFILIATE_NAME = {
  bank: "KB국민은행",
  card: "KB국민카드",
  sec: "KB증권",
};

// 학습용과 시험용을 겹치지 않게 반으로 가른다.
// 인덱싱한 발화로 시험을 보면 항상 100%가 나오고, 그 숫자는 아무것도 증명하지 못한다.
export function splitVariants(variants) {
  const train = [];
  const test = [];
  variants.forEach((v, i) => (i % 2 === 0 ? train : test).push(v));
  return { train, test };
}

// 임베딩 문서 = 계열사 + 경로 + 메뉴명 + 학습 발화
export function buildIndexText(node, trainVariants) {
  const parts = [
    AFFILIATE_NAME[node.affiliate] ?? node.affiliate,
    ...node.path,
    node.name,
    ...trainVariants,
  ];
  return parts.join(" | ");
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/utterance.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: 생성 스크립트 작성**

`scripts/gen-utterances.js`:

```js
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
```

- [ ] **Step 6: 소규모로 먼저 검증**

Run:
```bash
node -e "import('node:fs').then(fs=>{const m=JSON.parse(fs.readFileSync('data/menus.json','utf8'));fs.writeFileSync('data/menus.full.json',JSON.stringify(m));fs.writeFileSync('data/menus.json',JSON.stringify(m.slice(0,40)))})"
OPENAI_KEY=$OPENAI_KEY node scripts/gen-utterances.js
```
Expected: `완료 — 메뉴 40건, 발화 320개`

- [ ] **Step 7: 전체 실행**

```bash
node -e "import('node:fs').then(fs=>fs.copyFileSync('data/menus.full.json','data/menus.json'))"
OPENAI_KEY=$OPENAI_KEY node scripts/gen-utterances.js
```
Expected: `완료 — 메뉴 <N>건, 발화 <8N>개`

- [ ] **Step 8: 커밋**

```bash
rm -f data/menus.full.json
git add scripts/gen-utterances.js src/menu/utterance.js tests/utterance.test.js data/utterances.json
git commit -m "feat: 메뉴별 사용자 발화 변형 8개 생성 (학습4/시험4)"
```

---

### Task 4: 임베딩 인덱스 구축과 int8 양자화

**Files:**
- Create: `scripts/build-index.js`
- Create: `src/menu/quantize.js`
- Test: `tests/quantize.test.js`

**Interfaces:**
- Consumes: `data/menus.json`, `data/utterances.json`, `buildIndexText`, `splitVariants`
- Produces:
  - `quantizeVector(Float32Array) -> { q: Int8Array, scale: number }`
  - `dequantizeVector({ q, scale }) -> Float32Array`
  - `cosine(Float32Array, Float32Array) -> number`
  - 산출 파일 `data/index.json` — `{ dim: 256, items: [{ id, affiliate, name, path, depth, isAction, keywords, scale, q: number[] }] }`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/quantize.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { quantizeVector, dequantizeVector, cosine } from "../src/menu/quantize.js";

test("양자화 후 복원해도 코사인 유사도가 거의 보존된다", () => {
  const a = Float32Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.37));
  const b = Float32Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.37 + 0.05));
  const before = cosine(a, b);
  const after = cosine(dequantizeVector(quantizeVector(a)), dequantizeVector(quantizeVector(b)));
  assert.ok(Math.abs(before - after) < 0.01, `before=${before} after=${after}`);
});

test("양자화 결과는 int8 범위 안에 있다", () => {
  const v = Float32Array.from({ length: 256 }, (_, i) => (i - 128) / 64);
  const { q } = quantizeVector(v);
  assert.equal(q.length, 256);
  for (const x of q) assert.ok(x >= -127 && x <= 127, `범위 밖 ${x}`);
});

test("같은 벡터의 코사인은 1이다", () => {
  const a = Float32Array.from({ length: 256 }, (_, i) => i % 7);
  assert.ok(Math.abs(cosine(a, a) - 1) < 1e-6);
});

test("영벡터는 0을 반환하고 NaN을 내지 않는다", () => {
  const z = new Float32Array(256);
  const a = Float32Array.from({ length: 256 }, () => 1);
  assert.equal(cosine(z, a), 0);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/quantize.test.js`
Expected: FAIL — `Cannot find module '../src/menu/quantize.js'`

- [ ] **Step 3: `src/menu/quantize.js` 구현**

```js
// 256차원 float 임베딩을 int8로 줄여 배포 크기를 1/4로 만든다.
// 2,655개 × 256 × 4바이트 = 2.7MB → int8로 680KB.

export function quantizeVector(vec) {
  let max = 0;
  for (const x of vec) {
    const a = Math.abs(x);
    if (a > max) max = a;
  }
  const scale = max === 0 ? 1 : max / 127;
  const q = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) q[i] = Math.round(vec[i] / scale);
  return { q, scale };
}

export function dequantizeVector({ q, scale }) {
  const v = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) v[i] = q[i] * scale;
  return v;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/quantize.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: 인덱스 빌더 작성**

`scripts/build-index.js`:

```js
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
```

- [ ] **Step 6: 인덱스 생성 실행**

Run: `OPENAI_KEY=$OPENAI_KEY node scripts/build-index.js`
Expected: `저장 data/index.json — <N>건`

- [ ] **Step 7: 파일 크기 확인**

Run: `ls -lh data/index.json`
Expected: 5MB 이하. 초과하면 `DIM`을 128로 낮추고 Step 6을 다시 실행한다.

- [ ] **Step 8: 커밋**

```bash
git add scripts/build-index.js src/menu/quantize.js tests/quantize.test.js data/index.json data/heldout.json
git commit -m "feat: 메뉴 임베딩 인덱스 구축 (int8 양자화)"
```

---

### Task 5: MenuRouter — 하이브리드 검색 (L1)

**Files:**
- Create: `src/router/menu-router.js`
- Test: `tests/menu-router.test.js`

**Interfaces:**
- Consumes: `data/index.json`, `cosine`, `dequantizeVector` (Task 4), `splitKeywords` (Task 2)
- Produces:
  - `createRouter({ items, dim, embedFn }) -> Router`
  - `Router.search(utterance, { topK = 5 }) -> Promise<Array<{ id, name, path, affiliate, score, why }>>`
  - `lexicalScore(utterance, node) -> number` (0~1)

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/menu-router.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouter, lexicalScore } from "../src/router/menu-router.js";
import { quantizeVector } from "../src/menu/quantize.js";

const DIM = 8;
function vec(seed) {
  return Float32Array.from({ length: DIM }, (_, i) => Math.sin(seed * (i + 1)));
}
function item(id, name, seed, extra = {}) {
  const { q, scale } = quantizeVector(vec(seed));
  return { id, name, path: ["개인뱅킹"], affiliate: "bank", keywords: name.split(/[/\s]+/), depth: 2, isAction: true, scale, q: Array.from(q), ...extra };
}

const items = [
  item("a", "자동이체내역 조회/해지/변경", 1),
  item("b", "예금잔액증명서", 2),
  item("c", "이체한도 조회/감액", 3),
];

test("lexicalScore는 낱말이 겹칠수록 높다", () => {
  const node = { name: "자동이체내역 조회/해지/변경", keywords: ["자동이체내역", "조회", "해지", "변경"] };
  const hit = lexicalScore("자동이체 해지하고 싶어", node);
  const miss = lexicalScore("환율 알려줘", node);
  assert.ok(hit > miss, `hit=${hit} miss=${miss}`);
  assert.ok(miss >= 0 && hit <= 1);
});

test("search는 벡터가 가장 가까운 항목을 1위로 올린다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(2) });
  const out = await router.search("아무 말", { topK: 3 });
  assert.equal(out[0].id, "b");
  assert.equal(out.length, 3);
});

test("search 결과는 점수 내림차순이다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(1) });
  const out = await router.search("자동이체", { topK: 3 });
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
});

test("임베딩이 실패해도 키워드만으로 결과를 낸다", async () => {
  const router = createRouter({
    items, dim: DIM,
    embedFn: async () => { throw new Error("네트워크 없음"); },
  });
  const out = await router.search("예금잔액증명서 떼줘", { topK: 2 });
  assert.equal(out[0].id, "b");
  assert.equal(out[0].why, "keyword");
});

test("topK가 항목 수보다 크면 전부 반환한다", async () => {
  const router = createRouter({ items, dim: DIM, embedFn: async () => vec(1) });
  const out = await router.search("무엇이든", { topK: 99 });
  assert.equal(out.length, 3);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/menu-router.test.js`
Expected: FAIL — `Cannot find module '../src/router/menu-router.js'`

- [ ] **Step 3: `src/router/menu-router.js` 구현**

```js
// L1 라우터 — 벡터 검색과 키워드 검색을 섞는다.
// 한국어는 형태 변화가 커서 벡터만으로는 놓치는 경우가 있고,
// 키워드만으로는 "통신비 자동으로 나가는 거"를 못 잡는다. 둘 다 쓴다.
import { cosine, dequantizeVector } from "../menu/quantize.js";
import { splitKeywords } from "../menu/normalize.js";

const VECTOR_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.3;

export function lexicalScore(utterance, node) {
  const words = new Set(splitKeywords(utterance));
  if (words.size === 0) return 0;
  const keys = node.keywords?.length ? node.keywords : splitKeywords(node.name);
  if (keys.length === 0) return 0;
  let hit = 0;
  for (const k of keys) {
    for (const w of words) {
      if (w.includes(k) || k.includes(w)) { hit++; break; }
    }
  }
  return hit / keys.length;
}

export function createRouter({ items, dim, embedFn }) {
  // 양자화된 int8을 미리 복원해 둔다. 검색마다 풀면 느리다.
  const vectors = items.map((it) =>
    dequantizeVector({ q: Int8Array.from(it.q), scale: it.scale })
  );

  async function search(utterance, { topK = 5 } = {}) {
    let queryVec = null;
    try {
      queryVec = await embedFn(utterance);
    } catch {
      queryVec = null; // 임베딩 실패 시 키워드로만 간다
    }

    const scored = items.map((it, i) => {
      const lex = lexicalScore(utterance, it);
      if (!queryVec) return { it, score: lex, why: "keyword" };
      const vec = cosine(queryVec, vectors[i]);
      return { it, score: VECTOR_WEIGHT * vec + LEXICAL_WEIGHT * lex, why: "hybrid" };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ it, score, why }) => ({
      id: it.id,
      name: it.name,
      path: it.path,
      affiliate: it.affiliate,
      isAction: it.isAction,
      score,
      why,
    }));
  }

  return { search, size: items.length };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/menu-router.test.js`
Expected: PASS — 5 tests

- [ ] **Step 5: 커밋**

```bash
git add src/router/menu-router.js tests/menu-router.test.js
git commit -m "feat: L1 하이브리드 메뉴 라우터"
```

---

### Task 6: 커버리지 검증 하니스

**Files:**
- Create: `scripts/eval-coverage.js`
- Create: `src/eval/coverage.js`
- Test: `tests/coverage.test.js`

**Interfaces:**
- Consumes: `Router` (Task 5), `data/heldout.json` (Task 4)
- Produces:
  - `evaluateCoverage({ router, heldOut, onProgress }) -> Promise<Report>`
    - `Report = { total: number, top1: number, top3: number, affiliateError: number, misses: Array<{ id, utterance, got: string[] }> }`
  - 산출 파일 `data/coverage-report.json`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/coverage.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCoverage } from "../src/eval/coverage.js";

// 항상 지정한 순위를 돌려주는 가짜 라우터
function fakeRouter(map) {
  return { search: async (u) => (map[u] ?? []).map((id) => ({ id, affiliate: id.split(":")[0] })) };
}

test("Top-1과 Top-3를 구분해서 센다", async () => {
  const router = fakeRouter({
    "u1": ["bank:A", "bank:B", "bank:C"],
    "u2": ["bank:X", "bank:Y", "bank:A"],
  });
  const rep = await evaluateCoverage({
    router,
    heldOut: { "bank:A": ["u1", "u2"] },
  });
  assert.equal(rep.total, 2);
  assert.equal(rep.top1, 1);
  assert.equal(rep.top3, 2);
});

test("맞히지 못한 발화를 misses에 남긴다", async () => {
  const router = fakeRouter({ "u9": ["bank:Z"] });
  const rep = await evaluateCoverage({ router, heldOut: { "bank:A": ["u9"] } });
  assert.equal(rep.misses.length, 1);
  assert.equal(rep.misses[0].id, "bank:A");
  assert.equal(rep.misses[0].utterance, "u9");
  assert.deepEqual(rep.misses[0].got, ["bank:Z"]);
});

test("계열사를 잘못 보낸 비율을 센다", async () => {
  const router = fakeRouter({ "u1": ["card:A"] });
  const rep = await evaluateCoverage({ router, heldOut: { "bank:A": ["u1"] } });
  assert.equal(rep.affiliateError, 1);
});

test("빈 heldOut이면 0으로 나누지 않는다", async () => {
  const rep = await evaluateCoverage({ router: fakeRouter({}), heldOut: {} });
  assert.equal(rep.total, 0);
  assert.equal(rep.top1, 0);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/coverage.test.js`
Expected: FAIL — `Cannot find module '../src/eval/coverage.js'`

- [ ] **Step 3: `src/eval/coverage.js` 구현**

```js
// 본 적 없는 발화로 라우팅 커버리지를 잰다.
// 인덱싱한 발화로 시험을 보면 100%가 나오고, 그 숫자는 아무것도 증명하지 못한다.

export async function evaluateCoverage({ router, heldOut, onProgress }) {
  let total = 0, top1 = 0, top3 = 0, affiliateError = 0;
  const misses = [];
  const ids = Object.keys(heldOut);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    for (const utterance of heldOut[id]) {
      total++;
      const results = await router.search(utterance, { topK: 3 });
      const got = results.map((r) => r.id);
      if (got[0] === id) top1++;
      if (got.includes(id)) top3++;
      else {
        misses.push({ id, utterance, got });
        const want = id.split(":")[0];
        if (results[0] && results[0].affiliate !== want) affiliateError++;
      }
    }
    if (onProgress) onProgress(i + 1, ids.length);
  }

  return { total, top1, top3, affiliateError, misses };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/coverage.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: 실행 스크립트 작성**

`scripts/eval-coverage.js`:

```js
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
```

- [ ] **Step 6: 측정 실행**

Run: `OPENAI_KEY=$OPENAI_KEY node scripts/eval-coverage.js`
Expected: `Top-3` 비율이 출력됨. **Top-3가 90% 미만이면** `data/coverage-report.json`의 `misses`를 열어 해당 메뉴의 발화 변형을 `data/utterances.json`에 손으로 보강한 뒤, Task 4 Step 6(인덱스 재생성) → 본 단계를 다시 실행한다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/eval-coverage.js src/eval/coverage.js tests/coverage.test.js data/coverage-report.json
git commit -m "feat: 라우팅 커버리지 검증 하니스"
```

---

### Task 7: PII 경계와 LLM 어댑터

**Files:**
- Create: `src/llm/adapter.js`
- Create: `src/llm/pii.js`
- Create: `api/chat.js`
- Create: `api/embed.js`
- Test: `tests/pii.test.js`
- Test: `tests/adapter.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `scrubPII(text) -> { text: string, removed: string[] }`
  - `assertNoPII(payload) -> void` (위반 시 throw)
  - `createLLMAdapter({ kind, proxyUrl, fetchImpl }) -> { chat(messages, tools), embed(text) }`
    - `kind`: `"proxy"` | `"stub"`

- [ ] **Step 1: PII 테스트 작성 (실패 예상)**

`tests/pii.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubPII, assertNoPII } from "../src/llm/pii.js";

test("계좌번호를 가린다", () => {
  const r = scrubPII("504-10-123456 으로 보내줘");
  assert.ok(!r.text.includes("504-10-123456"));
  assert.ok(r.removed.includes("account"));
});

test("주민등록번호를 가린다", () => {
  const r = scrubPII("990314-1234567");
  assert.ok(!r.text.includes("990314-1234567"));
  assert.ok(r.removed.includes("rrn"));
});

test("휴대폰번호를 가린다", () => {
  const r = scrubPII("010-2578-1114 로 연락");
  assert.ok(!r.text.includes("010-2578-1114"));
  assert.ok(r.removed.includes("phone"));
});

test("일반 발화는 그대로 둔다", () => {
  const r = scrubPII("통신비 자동으로 나가는 거 그만하고 싶어");
  assert.equal(r.text, "통신비 자동으로 나가는 거 그만하고 싶어");
  assert.equal(r.removed.length, 0);
});

test("assertNoPII는 금지 필드가 있으면 throw", () => {
  assert.throws(() => assertNoPII({ utterance: "안녕", balance: 3240500 }), /balance/);
  assert.throws(() => assertNoPII({ accountNumber: "504-10-123456" }), /accountNumber/);
});

test("assertNoPII는 허용 필드만 있으면 통과", () => {
  assert.doesNotThrow(() => assertNoPII({ utterance: "안녕", history: [] }));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/pii.test.js`
Expected: FAIL — `Cannot find module '../src/llm/pii.js'`

- [ ] **Step 3: `src/llm/pii.js` 구현**

```js
// LLM 경계. 이 선을 넘는 개인정보가 없음을 구조로 보장한다.

const PATTERNS = [
  { kind: "rrn", re: /\d{6}\s?-\s?\d{7}/g },
  { kind: "phone", re: /01[016789]-?\d{3,4}-?\d{4}/g },
  { kind: "account", re: /\d{3}-\d{2}-\d{6}/g },
  { kind: "card", re: /\d{4}-\d{4}-\d{4}-\d{4}/g },
];

export function scrubPII(text) {
  let out = String(text);
  const removed = [];
  for (const { kind, re } of PATTERNS) {
    if (re.test(out)) {
      removed.push(kind);
      out = out.replace(re, `[${kind}]`);
    }
    re.lastIndex = 0;
  }
  return { text: out, removed };
}

// LLM에 넘길 페이로드에 허용되지 않은 키가 있으면 즉시 실패시킨다.
const ALLOWED = new Set(["utterance", "history", "tools", "menuCandidates", "locale"]);

export function assertNoPII(payload) {
  for (const key of Object.keys(payload)) {
    if (!ALLOWED.has(key)) {
      throw new Error(`LLM 페이로드에 허용되지 않은 필드: ${key}`);
    }
  }
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/pii.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: 어댑터 테스트 작성 (실패 예상)**

`tests/adapter.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLLMAdapter } from "../src/llm/adapter.js";

test("stub 어댑터는 네트워크 없이 응답한다", async () => {
  const a = createLLMAdapter({ kind: "stub" });
  const r = await a.chat({ utterance: "안녕", history: [] });
  assert.ok(typeof r.message === "string");
  assert.ok(Array.isArray(r.toolCalls));
});

test("proxy 어댑터는 PII 필드가 있으면 호출 전에 실패한다", async () => {
  const a = createLLMAdapter({ kind: "proxy", proxyUrl: "https://x/api", fetchImpl: async () => { throw new Error("호출되면 안 됨"); } });
  await assert.rejects(() => a.chat({ utterance: "안녕", balance: 1000 }), /balance/);
});

test("proxy 어댑터는 프록시로만 나간다", async () => {
  let seen = null;
  const a = createLLMAdapter({
    kind: "proxy",
    proxyUrl: "https://x/api",
    fetchImpl: async (url, opts) => {
      seen = url;
      return { ok: true, json: async () => ({ message: "ok", toolCalls: [] }) };
    },
  });
  await a.chat({ utterance: "안녕", history: [] });
  assert.equal(seen, "https://x/api/chat");
  assert.ok(!/api\.openai\.com/.test(seen), "OpenAI로 직접 나가면 안 된다");
});

test("프록시가 실패하면 stub으로 떨어진다", async () => {
  const a = createLLMAdapter({
    kind: "proxy", proxyUrl: "https://x/api",
    fetchImpl: async () => { throw new Error("네트워크 없음"); },
  });
  const r = await a.chat({ utterance: "안녕", history: [] });
  assert.equal(r.degraded, true);
});
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

Run: `node --test tests/adapter.test.js`
Expected: FAIL — `Cannot find module '../src/llm/adapter.js'`

- [ ] **Step 7: `src/llm/adapter.js` 구현**

```js
// 모델 교체 계층. 프로토타입은 상용 API를 쓰지만,
// KB GenAI 플랫폼이나 온프레미스 모델로 갈아끼울 때 이 파일만 바뀐다.
import { assertNoPII } from "./pii.js";

export function createLLMAdapter({ kind = "stub", proxyUrl = "", fetchImpl } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;

  async function chat(payload) {
    assertNoPII(payload); // 경계 위반은 네트워크에 나가기 전에 막는다
    if (kind === "stub") return stubChat(payload);
    try {
      const res = await doFetch(`${proxyUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      return await res.json();
    } catch {
      return { ...stubChat(payload), degraded: true };
    }
  }

  async function embed(text) {
    if (kind === "stub") throw new Error("stub 어댑터는 임베딩을 제공하지 않는다");
    const res = await doFetch(`${proxyUrl}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: text }),
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const json = await res.json();
    return Float32Array.from(json.embedding);
  }

  return { chat, embed, kind };
}

// LLM 없이도 화면이 죽지 않게 하는 최소 응답
function stubChat({ utterance }) {
  return {
    message: `"${utterance}" 를 처리할 준비가 되지 않았습니다. 메뉴에서 찾아드릴게요.`,
    toolCalls: [],
  };
}
```

- [ ] **Step 8: 테스트 실행하여 통과 확인**

Run: `node --test tests/adapter.test.js`
Expected: PASS — 4 tests

- [ ] **Step 9: 서버리스 프록시 작성**

`api/chat.js`:

```js
// Vercel 서버리스 — LLM 프록시. 키는 환경변수에만 존재한다.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > 100_000) return res.status(413).json({ error: "요청이 너무 큽니다" });

  const { utterance, history = [], tools = [], menuCandidates = [] } = JSON.parse(raw);

  const system =
    "너는 KB 금융 앱의 실행형 에이전트다. 고객은 메뉴 용어를 모른다.\n" +
    "1) 무엇을 하려는지 파악하고, 모호하면 한 번에 하나씩 되묻는다.\n" +
    "2) 실행 가능한 도구가 있으면 호출한다. 없으면 아래 후보 메뉴 위치를 안내한다.\n" +
    "3) 금액·계좌번호를 지어내지 않는다. 도구 결과에 있는 값만 말한다.\n\n" +
    `후보 메뉴:\n${menuCandidates.map((m) => `- [${m.affiliate}] ${[...m.path, m.name].join(" > ")}`).join("\n")}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: utterance }],
      tools: tools.length ? tools : undefined,
      max_tokens: 800,
    }),
  });
  if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });

  const json = await r.json();
  const msg = json.choices?.[0]?.message ?? {};
  return res.status(200).json({
    message: msg.content ?? "",
    toolCalls: (msg.tool_calls ?? []).map((t) => ({
      name: t.function.name,
      args: JSON.parse(t.function.arguments || "{}"),
    })),
  });
}
```

`api/embed.js`:

```js
// Vercel 서버리스 — 임베딩 프록시.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > 10_000) return res.status(413).json({ error: "요청이 너무 큽니다" });
  const { input } = JSON.parse(raw);

  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input, dimensions: 256 }),
  });
  if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });
  const json = await r.json();
  return res.status(200).json({ embedding: json.data[0].embedding });
}
```

- [ ] **Step 10: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 전체 통과

- [ ] **Step 11: 커밋**

```bash
git add src/llm/ api/ tests/pii.test.js tests/adapter.test.js
git commit -m "feat: PII 경계와 LLM 어댑터, 서버리스 프록시"
```

---

### Task 8: AuthGate — 실행 함수 호출 차단

**Files:**
- Create: `src/exec/auth-gate.js`
- Test: `tests/auth-gate.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `createAuthGate() -> { issue(planId), consume(token, planId), isValid(token, planId) }`
  - `createExecutor({ authGate, tools }) -> { prepare(name, args), execute(planId, token) }`
    - `prepare` 는 실행하지 않고 `{ planId, tool, args, requiresAuth }` 만 반환
    - `execute` 는 유효한 토큰 없이는 반드시 throw

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/auth-gate.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthGate, createExecutor } from "../src/exec/auth-gate.js";

const tools = {
  get_balance: { requiresAuth: false, run: async () => ({ balance: 1000 }) },
  cancel_autopay: { requiresAuth: true, run: async ({ id }) => ({ cancelled: id }) },
};

test("prepare는 실행하지 않는다", async () => {
  let ran = false;
  const ex = createExecutor({
    authGate: createAuthGate(),
    tools: { t: { requiresAuth: true, run: async () => { ran = true; } } },
  });
  const plan = await ex.prepare("t", {});
  assert.equal(ran, false);
  assert.ok(plan.planId);
  assert.equal(plan.requiresAuth, true);
});

test("인증이 필요한 도구는 토큰 없이 실행되지 않는다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  await assert.rejects(() => ex.execute(plan.planId, null), /인증/);
  await assert.rejects(() => ex.execute(plan.planId, "위조토큰"), /인증/);
});

test("발급된 토큰으로는 실행된다", async () => {
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId);
  const out = await ex.execute(plan.planId, token);
  assert.deepEqual(out, { cancelled: "ap1" });
});

test("토큰은 1회용이다", async () => {
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const plan = await ex.prepare("cancel_autopay", { id: "ap1" });
  const token = gate.issue(plan.planId);
  await ex.execute(plan.planId, token);
  await assert.rejects(() => ex.execute(plan.planId, token), /인증/);
});

test("다른 계획의 토큰은 통하지 않는다", async () => {
  const gate = createAuthGate();
  const ex = createExecutor({ authGate: gate, tools });
  const p1 = await ex.prepare("cancel_autopay", { id: "a" });
  const p2 = await ex.prepare("cancel_autopay", { id: "b" });
  const t1 = gate.issue(p1.planId);
  await assert.rejects(() => ex.execute(p2.planId, t1), /인증/);
});

test("인증이 필요 없는 도구는 토큰 없이 실행된다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  const plan = await ex.prepare("get_balance", {});
  const out = await ex.execute(plan.planId, null);
  assert.deepEqual(out, { balance: 1000 });
});

test("없는 도구는 prepare 단계에서 거부된다", async () => {
  const ex = createExecutor({ authGate: createAuthGate(), tools });
  await assert.rejects(() => ex.prepare("존재하지않음", {}), /알 수 없는 도구/);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/auth-gate.test.js`
Expected: FAIL — `Cannot find module '../src/exec/auth-gate.js'`

- [ ] **Step 3: `src/exec/auth-gate.js` 구현**

```js
// AI는 실행할 수 없다. "조심한다"가 아니라 호출할 함수 자체가 없다.
// prepare()는 계획만 만들고, execute()는 사람이 인증해 받은 토큰이 있어야만 돈다.

let counter = 0;

export function createAuthGate() {
  const issued = new Map(); // planId -> token

  return {
    issue(planId) {
      const token = `tok_${planId}_${++counter}`;
      issued.set(planId, token);
      return token;
    },
    isValid(token, planId) {
      return Boolean(token) && issued.get(planId) === token;
    },
    consume(token, planId) {
      if (!this.isValid(token, planId)) return false;
      issued.delete(planId); // 1회용
      return true;
    },
  };
}

export function createExecutor({ authGate, tools }) {
  const plans = new Map();

  async function prepare(name, args) {
    const tool = tools[name];
    if (!tool) throw new Error(`알 수 없는 도구: ${name}`);
    const planId = `plan_${++counter}`;
    const plan = { planId, tool: name, args, requiresAuth: Boolean(tool.requiresAuth) };
    plans.set(planId, plan);
    return plan; // 실행하지 않는다
  }

  async function execute(planId, token) {
    const plan = plans.get(planId);
    if (!plan) throw new Error(`알 수 없는 계획: ${planId}`);
    const tool = tools[plan.tool];

    if (plan.requiresAuth && !authGate.consume(token, planId)) {
      throw new Error("본인 인증이 필요합니다 (AuthGate 미통과)");
    }
    plans.delete(planId);
    return await tool.run(plan.args);
  }

  return { prepare, execute };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/auth-gate.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋**

```bash
git add src/exec/auth-gate.js tests/auth-gate.test.js
git commit -m "feat: AuthGate — 인증 없는 실행을 구조로 차단"
```

---

### Task 9: KB 3사 더미 데이터

**Files:**
- Create: `src/data/kb-data.js`
- Test: `tests/kb-data.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `KB_DATA` — `{ today, user, bank: { accounts, autopays, loans, certificates }, card: { cards, statements, benefits, installments }, sec: { accounts, holdings, pensions, taxDocs }, insurance: { pensions } }`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/kb-data.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { KB_DATA } from "../src/data/kb-data.js";

test("3사 데이터가 모두 있다", () => {
  for (const k of ["bank", "card", "sec", "insurance"]) {
    assert.ok(KB_DATA[k], `${k} 없음`);
  }
});

test("자동이체는 통신비를 포함하고 해지 시 영향이 기술돼 있다", () => {
  const t = KB_DATA.bank.autopays.find((a) => /통신/.test(a.name));
  assert.ok(t, "통신비 자동이체 없음");
  assert.ok(t.impactIfCancelled.length > 0, "해지 영향 설명 없음");
});

test("연금은 세 계열사에 흩어져 있다", () => {
  assert.ok(KB_DATA.bank.accounts.some((a) => a.type === "퇴직연금"));
  assert.ok(KB_DATA.sec.pensions.length > 0);
  assert.ok(KB_DATA.insurance.pensions.length > 0);
});

test("증권 세금 서류는 은행 제증명과 이름이 다르다", () => {
  const bankNames = KB_DATA.bank.certificates.map((c) => c.name);
  const secNames = KB_DATA.sec.taxDocs.map((c) => c.name);
  assert.ok(bankNames.includes("예금잔액증명서"));
  assert.ok(secNames.includes("잔고증명서"));
  assert.equal(bankNames.filter((n) => secNames.includes(n)).length, 0);
});

test("카드 실적에는 다음 구간까지 남은 금액을 계산할 재료가 있다", () => {
  const c = KB_DATA.card.benefits[0];
  assert.ok(typeof c.spentThisMonth === "number");
  assert.ok(typeof c.nextTier === "number");
  assert.ok(c.nextTier > c.spentThisMonth);
});

test("모든 데이터가 가상임이 명시돼 있다", () => {
  assert.ok(/가상/.test(KB_DATA.disclaimer));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/kb-data.test.js`
Expected: FAIL — `Cannot find module '../src/data/kb-data.js'`

- [ ] **Step 3: `src/data/kb-data.js` 구현**

```js
// 전부 가상의 데모 데이터. 실제 KB 고객 정보가 아니다.
export const KB_DATA = {
  disclaimer: "본 데이터는 전부 가상이며 실제 KB 고객 정보가 아닙니다.",
  today: "2026-07-27",

  user: { name: "홍길동", ageGroup: "20대", pin: "0000" },

  bank: {
    accounts: [
      { id: "b1", name: "KB My通장", number: "***-**-*23456", balance: 3_240_500, type: "입출금" },
      { id: "b2", name: "KB Star 정기예금", number: "***-**-*98877", balance: 12_000_000, type: "예금", maturity: "2026-11-30", rate: "연 3.1%" },
      { id: "b3", name: "KB 퇴직연금 DC", number: "***-**-*33445", balance: 48_200_000, type: "퇴직연금", instruction: "없음" },
    ],
    autopays: [
      { id: "ap1", name: "KT 통신요금", amount: 52_000, day: 17, kind: "자동납부", from: "b1",
        impactIfCancelled: "다음 청구분부터 직접 납부해야 하며, 미납 시 통신 서비스가 정지될 수 있습니다." },
      { id: "ap2", name: "케이블 방송", amount: 15_000, day: 20, kind: "자동납부", from: "b1",
        impactIfCancelled: "다음 달부터 방송 시청이 중단될 수 있습니다." },
      { id: "ap3", name: "실손의료보험료", amount: 87_000, day: 25, kind: "자동이체", from: "b1",
        impactIfCancelled: "보험료 미납이 2회 누적되면 보장이 실효될 수 있습니다." },
      { id: "ap4", name: "KB 적금 납입", amount: 300_000, day: 28, kind: "자동송금", from: "b1",
        impactIfCancelled: "적금 만기 시 우대금리 조건을 놓칠 수 있습니다." },
    ],
    loans: [
      { id: "l1", name: "KB 직장인 신용대출", balance: 18_400_000, rate: "연 4.6%", nextDue: "2026-08-15" },
    ],
    certificates: [
      { name: "예금잔액증명서", purpose: "비자·재산 증명", english: true },
      { name: "부채증명서", purpose: "대출 잔액 증명", english: false },
      { name: "금융거래확인서", purpose: "거래 사실 증명", english: false },
      { name: "연말정산증명서", purpose: "연말정산", english: false },
      { name: "원천징수영수증", purpose: "소득 증빙", english: false },
    ],
  },

  card: {
    cards: [
      { id: "c1", name: "KB국민 톡톡카드", last4: "4821", type: "신용" },
      { id: "c2", name: "KB국민 노리체크", last4: "7739", type: "체크" },
    ],
    statements: [
      { cardId: "c1", month: "2026-07", amount: 842_000, dueDate: "2026-08-14" },
      { cardId: "c2", month: "2026-07", amount: 213_500, dueDate: "즉시출금" },
    ],
    benefits: [
      { cardId: "c1", spentThisMonth: 420_000, nextTier: 500_000,
        rewards: ["커피 10% 할인", "주유 리터당 60원 할인"] },
    ],
    installments: [
      { id: "i1", cardId: "c1", merchant: "노트북", amount: 1_800_000, months: 3, remaining: 2, feeRate: "연 15.9%" },
    ],
  },

  sec: {
    accounts: [{ id: "s1", name: "KB증권 종합계좌", number: "***-**-*55667", balance: 6_430_000 }],
    holdings: [
      { symbol: "AAPL", name: "Apple", qty: 12, currency: "USD", soldLastYear: true },
      { symbol: "005930", name: "삼성전자", qty: 40, currency: "KRW", soldLastYear: false },
    ],
    pensions: [{ id: "p1", name: "KB증권 IRP", balance: 11_500_000, instruction: "없음", allocation: "원리금보장 100%" }],
    taxDocs: [
      { name: "잔고증명서", purpose: "잔액 증명" },
      { name: "금융소득증명서", purpose: "금융소득 종합과세 신고" },
      { name: "해외주식양도소득내역", purpose: "해외주식 양도소득세 신고", deadline: "5월 31일" },
    ],
  },

  insurance: {
    pensions: [{ id: "ip1", name: "KB라이프 연금보험", monthly: 300_000, startedAt: "2024-03" }],
  },
};
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/kb-data.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: 커밋**

```bash
git add src/data/kb-data.js tests/kb-data.test.js
git commit -m "feat: KB 3사 가상 데모 데이터"
```

---

### Task 10: L2 조회 도구

**Files:**
- Create: `src/tools/query-tools.js`
- Test: `tests/query-tools.test.js`

**Interfaces:**
- Consumes: `KB_DATA` (Task 9)
- Produces:
  - `QUERY_TOOLS` — `{ [name]: { description, parameters, requiresAuth: false, run(args) } }`
  - `toOpenAITools(toolMap) -> Array` — function calling 스펙 변환

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/query-tools.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY_TOOLS, toOpenAITools } from "../src/tools/query-tools.js";

test("조회 도구는 모두 인증이 필요 없다", () => {
  for (const [name, t] of Object.entries(QUERY_TOOLS)) {
    assert.equal(t.requiresAuth, false, `${name}이 인증을 요구함`);
  }
});

test("자동이체 목록을 조회한다", async () => {
  const out = await QUERY_TOOLS.list_autopays.run({});
  assert.ok(out.items.length >= 4);
  assert.ok(out.items[0].name);
  assert.ok(typeof out.items[0].amount === "number");
});

test("카드 실적은 다음 구간까지 남은 금액을 계산한다", async () => {
  const out = await QUERY_TOOLS.get_card_benefit_progress.run({ card_id: "c1" });
  assert.equal(out.spent, 420_000);
  assert.equal(out.remaining, 80_000);
  assert.ok(out.rewards.length > 0);
});

test("연금은 세 계열사를 합쳐서 돌려준다", async () => {
  const out = await QUERY_TOOLS.list_pensions.run({});
  const affiliates = new Set(out.items.map((i) => i.affiliate));
  assert.equal(affiliates.size, 3);
  assert.ok(out.items.some((i) => i.instruction === "없음"), "운용지시 없음 항목이 있어야 경고할 수 있다");
});

test("세금 서류는 신고 유형에 맞는 것만 고른다", async () => {
  const out = await QUERY_TOOLS.find_tax_documents.run({ filing_type: "해외주식양도소득세" });
  assert.ok(out.items.length >= 1);
  assert.ok(out.items.every((d) => d.affiliate === "sec"));
  assert.ok(out.items.some((d) => d.name === "해외주식양도소득내역"));
});

test("알 수 없는 신고 유형이면 빈 목록과 안내를 준다", async () => {
  const out = await QUERY_TOOLS.find_tax_documents.run({ filing_type: "없는세금" });
  assert.equal(out.items.length, 0);
  assert.ok(out.note);
});

test("toOpenAITools는 function calling 스펙을 만든다", () => {
  const specs = toOpenAITools({ x: { description: "설명", parameters: { a: "string" }, requiresAuth: false, run: async () => {} } });
  assert.equal(specs[0].type, "function");
  assert.equal(specs[0].function.name, "x");
  assert.equal(specs[0].function.parameters.type, "object");
  assert.equal(specs[0].function.parameters.properties.a.type, "string");
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/query-tools.test.js`
Expected: FAIL — `Cannot find module '../src/tools/query-tools.js'`

- [ ] **Step 3: `src/tools/query-tools.js` 구현**

```js
// L2 — 조회·답변. 부수효과가 없으므로 인증이 필요 없다.
import { KB_DATA } from "../data/kb-data.js";

const q = (description, parameters, run) => ({ description, parameters, requiresAuth: false, run });

export const QUERY_TOOLS = {
  list_accounts: q("보유 계좌 목록과 잔액을 조회한다", {}, async () => ({
    items: KB_DATA.bank.accounts.map(({ id, name, balance, type }) => ({ id, name, balance, type })),
  })),

  list_autopays: q("자동이체·자동납부·자동송금 전체 목록을 조회한다", {}, async () => ({
    items: KB_DATA.bank.autopays.map(({ id, name, amount, day, kind }) => ({ id, name, amount, day, kind })),
    total: KB_DATA.bank.autopays.reduce((s, a) => s + a.amount, 0),
  })),

  get_loan_status: q("대출 잔액과 금리를 조회한다", {}, async () => ({
    items: KB_DATA.bank.loans,
  })),

  list_maturities: q("만기가 다가오는 상품을 조회한다", {}, async () => ({
    items: KB_DATA.bank.accounts.filter((a) => a.maturity).map(({ name, maturity, balance }) => ({ name, maturity, balance })),
  })),

  list_cards: q("보유 카드를 조회한다", {}, async () => ({ items: KB_DATA.card.cards })),

  get_card_statement: q("카드 결제예정금액을 조회한다", { card_id: "string" }, async ({ card_id }) => ({
    items: KB_DATA.card.statements.filter((s) => !card_id || s.cardId === card_id),
  })),

  get_card_benefit_progress: q(
    "카드 혜택 실적 충족 현황과 다음 구간까지 남은 금액을 조회한다",
    { card_id: "string" },
    async ({ card_id }) => {
      const b = KB_DATA.card.benefits.find((x) => x.cardId === card_id) ?? KB_DATA.card.benefits[0];
      return { spent: b.spentThisMonth, nextTier: b.nextTier, remaining: b.nextTier - b.spentThisMonth, rewards: b.rewards };
    }
  ),

  list_installments: q("진행 중인 할부를 조회한다", {}, async () => ({ items: KB_DATA.card.installments })),

  get_sec_holdings: q("증권 보유 종목을 조회한다", {}, async () => ({ items: KB_DATA.sec.holdings })),

  // 계열사를 가로지르는 조회 — 이 서비스의 핵심
  list_pensions: q("은행·증권·보험에 흩어진 연금을 한 번에 조회한다", {}, async () => ({
    items: [
      ...KB_DATA.bank.accounts
        .filter((a) => a.type === "퇴직연금")
        .map((a) => ({ affiliate: "bank", name: a.name, balance: a.balance, instruction: a.instruction })),
      ...KB_DATA.sec.pensions.map((p) => ({ affiliate: "sec", name: p.name, balance: p.balance, instruction: p.instruction })),
      ...KB_DATA.insurance.pensions.map((p) => ({ affiliate: "insurance", name: p.name, monthly: p.monthly, instruction: "해당없음" })),
    ],
  })),

  find_tax_documents: q(
    "세금 신고 유형에 필요한 금융 서류를 은행·증권에서 함께 찾는다",
    { filing_type: "string" },
    async ({ filing_type }) => {
      const map = {
        해외주식양도소득세: [{ affiliate: "sec", name: "해외주식양도소득내역", deadline: "5월 31일" }, { affiliate: "sec", name: "금융소득증명서", note: "배당이 있는 경우" }],
        종합소득세: [{ affiliate: "sec", name: "금융소득증명서" }, { affiliate: "bank", name: "원천징수영수증" }],
        연말정산: [{ affiliate: "bank", name: "연말정산증명서" }],
      };
      const items = map[filing_type] ?? [];
      return items.length
        ? { items }
        : { items: [], note: "해외주식양도소득세 / 종합소득세 / 연말정산 중에서 알려주세요." };
    }
  ),

  get_monthly_outflow: q("은행 자동이체와 카드 결제를 합쳐 이번 달 나가는 돈을 조회한다", {}, async () => {
    const auto = KB_DATA.bank.autopays.map((a) => ({ affiliate: "bank", name: a.name, amount: a.amount, day: a.day }));
    const card = KB_DATA.card.statements.map((s) => ({ affiliate: "card", name: `카드대금 ${s.cardId}`, amount: s.amount, day: s.dueDate }));
    const items = [...auto, ...card];
    return { items, total: items.reduce((s, i) => s + i.amount, 0) };
  }),

  list_certificates: q("발급 가능한 은행 제증명 목록을 조회한다", {}, async () => ({
    items: KB_DATA.bank.certificates,
  })),
};

export function toOpenAITools(toolMap) {
  return Object.entries(toolMap).map(([name, t]) => ({
    type: "function",
    function: {
      name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(Object.entries(t.parameters).map(([k, v]) => [k, { type: v }])),
        required: [],
      },
    },
  }));
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/query-tools.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋**

```bash
git add src/tools/query-tools.js tests/query-tools.test.js
git commit -m "feat: L2 조회 도구"
```

---

### Task 11: L3 실행 도구와 ImpactAnalyzer

**Files:**
- Create: `src/tools/action-tools.js`
- Create: `src/exec/impact.js`
- Test: `tests/action-tools.test.js`
- Test: `tests/impact.test.js`

**Interfaces:**
- Consumes: `KB_DATA` (Task 9), `toOpenAITools` (Task 10)
- Produces:
  - `resolveAutopay({ autopay_id, name_hint }) -> Autopay | null` — 별칭을 실제 ID로 바꾼다
  - `ACTION_TOOLS` — 인증이 필요한 도구 맵. `run(args)` 형태는 `QUERY_TOOLS`와 동일
  - `analyzeImpact(toolName, args) -> Promise<{ warnings: string[], blocked: boolean, reason?: string }>`

**설계 메모 — 왜 `name_hint`가 필요한가:** LLM은 `"통신비 자동으로 나가는 거 그만"`이라는 발화에서 `ap1`이라는 내부 ID를 알아낼 방법이 없다. 도구가 이름 힌트를 받아 스스로 해석해야 한 턴에 처리된다. 이 해석은 개인정보를 다루므로 **LLM 경계 밖(도구 안쪽)에서** 이뤄진다.

- [ ] **Step 1: ImpactAnalyzer 테스트 작성 (실패 예상)**

`tests/impact.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeImpact } from "../src/exec/impact.js";

test("자동이체 해지는 영향을 경고한다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "ap1" });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /통신/.test(w)));
});

test("이름 힌트만으로도 영향을 찾아낸다", async () => {
  const r = await analyzeImpact("cancel_autopay", { name_hint: "통신비" });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /통신/.test(w)));
});

test("보험료 자동이체 해지는 실효 위험을 경고한다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "ap3" });
  assert.ok(r.warnings.some((w) => /실효/.test(w)));
});

test("영향을 확인할 수 없으면 실행을 막는다", async () => {
  const r = await analyzeImpact("cancel_autopay", { autopay_id: "없는아이디" });
  assert.equal(r.blocked, true);
  assert.ok(r.reason);
});

test("할부 변경은 수수료를 경고한다", async () => {
  const r = await analyzeImpact("change_installment", { installment_id: "i1", months: 6 });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /수수료/.test(w)));
});

test("영향이 없는 도구는 경고 없이 통과한다", async () => {
  const r = await analyzeImpact("issue_certificate", { name: "예금잔액증명서" });
  assert.equal(r.blocked, false);
  assert.deepEqual(r.warnings, []);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/impact.test.js`
Expected: FAIL — `Cannot find module '../src/exec/impact.js'`

- [ ] **Step 3: `src/exec/impact.js` 구현**

```js
// 실행 전 부수효과를 조사한다.
// 모르면 진행하지 않는다 — 확인 안 된 상태의 실행은 그 자체가 결함이다.
import { KB_DATA } from "../data/kb-data.js";

// LLM은 내부 ID를 알 수 없다. 이름 힌트를 실제 항목으로 바꾸는 일은
// 개인정보를 다루므로 LLM 경계 밖(여기)에서 한다.
export function resolveAutopay({ autopay_id, name_hint } = {}) {
  const list = KB_DATA.bank.autopays;
  if (autopay_id) {
    const byId = list.find((a) => a.id === autopay_id);
    if (byId) return byId;
  }
  if (name_hint) {
    const hint = String(name_hint).replace(/\s+/g, "");
    return list.find((a) => a.name.replace(/\s+/g, "").includes(hint) || hint.includes(a.name.replace(/\s+/g, "").slice(0, 2))) ?? null;
  }
  return null;
}

export async function analyzeImpact(toolName, args) {
  if (toolName === "cancel_autopay" || toolName === "change_autopay_account") {
    const ap = resolveAutopay(args);
    if (!ap) {
      return { warnings: [], blocked: true, reason: "해당 자동이체를 확인할 수 없어 진행하지 않습니다." };
    }
    return {
      warnings: toolName === "cancel_autopay" ? [ap.impactIfCancelled] : [],
      blocked: false,
    };
  }

  if (toolName === "change_installment") {
    const inst = KB_DATA.card.installments.find((i) => i.id === args.installment_id);
    if (!inst) {
      return { warnings: [], blocked: true, reason: "해당 할부 건을 확인할 수 없어 진행하지 않습니다." };
    }
    return {
      warnings: [`할부 기간을 늘리면 수수료가 추가됩니다. 현재 적용 요율 ${inst.feeRate}.`],
      blocked: false,
    };
  }

  if (toolName === "change_transfer_limit") {
    return {
      warnings: ["이체한도 증액은 보이스피싱 피해 규모를 키울 수 있습니다. 필요한 만큼만 올리세요."],
      blocked: false,
    };
  }

  return { warnings: [], blocked: false };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/impact.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: 실행 도구 테스트 작성 (실패 예상)**

`tests/action-tools.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";

test("실행 도구는 모두 인증을 요구한다", () => {
  for (const [name, t] of Object.entries(ACTION_TOOLS)) {
    assert.equal(t.requiresAuth, true, `${name}이 인증을 요구하지 않음`);
  }
});

test("자동이체 해지는 해지된 항목을 돌려준다", async () => {
  const out = await ACTION_TOOLS.cancel_autopay.run({ autopay_id: "ap2" });
  assert.equal(out.cancelled.id, "ap2");
  assert.ok(out.cancelled.name);
});

test("이름 힌트만으로 자동이체를 해지한다", async () => {
  const out = await ACTION_TOOLS.cancel_autopay.run({ name_hint: "통신비" });
  assert.equal(out.cancelled.id, "ap1");
});

test("없는 자동이체를 해지하려 하면 실패한다", async () => {
  await assert.rejects(() => ACTION_TOOLS.cancel_autopay.run({ autopay_id: "없음" }), /확인할 수 없/);
  await assert.rejects(() => ACTION_TOOLS.cancel_autopay.run({ name_hint: "없는이름xyz" }), /확인할 수 없/);
});

test("제증명 발급은 영문 여부를 반영한다", async () => {
  const out = await ACTION_TOOLS.issue_certificate.run({ name: "예금잔액증명서", english: true });
  assert.equal(out.issued.name, "예금잔액증명서");
  assert.equal(out.issued.english, true);
  assert.ok(out.issued.fileName.endsWith(".pdf"));
});

test("발급 불가능한 서류는 거부한다", async () => {
  await assert.rejects(() => ACTION_TOOLS.issue_certificate.run({ name: "납세증명서" }), /발급할 수 없/);
});

test("증권 세금 서류를 발급한다", async () => {
  const out = await ACTION_TOOLS.issue_sec_tax_document.run({ name: "해외주식양도소득내역" });
  assert.equal(out.issued.affiliate, "sec");
  assert.ok(out.issued.fileName.endsWith(".pdf"));
});

test("할부 기간을 변경한다", async () => {
  const out = await ACTION_TOOLS.change_installment.run({ installment_id: "i1", months: 6 });
  assert.equal(out.changed.months, 6);
});
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

Run: `node --test tests/action-tools.test.js`
Expected: FAIL — `Cannot find module '../src/tools/action-tools.js'`

- [ ] **Step 7: `src/tools/action-tools.js` 구현**

```js
// L3 — 실행. 전부 인증이 필요하다.
// 더미 데이터를 조작하지만, 실제 서비스에서는 이 함수 본문만 은행 API로 바뀐다.
import { KB_DATA } from "../data/kb-data.js";
import { resolveAutopay } from "../exec/impact.js";

const a = (description, parameters, run) => ({ description, parameters, requiresAuth: true, run });

export const ACTION_TOOLS = {
  cancel_autopay: a(
    "자동이체·자동납부·자동송금을 해지한다. 고객이 '통신비', '케이블' 처럼 이름만 말하면 name_hint에 넣는다",
    { autopay_id: "string", name_hint: "string" },
    async (args) => {
      const ap = resolveAutopay(args);
      if (!ap) throw new Error("해당 자동이체를 확인할 수 없습니다");
      return { cancelled: { id: ap.id, name: ap.name, amount: ap.amount } };
    }
  ),

  change_autopay_account: a(
    "자동이체의 출금 계좌를 다른 계좌로 바꾼다",
    { autopay_id: "string", name_hint: "string", account_id: "string" },
    async (args) => {
      const ap = resolveAutopay(args);
      const acc = KB_DATA.bank.accounts.find((x) => x.id === args.account_id);
      if (!ap) throw new Error("해당 자동이체를 확인할 수 없습니다");
      if (!acc) throw new Error("해당 계좌를 확인할 수 없습니다");
      return { changed: { id: ap.id, name: ap.name, from: ap.from, to: acc.name } };
    }
  ),

  issue_certificate: a(
    "은행 제증명을 발급한다",
    { name: "string", english: "boolean" },
    async ({ name, english = false }) => {
      const c = KB_DATA.bank.certificates.find((x) => x.name === name);
      if (!c) throw new Error(`${name}은(는) KB국민은행에서 발급할 수 없습니다`);
      if (english && !c.english) throw new Error(`${name}은(는) 영문 발급을 지원하지 않습니다`);
      return { issued: { name: c.name, english, fileName: `${c.name}${english ? "_EN" : ""}.pdf` } };
    }
  ),

  issue_sec_tax_document: a(
    "KB증권 세금 관련 서류를 발급한다",
    { name: "string" },
    async ({ name }) => {
      const d = KB_DATA.sec.taxDocs.find((x) => x.name === name);
      if (!d) throw new Error(`${name}은(는) KB증권에서 발급할 수 없습니다`);
      return { issued: { affiliate: "sec", name: d.name, fileName: `${d.name}.pdf`, deadline: d.deadline } };
    }
  ),

  change_installment: a(
    "카드 할부 기간을 변경한다",
    { installment_id: "string", months: "number" },
    async ({ installment_id, months }) => {
      const i = KB_DATA.card.installments.find((x) => x.id === installment_id);
      if (!i) throw new Error("해당 할부 건을 확인할 수 없습니다");
      return { changed: { id: i.id, merchant: i.merchant, months } };
    }
  ),

  change_transfer_limit: a(
    "이체한도를 변경한다",
    { amount: "number" },
    async ({ amount }) => ({ changed: { transferLimit: amount } })
  ),

  report_lost_card: a(
    "카드 분실을 신고한다",
    { card_id: "string" },
    async ({ card_id }) => {
      const c = KB_DATA.card.cards.find((x) => x.id === card_id);
      if (!c) throw new Error("해당 카드를 확인할 수 없습니다");
      return { reported: { id: c.id, name: c.name } };
    }
  ),
};
```

- [ ] **Step 8: 테스트 실행하여 통과 확인**

Run: `node --test tests/action-tools.test.js`
Expected: PASS — 8 tests

- [ ] **Step 9: 커밋**

```bash
git add src/tools/action-tools.js src/exec/impact.js tests/action-tools.test.js tests/impact.test.js
git commit -m "feat: L3 실행 도구와 ImpactAnalyzer"
```

---

### Task 12: 3계층 오케스트레이터

**Files:**
- Create: `src/orchestrator.js`
- Test: `tests/orchestrator.test.js`

**Interfaces:**
- Consumes: `Router` (Task 5), `createLLMAdapter` (Task 7), `createAuthGate`/`createExecutor` (Task 8), `QUERY_TOOLS` (Task 10), `ACTION_TOOLS`/`analyzeImpact` (Task 11), `scrubPII` (Task 7)
- Produces:
  - `createOrchestrator({ router, llm, tools, authGate }) -> { handle(utterance, history), confirm(planId, token) }`
  - `handle` 반환: `{ layer: "L1"|"L2"|"L3", message, menus?, data?, plan?, warnings?, audit }`
  - `audit`: `{ sentToLLM: string, piiRemoved: string[], candidates: string[], toolCalls: string[], blockedCalls: string[] }`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/orchestrator.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrchestrator } from "../src/orchestrator.js";
import { createAuthGate } from "../src/exec/auth-gate.js";

const router = {
  search: async () => [
    { id: "bank:개인뱅킹>이체>자동납부 등록/해지", name: "자동납부 등록/해지", path: ["개인뱅킹", "이체"], affiliate: "bank", isAction: true, score: 0.9 },
  ],
};
const tools = {
  list_autopays: { requiresAuth: false, description: "d", parameters: {}, run: async () => ({ items: [{ id: "ap1", name: "KT 통신요금" }] }) },
  cancel_autopay: { requiresAuth: true, description: "d", parameters: { autopay_id: "string" }, run: async ({ autopay_id }) => ({ cancelled: { id: autopay_id } }) },
};
const llmWith = (toolCalls, message = "") => ({ chat: async () => ({ message, toolCalls }) });

test("도구 호출이 없으면 L1으로 메뉴를 안내한다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([]), tools, authGate: createAuthGate() });
  const r = await o.handle("아무거나 물어봄", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.menus.length > 0);
  assert.ok(/자동납부/.test(r.message));
});

test("조회 도구는 L2로 바로 답한다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([{ name: "list_autopays", args: {} }]), tools, authGate: createAuthGate() });
  const r = await o.handle("자동이체 뭐 있어?", []);
  assert.equal(r.layer, "L2");
  assert.ok(r.data.items.length > 0);
});

test("실행 도구는 L3 계획만 만들고 실행하지 않는다", async () => {
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: createAuthGate() });
  const r = await o.handle("통신비 자동이체 끊어줘", []);
  assert.equal(r.layer, "L3");
  assert.ok(r.plan.planId);
  assert.equal(r.plan.requiresAuth, true);
  assert.ok(r.audit.blockedCalls.includes("cancel_autopay"));
});

test("confirm은 토큰이 있어야 실행한다", async () => {
  const gate = createAuthGate();
  const o = createOrchestrator({ router, llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]), tools, authGate: gate });
  const r = await o.handle("끊어줘", []);
  await assert.rejects(() => o.confirm(r.plan.planId, null), /인증/);
  const out = await o.confirm(r.plan.planId, gate.issue(r.plan.planId));
  assert.deepEqual(out.cancelled, { id: "ap1" });
});

test("LLM에 개인정보가 나가지 않고 감사 로그에 남는다", async () => {
  let sent = null;
  const llm = { chat: async (p) => { sent = p; return { message: "", toolCalls: [] }; } };
  const o = createOrchestrator({ router, llm, tools, authGate: createAuthGate() });
  const r = await o.handle("504-10-123456 잔액 알려줘", []);
  assert.ok(!JSON.stringify(sent).includes("504-10-123456"));
  assert.ok(r.audit.piiRemoved.includes("account"));
});

test("영향 분석이 막으면 계획을 세우지 않는다", async () => {
  const o = createOrchestrator({
    router,
    llm: llmWith([{ name: "cancel_autopay", args: { autopay_id: "없음" } }]),
    tools,
    authGate: createAuthGate(),
    impactFn: async () => ({ warnings: [], blocked: true, reason: "확인할 수 없습니다" }),
  });
  const r = await o.handle("끊어줘", []);
  assert.equal(r.plan, undefined);
  assert.ok(/확인할 수 없/.test(r.message));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/orchestrator.test.js`
Expected: FAIL — `Cannot find module '../src/orchestrator.js'`

- [ ] **Step 3: `src/orchestrator.js` 구현**

```js
// 3계층 분기.
//   L1 라우팅  — 실행도 조회도 못 해도 "어디 있는지"는 반드시 답한다
//   L2 조회    — 데이터를 조합해 바로 답한다
//   L3 실행    — 부수효과를 경고하고 계획만 만든다. 실행은 사람이 인증해야 한다
import { scrubPII } from "./llm/pii.js";
import { createExecutor } from "./exec/auth-gate.js";
import { analyzeImpact as defaultImpact } from "./exec/impact.js";
import { toOpenAITools } from "./tools/query-tools.js";
import { AFFILIATE_NAME } from "./menu/utterance.js";

export function createOrchestrator({ router, llm, tools, authGate, impactFn = defaultImpact }) {
  const executor = createExecutor({ authGate, tools });

  async function handle(utterance, history = []) {
    const { text, removed } = scrubPII(utterance);
    const menus = await router.search(text, { topK: 5 });

    const audit = {
      sentToLLM: text,
      piiRemoved: removed,
      candidates: menus.map((m) => m.id),
      toolCalls: [],
      blockedCalls: [],
    };

    const res = await llm.chat({
      utterance: text,
      history,
      tools: toOpenAITools(tools),
      menuCandidates: menus,
    });

    const call = res.toolCalls?.[0];

    // L1 — 실행할 도구가 없다. 그래도 위치는 안내한다.
    if (!call) {
      return { layer: "L1", message: res.message || describeMenus(menus), menus, audit };
    }

    const tool = tools[call.name];
    if (!tool) {
      return { layer: "L1", message: describeMenus(menus), menus, audit };
    }

    // L2 — 조회는 바로 실행한다.
    if (!tool.requiresAuth) {
      audit.toolCalls.push(call.name);
      const plan = await executor.prepare(call.name, call.args);
      const data = await executor.execute(plan.planId, null);
      return { layer: "L2", message: res.message, data, menus, audit };
    }

    // L3 — 실행은 계획까지만.
    const impact = await impactFn(call.name, call.args);
    if (impact.blocked) {
      return { layer: "L3", message: impact.reason, menus, audit };
    }
    const plan = await executor.prepare(call.name, call.args);
    audit.blockedCalls.push(call.name); // 인증 전이라 아직 호출되지 않았음을 남긴다
    return { layer: "L3", message: res.message, plan, warnings: impact.warnings, menus, audit };
  }

  async function confirm(planId, token) {
    return await executor.execute(planId, token);
  }

  return { handle, confirm };
}

function describeMenus(menus) {
  if (!menus.length) return "찾지 못했습니다. 다시 말씀해 주세요.";
  const m = menus[0];
  const where = [AFFILIATE_NAME[m.affiliate] ?? m.affiliate, ...m.path, m.name].join(" > ");
  return `${where} 에 있습니다.`;
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/orchestrator.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 전체 통과

- [ ] **Step 6: 커밋**

```bash
git add src/orchestrator.js tests/orchestrator.test.js
git commit -m "feat: 3계층 오케스트레이터"
```

---

### Task 13: 화면과 Audit Log

**Files:**
- Create: `js/main.js` (Task 1의 스텁을 대체)
- Create: `js/ui.js`
- Modify: `css/style.css`
- Test: `tests/ui-format.test.js`
- Create: `src/ui/format.js`

**Interfaces:**
- Consumes: `createOrchestrator` (Task 12), `KB_DATA` (Task 9)
- Produces:
  - `formatAuditLog(audit) -> string[]` — 화면에 뿌릴 줄 목록
  - `formatMoney(n) -> string`

- [ ] **Step 1: 포맷 테스트 작성 (실패 예상)**

`tests/ui-format.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAuditLog, formatMoney } from "../src/ui/format.js";

test("금액에 천 단위 구분이 들어간다", () => {
  assert.equal(formatMoney(52000), "52,000원");
  assert.equal(formatMoney(0), "0원");
});

test("감사 로그는 LLM 전송 내용과 PII 제거를 보여준다", () => {
  const lines = formatAuditLog({
    sentToLLM: "잔액 알려줘", piiRemoved: ["account"],
    candidates: ["bank:A"], toolCalls: [], blockedCalls: [],
  });
  assert.ok(lines.some((l) => l.includes("잔액 알려줘")));
  assert.ok(lines.some((l) => /account/.test(l)));
});

test("PII가 없으면 0건으로 표시한다", () => {
  const lines = formatAuditLog({ sentToLLM: "안녕", piiRemoved: [], candidates: [], toolCalls: [], blockedCalls: [] });
  assert.ok(lines.some((l) => /미전송 \(0건\)/.test(l)));
});

test("인증 전 차단된 호출을 표시한다", () => {
  const lines = formatAuditLog({ sentToLLM: "x", piiRemoved: [], candidates: [], toolCalls: [], blockedCalls: ["cancel_autopay"] });
  assert.ok(lines.some((l) => l.includes("⛔") && l.includes("cancel_autopay")));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/ui-format.test.js`
Expected: FAIL — `Cannot find module '../src/ui/format.js'`

- [ ] **Step 3: `src/ui/format.js` 구현**

```js
export function formatMoney(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

// 보안 질문이 나오기 전에 화면이 먼저 답하게 한다.
export function formatAuditLog(audit) {
  const lines = [];
  lines.push(`LLM 전송 페이로드: "${audit.sentToLLM}"`);
  lines.push(
    audit.piiRemoved.length
      ? `⚠ 개인정보 마스킹: ${audit.piiRemoved.join(", ")}`
      : "⚠ 계좌번호·잔액·성명 미전송 (0건)"
  );
  if (audit.candidates.length) lines.push(`후보 메뉴 ${audit.candidates.length}건`);
  for (const t of audit.toolCalls) lines.push(`도구 호출: ${t}()`);
  for (const t of audit.blockedCalls) lines.push(`⛔ ${t}() — AuthGate 미통과, 호출 불가`);
  return lines;
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/ui-format.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: `js/ui.js` 작성**

```js
import { formatAuditLog, formatMoney } from "../src/ui/format.js";

export function createUI(root, { onSend, onConfirm }) {
  root.innerHTML = `
    <div class="pane">
      <div id="log" class="log" aria-live="polite"></div>
      <form id="composer">
        <input id="input" autocomplete="off" placeholder="무엇을 도와드릴까요? 예) 통신비 자동으로 나가는 거 그만하고 싶어" />
        <button type="submit">보내기</button>
      </form>
    </div>
    <aside class="audit">
      <h2>AI 판단 로그</h2>
      <pre id="audit"></pre>
    </aside>`;

  const log = root.querySelector("#log");
  const auditEl = root.querySelector("#audit");
  const input = root.querySelector("#input");

  root.querySelector("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    append("user", text);
    await onSend(text);
  });

  function append(who, text) {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function renderResult(r) {
    if (r.message) append("bot", r.message);

    if (r.layer === "L1" && r.menus?.length) {
      const ul = document.createElement("ul");
      ul.className = "menus";
      for (const m of r.menus.slice(0, 3)) {
        const li = document.createElement("li");
        li.textContent = [...m.path, m.name].join(" > ");
        ul.appendChild(li);
      }
      log.appendChild(ul);
    }

    if (r.layer === "L2" && r.data?.items) {
      const ul = document.createElement("ul");
      ul.className = "data";
      for (const it of r.data.items) {
        const li = document.createElement("li");
        li.textContent = it.amount != null ? `${it.name} — ${formatMoney(it.amount)}` : `${it.name ?? JSON.stringify(it)}`;
        ul.appendChild(li);
      }
      log.appendChild(ul);
    }

    if (r.layer === "L3" && r.plan) {
      for (const w of r.warnings ?? []) append("warn", `⚠️ ${w}`);
      const btn = document.createElement("button");
      btn.className = "auth";
      btn.textContent = "🔒 지문으로 실행";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const out = await onConfirm(r.plan.planId);
        append("bot", `완료했습니다. ${JSON.stringify(out)}`);
      });
      log.appendChild(btn);
    }

    auditEl.textContent = formatAuditLog(r.audit).join("\n");
    log.scrollTop = log.scrollHeight;
  }

  return { renderResult, append };
}
```

- [ ] **Step 6: `js/main.js` 작성 (스텁 대체)**

```js
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { createUI } from "./ui.js";

const cfg = window.KB_CONFIG ?? { mode: "rules" };
const index = await (await fetch("./data/index.json")).json();

const llm = createLLMAdapter({
  kind: cfg.mode === "proxy" ? "proxy" : "stub",
  proxyUrl: cfg.proxyUrl ?? "",
});

const embedCache = new Map();
async function embedFn(text) {
  if (embedCache.has(text)) return embedCache.get(text);
  const v = await llm.embed(text);
  embedCache.set(text, v);
  return v;
}

const router = createRouter({ items: index.items, dim: index.dim, embedFn });
const authGate = createAuthGate();
const orchestrator = createOrchestrator({
  router, llm, authGate,
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS },
});

const history = [];
const ui = createUI(document.getElementById("app"), {
  onSend: async (text) => {
    const r = await orchestrator.handle(text, history);
    history.push({ role: "user", content: text });
    if (r.message) history.push({ role: "assistant", content: r.message });
    ui.renderResult(r);
  },
  onConfirm: async (planId) => orchestrator.confirm(planId, authGate.issue(planId)),
});

ui.append("bot", `안녕하세요. 무엇을 도와드릴까요? (메뉴 ${index.items.length}건을 알고 있습니다)`);
```

- [ ] **Step 7: CSS 보강**

`css/style.css` 끝에 추가:

```css
main { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; }
.log { min-height: 50vh; max-height: 60vh; overflow-y: auto; border: 1px solid #8884; border-radius: 8px; padding: .75rem; }
.msg { margin: .4rem 0; padding: .5rem .7rem; border-radius: 8px; max-width: 80%; }
.msg.user { background: #ffd54f33; margin-left: auto; }
.msg.bot { background: #8884; }
.msg.warn { background: #ff525233; }
.menus, .data { margin: .3rem 0 .3rem 1rem; }
button.auth { display: block; margin: .5rem 0; padding: .6rem 1rem; font-size: 1rem; cursor: pointer; }
#composer { display: flex; gap: .5rem; margin-top: .5rem; }
#composer input { flex: 1; padding: .6rem; font-size: 1rem; }
.audit { border: 1px solid #8884; border-radius: 8px; padding: .75rem; font-size: .85rem; }
.audit pre { white-space: pre-wrap; word-break: break-all; }
@media (max-width: 840px) { main { grid-template-columns: 1fr; } }
```

- [ ] **Step 8: 브라우저에서 확인**

```bash
python -m http.server 8000
```
브라우저로 `http://localhost:8000` 접속.
Expected: 입력창에 "자동이체 뭐 있어?" 입력 시 우측 「AI 판단 로그」에 `⚠ 계좌번호·잔액·성명 미전송 (0건)` 이 표시된다.

- [ ] **Step 9: 커밋**

```bash
git add js/ src/ui/ css/style.css tests/ui-format.test.js
git commit -m "feat: 대화 화면과 AI 판단 로그"
```

---

### Task 14: 전화 채널과 고령층 음성 원칙

**Files:**
- Create: `src/voice/senior-voice.js`
- Create: `js/phone.js`
- Create: `phone.html`
- Test: `tests/senior-voice.test.js`

**Interfaces:**
- Consumes: `createOrchestrator` (Task 12), `formatMoney` (Task 13)
- Produces:
  - `toSeniorSpeech(text) -> string` — 숫자를 두 번 말하도록 변환
  - `chunkOneAtATime(items) -> string[]` — 한 번에 하나씩 끊어 읽을 문장 목록
  - `buildConfirmation(action) -> string` — 되풀이 확인 문장

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/senior-voice.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSeniorSpeech, chunkOneAtATime, buildConfirmation } from "../src/voice/senior-voice.js";

test("금액은 두 번 말한다", () => {
  const s = toSeniorSpeech("통신비 52,000원입니다");
  assert.equal((s.match(/52,000원/g) ?? []).length, 2);
});

test("금액이 없으면 그대로 둔다", () => {
  assert.equal(toSeniorSpeech("네, 알겠습니다"), "네, 알겠습니다");
});

test("한 번에 하나씩 끊는다", () => {
  const lines = chunkOneAtATime([
    { name: "통신비", amount: 52000 },
    { name: "케이블 방송", amount: 15000 },
  ]);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes("첫 번째"));
  assert.ok(lines[1].includes("두 번째"));
});

test("확인 문장은 되풀이하고 네/아니오를 요구한다", () => {
  const s = buildConfirmation({ verb: "멈추", target: "케이블 방송 자동이체", effect: "다음 달부터 나가지 않습니다" });
  assert.ok(s.includes("케이블 방송 자동이체"));
  assert.ok(s.includes("다음 달부터 나가지 않습니다"));
  assert.ok(/"네"/.test(s));
});

test("항목이 없으면 빈 배열을 준다", () => {
  assert.deepEqual(chunkOneAtATime([]), []);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/senior-voice.test.js`
Expected: FAIL — `Cannot find module '../src/voice/senior-voice.js'`

- [ ] **Step 3: `src/voice/senior-voice.js` 구현**

```js
// 고령층 음성 6원칙
//   ① 한 번에 하나만 묻는다   ② 침묵을 기다린다      ③ 진행 전 동의를 구한다
//   ④ 숫자는 두 번 말한다     ⑤ 되풀이해 확인한다     ⑥ 실행은 기존 인증
// ChatGPT 음성 모드는 빠르고 자연스러운 대화가 목표지만,
// 고령층에게는 천천히·확인하며·반복하는 대화가 맞다. "창구 직원처럼"이다.

const MONEY = /\d{1,3}(?:,\d{3})+원|\d+원/g;

export function toSeniorSpeech(text) {
  return String(text).replace(MONEY, (m) => `${m}. ${m}`);
}

const ORDINAL = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째", "여섯 번째"];

export function chunkOneAtATime(items) {
  return items.map((it, i) => {
    const ord = ORDINAL[i] ?? `${i + 1} 번째`;
    const amount = it.amount != null ? `, ${Number(it.amount).toLocaleString("ko-KR")}원` : "";
    return toSeniorSpeech(`${ord}, ${it.name}${amount}.`);
  });
}

export function buildConfirmation({ verb, target, effect }) {
  return [
    `${target}을(를) ${verb}실까요?`,
    `${effect}.`,
    `맞으시면 "네"라고 말씀해 주세요.`,
  ].join(" ");
}

// 침묵 허용 시간 — 고령층은 반응이 느리다. 끊으면 대화가 무너진다.
export const SILENCE_TOLERANCE_MS = 3000;
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/senior-voice.test.js`
Expected: PASS — 5 tests

- [ ] **Step 5: `phone.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>지문까지 — 전화 채널 (KB 어르신전용 1644-3308)</title>
  <link rel="stylesheet" href="./css/style.css" />
</head>
<body>
  <div class="phone">
    <div class="phone-head">
      <strong>KB국민은행</strong>
      <span>어르신전용 1644-3308</span>
      <small>※ 채널 시뮬레이션 — 실제 전화망에 연결되지 않습니다</small>
    </div>
    <div id="transcript" class="transcript" aria-live="polite"></div>
    <div class="phone-controls">
      <button id="mic">🎙 말하기</button>
      <input id="say" placeholder="음성 대신 입력해도 됩니다" />
    </div>
  </div>
  <script src="./config.local.js" onerror="window.KB_CONFIG={mode:'rules'}"></script>
  <script type="module" src="./js/phone.js"></script>
</body>
</html>
```

- [ ] **Step 6: `js/phone.js` 작성**

```js
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { toSeniorSpeech, chunkOneAtATime, buildConfirmation, SILENCE_TOLERANCE_MS } from "../src/voice/senior-voice.js";

const cfg = window.KB_CONFIG ?? { mode: "rules" };
const index = await (await fetch("./data/index.json")).json();
const llm = createLLMAdapter({ kind: cfg.mode === "proxy" ? "proxy" : "stub", proxyUrl: cfg.proxyUrl ?? "" });
const router = createRouter({ items: index.items, dim: index.dim, embedFn: (t) => llm.embed(t) });
const authGate = createAuthGate();
const orch = createOrchestrator({ router, llm, authGate, tools: { ...QUERY_TOOLS, ...ACTION_TOOLS } });

const transcript = document.getElementById("transcript");
const sayInput = document.getElementById("say");

function line(who, text) {
  const p = document.createElement("p");
  p.className = who;
  p.textContent = text;
  transcript.appendChild(p);
  transcript.scrollTop = transcript.scrollHeight;
}

function speak(text) {
  line("bot", text);
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = 0.85; // ① 천천히
  window.speechSynthesis.speak(u);
}

async function handle(text) {
  line("user", text);
  const r = await orch.handle(text, []);

  if (r.layer === "L2" && r.data?.items?.length) {
    speak(`${r.data.items.length}건이 나갔습니다. 하나씩 말씀드릴게요. 괜찮으실까요?`); // ③ 동의
    for (const l of chunkOneAtATime(r.data.items)) { // ① 하나씩 ④ 숫자 두 번
      await new Promise((res) => setTimeout(res, SILENCE_TOLERANCE_MS)); // ② 기다림
      speak(l);
    }
    return;
  }

  if (r.layer === "L3" && r.plan) {
    speak(buildConfirmation({ // ⑤ 되풀이 확인
      verb: "멈추",
      target: r.plan.args.autopay_id ?? "요청하신 항목",
      effect: r.warnings?.[0] ?? "다음 달부터 반영됩니다",
    }));
    speak("확인을 위해 문자로 보내드린 번호를 눌러주세요."); // ⑥ 기존 인증
    return;
  }

  speak(toSeniorSpeech(r.message ?? "다시 말씀해 주시겠어요?"));
}

sayInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const v = sayInput.value.trim();
  if (!v) return;
  sayInput.value = "";
  handle(v);
});

document.getElementById("mic").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return line("bot", "이 브라우저는 음성 인식을 지원하지 않습니다. 입력창을 이용해 주세요.");
  const rec = new SR();
  rec.lang = "ko-KR";
  rec.onresult = (e) => handle(e.results[0][0].transcript);
  rec.onerror = () => line("bot", "잘 못 들었습니다. 다시 말씀해 주세요.");
  rec.start();
});

speak("네, KB국민은행입니다. 무엇을 도와드릴까요?");
```

- [ ] **Step 7: CSS 추가**

`css/style.css` 끝에 추가:

```css
.phone { max-width: 420px; margin: 2rem auto; border: 1px solid #8886; border-radius: 16px; overflow: hidden; }
.phone-head { padding: 1rem; background: #ffd54f33; display: grid; gap: .2rem; }
.phone-head small { opacity: .7; }
.transcript { min-height: 50vh; max-height: 60vh; overflow-y: auto; padding: 1rem; font-size: 1.15rem; line-height: 1.7; }
.transcript p { margin: .5rem 0; }
.transcript .user { text-align: right; opacity: .8; }
.phone-controls { display: flex; gap: .5rem; padding: 1rem; }
.phone-controls input { flex: 1; padding: .7rem; font-size: 1.05rem; }
#mic { padding: .7rem 1rem; font-size: 1.05rem; }
```

- [ ] **Step 8: 브라우저에서 확인**

`http://localhost:8000/phone.html` 접속 후 입력창에 "이번 달에 돈이 자꾸 빠져나가는데 뭔지를 모르겠어" 입력.
Expected: 항목이 하나씩, 3초 간격으로, 금액을 두 번 말하며 읽힌다.

- [ ] **Step 9: 커밋**

```bash
git add src/voice/ js/phone.js phone.html css/style.css tests/senior-voice.test.js
git commit -m "feat: 전화 채널과 고령층 음성 6원칙"
```

---

### Task 15: 평가 하니스 (L2·L3 40개 + 모델 대조)

**Files:**
- Create: `data/eval-set.json`
- Create: `scripts/eval-tools.js`
- Create: `src/eval/tool-eval.js`
- Test: `tests/tool-eval.test.js`

**Interfaces:**
- Consumes: `createOrchestrator` (Task 12)
- Produces:
  - `evaluateToolSelection({ cases, orchestrator }) -> Promise<{ total, intentOk, toolOk, byLevel }>`
    - `cases`: `Array<{ utterance, level: "L1"|"L2"|"L3"|"L4", expectTool: string|null }>`
  - 산출 파일 `data/tool-eval-report.json`

- [ ] **Step 1: 테스트 작성 (실패 예상)**

`tests/tool-eval.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateToolSelection } from "../src/eval/tool-eval.js";

const orch = (toolByUtterance) => ({
  handle: async (u) => {
    const t = toolByUtterance[u];
    return t
      ? { layer: "L2", audit: { toolCalls: [t], blockedCalls: [] } }
      : { layer: "L1", audit: { toolCalls: [], blockedCalls: [] } };
  },
});

test("도구 선택 정확도를 센다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({ a: "list_autopays" }),
    cases: [
      { utterance: "a", level: "L3", expectTool: "list_autopays" },
      { utterance: "b", level: "L3", expectTool: "list_autopays" },
    ],
  });
  assert.equal(r.total, 2);
  assert.equal(r.toolOk, 1);
});

test("층별로 나눠 센다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({ a: "t1", c: "t2" }),
    cases: [
      { utterance: "a", level: "L1", expectTool: "t1" },
      { utterance: "b", level: "L4", expectTool: "t2" },
      { utterance: "c", level: "L4", expectTool: "t2" },
    ],
  });
  assert.equal(r.byLevel.L1.ok, 1);
  assert.equal(r.byLevel.L4.ok, 1);
  assert.equal(r.byLevel.L4.total, 2);
});

test("expectTool이 null이면 도구를 안 부르는 게 정답이다", async () => {
  const r = await evaluateToolSelection({
    orchestrator: orch({}),
    cases: [{ utterance: "x", level: "L1", expectTool: null }],
  });
  assert.equal(r.toolOk, 1);
});

test("인증 대기 중인 호출도 선택으로 인정한다", async () => {
  const o = { handle: async () => ({ layer: "L3", audit: { toolCalls: [], blockedCalls: ["cancel_autopay"] } }) };
  const r = await evaluateToolSelection({
    orchestrator: o,
    cases: [{ utterance: "x", level: "L3", expectTool: "cancel_autopay" }],
  });
  assert.equal(r.toolOk, 1);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/tool-eval.test.js`
Expected: FAIL — `Cannot find module '../src/eval/tool-eval.js'`

- [ ] **Step 3: `src/eval/tool-eval.js` 구현**

```js
// L2·L3 도구 선택 정확도. 막연함의 층(L1~L4)별로 나눠 잰다.
// L3·L4에서 벌어지는 격차가 이 서비스의 존재 이유다.

export async function evaluateToolSelection({ cases, orchestrator }) {
  let toolOk = 0;
  const byLevel = {};

  for (const c of cases) {
    const r = await orchestrator.handle(c.utterance, []);
    const called = [...(r.audit?.toolCalls ?? []), ...(r.audit?.blockedCalls ?? [])];
    const ok = c.expectTool === null ? called.length === 0 : called.includes(c.expectTool);
    if (ok) toolOk++;
    byLevel[c.level] ??= { total: 0, ok: 0 };
    byLevel[c.level].total++;
    if (ok) byLevel[c.level].ok++;
  }

  return { total: cases.length, intentOk: toolOk, toolOk, byLevel };
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/tool-eval.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: 평가셋 작성**

`data/eval-set.json` — 5개 업무 × 8개 변형 = 40개. 업무당 L1 1 / L2 2 / L3 3 / L4 2.

```json
[
  { "utterance": "자동이체 해지해줘", "level": "L1", "expectTool": "cancel_autopay" },
  { "utterance": "통신비 자동이체 끊어줘", "level": "L2", "expectTool": "cancel_autopay" },
  { "utterance": "KT 요금 자동으로 나가는 거 없애줘", "level": "L2", "expectTool": "cancel_autopay" },
  { "utterance": "매달 빠져나가는 통신비 그만하고 싶어", "level": "L3", "expectTool": "cancel_autopay" },
  { "utterance": "핸드폰 요금 자동으로 나가는 거 어떻게 막아?", "level": "L3", "expectTool": "cancel_autopay" },
  { "utterance": "통신사한테 매달 돈이 나가는데 이제 안 내고 싶어", "level": "L3", "expectTool": "cancel_autopay" },
  { "utterance": "통장에서 자꾸 뭐가 빠져나가는데 통신비는 안 쓰고 싶어", "level": "L4", "expectTool": "cancel_autopay" },
  { "utterance": "돈이 계속 새는 것 같아 통신 쪽부터 막아줘", "level": "L4", "expectTool": "cancel_autopay" },

  { "utterance": "자동이체 목록 조회", "level": "L1", "expectTool": "list_autopays" },
  { "utterance": "자동이체 뭐뭐 있어?", "level": "L2", "expectTool": "list_autopays" },
  { "utterance": "매달 자동으로 나가는 거 알려줘", "level": "L2", "expectTool": "list_autopays" },
  { "utterance": "이번 달에 돈이 왜 이렇게 나갔지?", "level": "L3", "expectTool": "list_autopays" },
  { "utterance": "통장에서 자꾸 빠져나가는데 뭔지를 모르겠어", "level": "L3", "expectTool": "list_autopays" },
  { "utterance": "내 돈 어디로 새는지 좀 봐줘", "level": "L3", "expectTool": "list_autopays" },
  { "utterance": "요즘 잔액이 자꾸 줄어", "level": "L4", "expectTool": "list_autopays" },
  { "utterance": "쓴 것도 없는데 돈이 없어", "level": "L4", "expectTool": "list_autopays" },

  { "utterance": "카드 실적 조회", "level": "L1", "expectTool": "get_card_benefit_progress" },
  { "utterance": "이번 달 카드 얼마나 썼어?", "level": "L2", "expectTool": "get_card_benefit_progress" },
  { "utterance": "카드 실적 채웠나 확인해줘", "level": "L2", "expectTool": "get_card_benefit_progress" },
  { "utterance": "이번 달 카드 얼마나 더 써야 혜택 받아?", "level": "L3", "expectTool": "get_card_benefit_progress" },
  { "utterance": "할인 받으려면 얼마 더 결제해야 해?", "level": "L3", "expectTool": "get_card_benefit_progress" },
  { "utterance": "커피 할인 받는 조건 채웠어?", "level": "L3", "expectTool": "get_card_benefit_progress" },
  { "utterance": "이번 달 카드 혜택 못 받는 거 아니야?", "level": "L4", "expectTool": "get_card_benefit_progress" },
  { "utterance": "카드 쓰는 김에 뭐 챙길 거 있나", "level": "L4", "expectTool": "get_card_benefit_progress" },

  { "utterance": "세금 서류 조회", "level": "L1", "expectTool": "find_tax_documents" },
  { "utterance": "해외주식 양도소득세 서류 뭐 필요해?", "level": "L2", "expectTool": "find_tax_documents" },
  { "utterance": "종합소득세 신고 서류 알려줘", "level": "L2", "expectTool": "find_tax_documents" },
  { "utterance": "세금 신고해야 하는데 금융 서류 뭐뭐 떼야 돼?", "level": "L3", "expectTool": "find_tax_documents" },
  { "utterance": "작년에 해외주식 팔았는데 뭐 준비해야 해?", "level": "L3", "expectTool": "find_tax_documents" },
  { "utterance": "5월에 신고하라던데 은행에서 뭐 떼야 하지?", "level": "L3", "expectTool": "find_tax_documents" },
  { "utterance": "세무서에서 금융자료 가져오래", "level": "L4", "expectTool": "find_tax_documents" },
  { "utterance": "주식 팔았는데 나중에 문제되는 거 아니야?", "level": "L4", "expectTool": "find_tax_documents" },

  { "utterance": "연금 계좌 조회", "level": "L1", "expectTool": "list_pensions" },
  { "utterance": "내 연금 얼마나 있어?", "level": "L2", "expectTool": "list_pensions" },
  { "utterance": "퇴직연금이랑 IRP 다 보여줘", "level": "L2", "expectTool": "list_pensions" },
  { "utterance": "내 연금 어디 들어가 있지?", "level": "L3", "expectTool": "list_pensions" },
  { "utterance": "노후 준비되고 있는 건지 모르겠어", "level": "L3", "expectTool": "list_pensions" },
  { "utterance": "회사에서 넣어준 퇴직금 어디 있어?", "level": "L3", "expectTool": "list_pensions" },
  { "utterance": "나중에 받을 돈이 얼마나 되나", "level": "L4", "expectTool": "list_pensions" },
  { "utterance": "은퇴하면 뭐 나오는 거 있나", "level": "L4", "expectTool": "list_pensions" }
]
```

- [ ] **Step 6: 실행 스크립트 작성**

`scripts/eval-tools.js`:

```js
// 대형/소형 모델을 바꿔가며 도구 선택 정확도를 잰다.
//   실행: OPENAI_KEY=sk-... PROXY=https://<project>.vercel.app/api node scripts/eval-tools.js
import { readFileSync, writeFileSync } from "node:fs";
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { evaluateToolSelection } from "../src/eval/tool-eval.js";

const PROXY = process.env.PROXY;
if (!PROXY) throw new Error("PROXY 환경변수가 필요합니다 (예: https://x.vercel.app/api)");

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
const cases = JSON.parse(readFileSync("data/eval-set.json", "utf8"));

const llm = createLLMAdapter({ kind: "proxy", proxyUrl: PROXY });
const router = createRouter({ items: index.items, dim: index.dim, embedFn: (t) => llm.embed(t) });
const orchestrator = createOrchestrator({
  router, llm, authGate: createAuthGate(),
  tools: { ...QUERY_TOOLS, ...ACTION_TOOLS },
});

const report = await evaluateToolSelection({ cases, orchestrator });
const pct = (ok, total) => (total ? ((ok / total) * 100).toFixed(1) : "0.0");

console.log(`\n전체 도구 선택 정확도 ${report.toolOk}/${report.total} (${pct(report.toolOk, report.total)}%)`);
for (const [level, v] of Object.entries(report.byLevel).sort()) {
  console.log(`  ${level}  ${v.ok}/${v.total} (${pct(v.ok, v.total)}%)`);
}
writeFileSync("data/tool-eval-report.json", JSON.stringify(report, null, 2), "utf8");
```

- [ ] **Step 7: 측정 실행**

Run: `PROXY=https://<project>.vercel.app/api node scripts/eval-tools.js`
Expected: 전체 정확도와 L1~L4 층별 정확도가 출력된다. **L3·L4가 L1보다 크게 낮으면** 해당 도구의 `description`을 구어체 예시를 포함하도록 보강한 뒤 다시 측정한다.

- [ ] **Step 8: 소형 모델 대조 측정**

`api/chat.js`의 `model` 값을 `gpt-4o-mini` → `gpt-3.5-turbo`로 바꿔 Vercel에 재배포한 뒤 Step 7을 다시 실행하고 두 결과를 기록한다. 측정 후 `gpt-4o-mini`로 되돌린다.

Expected: 두 모델의 정확도가 기술설명서 평가 표에 들어갈 숫자로 확보된다.

- [ ] **Step 9: 커밋**

```bash
git add data/eval-set.json scripts/eval-tools.js src/eval/tool-eval.js tests/tool-eval.test.js data/tool-eval-report.json
git commit -m "feat: 도구 선택 평가 하니스와 40개 평가셋"
```

---

### Task 16: 데모 시나리오와 우아한 실패

**Files:**
- Create: `docs/demo-script.md`
- Modify: `src/orchestrator.js` (폴백 보강)
- Test: `tests/fallback.test.js`

**Interfaces:**
- Consumes: `createOrchestrator` (Task 12)
- Produces: `handle`가 어떤 실패에서도 예외를 던지지 않고 `layer: "L1"` 응답을 반환

- [ ] **Step 1: 폴백 테스트 작성 (실패 예상)**

`tests/fallback.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrchestrator } from "../src/orchestrator.js";
import { createAuthGate } from "../src/exec/auth-gate.js";

const menus = [{ id: "bank:A", name: "자동납부 등록/해지", path: ["개인뱅킹", "이체"], affiliate: "bank", isAction: true, score: 0.9 }];
const okRouter = { search: async () => menus };

test("LLM이 터져도 예외를 던지지 않고 메뉴를 안내한다", async () => {
  const o = createOrchestrator({
    router: okRouter,
    llm: { chat: async () => { throw new Error("네트워크 없음"); } },
    tools: {}, authGate: createAuthGate(),
  });
  const r = await o.handle("아무 말", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.menus.length > 0);
});

test("라우터까지 터져도 안내 문구를 낸다", async () => {
  const o = createOrchestrator({
    router: { search: async () => { throw new Error("인덱스 없음"); } },
    llm: { chat: async () => ({ message: "", toolCalls: [] }) },
    tools: {}, authGate: createAuthGate(),
  });
  const r = await o.handle("아무 말", []);
  assert.equal(r.layer, "L1");
  assert.ok(r.message.length > 0);
  assert.deepEqual(r.menus, []);
});

test("도구 실행이 실패해도 예외 대신 안내를 낸다", async () => {
  const o = createOrchestrator({
    router: okRouter,
    llm: { chat: async () => ({ message: "", toolCalls: [{ name: "boom", args: {} }] }) },
    tools: { boom: { requiresAuth: false, description: "d", parameters: {}, run: async () => { throw new Error("고장"); } } },
    authGate: createAuthGate(),
  });
  const r = await o.handle("실행해줘", []);
  assert.equal(r.layer, "L1");
  assert.ok(/처리할 수 없/.test(r.message));
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `node --test tests/fallback.test.js`
Expected: FAIL — 예외가 밖으로 새어 나온다

- [ ] **Step 3: `src/orchestrator.js`의 `handle` 본문을 방어적으로 감싼다**

`handle` 함수 전체를 아래로 교체한다:

```js
  async function handle(utterance, history = []) {
    const { text, removed } = scrubPII(utterance);

    let menus = [];
    try {
      menus = await router.search(text, { topK: 5 });
    } catch {
      menus = [];
    }

    const audit = {
      sentToLLM: text,
      piiRemoved: removed,
      candidates: menus.map((m) => m.id),
      toolCalls: [],
      blockedCalls: [],
    };

    let res;
    try {
      res = await llm.chat({ utterance: text, history, tools: toOpenAITools(tools), menuCandidates: menus });
    } catch {
      // 우아한 실패 — 도구를 못 골라도 위치는 안내한다
      return { layer: "L1", message: describeMenus(menus), menus, audit };
    }

    const call = res.toolCalls?.[0];
    if (!call) return { layer: "L1", message: res.message || describeMenus(menus), menus, audit };

    const tool = tools[call.name];
    if (!tool) return { layer: "L1", message: describeMenus(menus), menus, audit };

    if (!tool.requiresAuth) {
      try {
        audit.toolCalls.push(call.name);
        const plan = await executor.prepare(call.name, call.args);
        const data = await executor.execute(plan.planId, null);
        return { layer: "L2", message: res.message, data, menus, audit };
      } catch {
        return { layer: "L1", message: `지금은 처리할 수 없습니다. ${describeMenus(menus)}`, menus, audit };
      }
    }

    let impact;
    try {
      impact = await impactFn(call.name, call.args);
    } catch {
      return { layer: "L1", message: `지금은 처리할 수 없습니다. ${describeMenus(menus)}`, menus, audit };
    }
    if (impact.blocked) return { layer: "L3", message: impact.reason, menus, audit };

    const plan = await executor.prepare(call.name, call.args);
    audit.blockedCalls.push(call.name);
    return { layer: "L3", message: res.message, plan, warnings: impact.warnings, menus, audit };
  }
```

그리고 `describeMenus`의 첫 줄을 아래로 교체한다:

```js
  if (!menus.length) return "지금은 찾지 못했습니다. 조금 더 구체적으로 말씀해 주시겠어요?";
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `node --test tests/fallback.test.js tests/orchestrator.test.js`
Expected: PASS — 9 tests (신규 3 + 기존 6)

- [ ] **Step 5: 데모 각본 작성**

`docs/demo-script.md`:

```markdown
# 「지문까지」 시연 각본

전제: 화면 우측 「AI 판단 로그」를 항상 열어둔다. 보안 질문이 나오기 전에 화면이 먼저 답한다.

## 1. 자동이체 해지 — 은행 (L3)

입력: `통신비 자동으로 나가는 거 그만하고 싶어`

짚을 것:
- 사용자는 "자동납부"라는 단어를 쓰지 않았다
- KB 개인뱅킹에는 '자동' 계열 메뉴가 16개이고 자동이체·자동납부·자동송금으로 갈린다
- 부수효과 경고: 미납 시 통신 서비스 정지
- 판단 로그의 `⛔ cancel_autopay() — AuthGate 미통과, 호출 불가`

## 2. 카드 혜택 실적 — 카드 (L2)

입력: `이번 달 카드 얼마나 더 써야 혜택 받아?`

짚을 것:
- KB국민카드 인기 메뉴 5위가 「나의카드할인한도조회」다. 이름만으로는 알 수 없다
- 계열사가 은행에서 카드로 넘어갔는데 사용자는 몰랐다

## 3. 세금 서류 — 은행 + 증권 (L3)

입력: `세금 신고해야 하는데 금융 서류 뭐뭐 떼야 돼?` → `작년에 해외주식 팔았어`

짚을 것:
- 같은 목적의 서류가 계열사마다 이름이 다르다
  예금잔액증명서(은행) ↔ 잔고증명서(증권), 금융소득종합과세 조회 ↔ 금융소득증명서
- 신고 기한 5월 31일을 함께 안내한다

## 4. 연금 — 3사 통합 (L2) ★ 하이라이트

입력: `내 연금 어디 들어가 있지?`

짚을 것:
- 은행 퇴직연금 / 증권 IRP / 라이프 연금보험이 각각 다른 곳에 있다
- 사용자는 "KB"라고 생각하지 "은행/증권/보험"이라고 생각하지 않는다
- IRP에 운용지시가 없다는 경고까지 함께 나온다

## 5. 전화 — 고령층 (phone.html)

입력: `이번 달에 통장에서 돈이 자꾸 빠져나가는데 뭔지를 모르겠어`

짚을 것:
- KB 어르신전용 1644-3308은 실재하는 번호다. 새 채널을 만드는 게 아니라 그 뒤의 ARS를 바꾸는 제안이다
- 한 번에 하나씩, 3초를 기다리고, 금액을 두 번 말한다
- ChatGPT 음성 모드가 아니라 창구 직원의 말투다

## 6. "아무 말이나 시켜보세요"

심사위원에게 즉석 입력을 받는다.

- L3 대상이면 실행 준비까지 보여준다
- L2 대상이면 데이터를 조합해 답한다
- 둘 다 아니어도 **L1이 위치를 안내한다.** 인덱스 안에 있으면 반드시 답이 나온다

폴백: 그래도 못 찾으면 화면이 이렇게 말한다 —
"지금은 찾지 못했습니다. 조금 더 구체적으로 말씀해 주시겠어요?"
**우아한 실패는 오히려 신뢰를 준다.** 이 발화는 자동 수집되어 커버리지 보강 루프로 들어간다.
```

- [ ] **Step 6: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 전체 통과

- [ ] **Step 7: 커밋**

```bash
git add docs/demo-script.md src/orchestrator.js tests/fallback.test.js
git commit -m "feat: 우아한 실패 폴백과 시연 각본"
```

---

## 제출 전 최종 점검 (8/2~8/3)

- [ ] `npm test` 전체 통과
- [ ] `data/coverage-report.json`의 Top-3가 목표치 이상
- [ ] `data/tool-eval-report.json`에 대형·소형 모델 두 결과가 기록됨
- [ ] 기존 `hsh2578/im-ai-bank` 저장소가 손대지 않은 상태인지 재확인
- [ ] 저장소에 API 키가 커밋되지 않았는지 확인 (`git log -p | grep -i "sk-"`)
- [ ] 참가신청서·서약서·개인정보 동의서 서명 및 스캔
- [ ] 참가신청서 「AI 활용 내용」 표를 실제 사용 도구와 일치시킴
- [ ] 기술설명서 PPT — 배점 6항목을 목차로
- [ ] 데모 영상 (앱 4개 + 전화 1개)
- [ ] GitHub 최종 커밋 후 태그: `git tag -a submit-2026-08-03 -m "KB AI Challenge 제출본"`
- [ ] **8/3 16:00 이후 커밋 금지**
- [ ] zip 패키징 후 오전 중 제출
