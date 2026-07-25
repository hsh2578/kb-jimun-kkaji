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
