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
