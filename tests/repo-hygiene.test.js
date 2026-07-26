import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("package.json은 ESM이고 외부 의존성이 없다", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test(".gitignore가 비밀 파일을 제외한다", () => {
  const ig = readFileSync(".gitignore", "utf8");
  for (const p of [".env", ".vercel"]) {
    assert.ok(ig.includes(p), `${p} 누락`);
  }
});

// config.local.js 는 반드시 커밋되어 있어야 한다.
// 예전에는 이 파일을 .gitignore 에 넣어두고 CLI 배포(vercel --prod)가 로컬 파일을
// 함께 올리는 데 기대고 있었다. GitHub 연동으로 바꾸자 빌드가 레포에서만 파일을
// 받으면서 이 파일이 사라졌고, index.html 의 onerror 폴백이 mode:"rules" 로
// 떨어져 화면 전체가 "오프라인 모드"가 됐다 — 조회도 실행도 전부 죽었다.
// 배포 방식이 바뀌어도 다시 그렇게 되지 않도록 여기서 못 박는다.
test("config.local.js 는 커밋되어 있다 — 없으면 배포가 오프라인 모드로 떨어진다", () => {
  assert.ok(existsSync("config.local.js"), "config.local.js 없음");
  const tracked = execFileSync("git", ["ls-files", "config.local.js"], { encoding: "utf8" }).trim();
  assert.equal(tracked, "config.local.js", "config.local.js 가 git에 추적되고 있지 않다");
});

// 위 규칙이 성립하는 유일한 근거는 "이 파일에 비밀이 없다"는 것이다.
// 언젠가 키를 여기 적으면 그 근거가 무너지므로, 그때 실패해야 한다.
test("config.local.js 에는 비밀이 없다", () => {
  const s = readFileSync("config.local.js", "utf8");
  assert.ok(!/sk-|api[_-]?key|secret|token|Bearer/i.test(s), "config.local.js 에 비밀로 보이는 값이 있다");
});

test("저장소에 iM 브랜딩이 남아 있지 않다", () => {
  const files = ["index.html", "README.md", "config.example.js"];
  for (const f of files) {
    assert.ok(existsSync(f), `${f} 없음`);
    const s = readFileSync(f, "utf8");
    assert.ok(!/iM뱅크|im-ai-bank|IM_CONFIG/.test(s), `${f}에 iM 흔적`);
  }
});
