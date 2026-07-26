// api/chat.js, api/embed.js — Vercel 서버리스 핸들러를 req/res 목으로 직접 호출해 검증한다.
// 네트워크(OpenAI)는 두 케이스(성공 경로, 깨진 tool_calls 인자)에서만 globalThis.fetch를 임시로 바꿔 흉내낸다.
import { test } from "node:test";
import assert from "node:assert/strict";

function mockRes() {
  return {
    statusCode: null,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { this.ended = true; return this; },
  };
}

// (M2) 모듈 최상단에서 process.env.ALLOW_ORIGIN을 읽어 상수로 고정하므로,
// 각 조합(ALLOW_ORIGIN 있음/없음)마다 격리된 프로세스에서 새로 import해야 한다.
function withEnv(env, fn) {
  return async () => {
    const saved = {};
    for (const k of Object.keys(env)) saved[k] = process.env[k];
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
}

for (const [label, modPath, sizeLimit] of [
  ["chat", "../api/chat.js", 100_000],
  ["embed", "../api/embed.js", 10_000],
]) {
  test(
    `${label}: ALLOW_ORIGIN 미설정이면 CORS 허용 헤더를 내지 않는다 (fail closed)`,
    withEnv({ ALLOW_ORIGIN: undefined }, async () => {
      const { default: handler } = await import(`${modPath}?case=noorigin-${label}`);
      const res = mockRes();
      await handler({ method: "OPTIONS" }, res);
      assert.equal(res.statusCode, 204);
      assert.equal(res.headers["Access-Control-Allow-Origin"], undefined, "ALLOW_ORIGIN 미설정 시 헤더가 없어야 한다");
    })
  );

  test(
    `${label}: ALLOW_ORIGIN을 설정하면 그 값을 그대로 돌려준다`,
    withEnv({ ALLOW_ORIGIN: "https://example.com" }, async () => {
      const { default: handler } = await import(`${modPath}?case=origin-${label}`);
      const res = mockRes();
      await handler({ method: "OPTIONS" }, res);
      assert.equal(res.headers["Access-Control-Allow-Origin"], "https://example.com");
    })
  );

  test(
    `${label}: POST 이외의 메서드는 405`,
    withEnv({}, async () => {
      const { default: handler } = await import(`${modPath}?case=method-${label}`);
      const res = mockRes();
      await handler({ method: "GET" }, res);
      assert.equal(res.statusCode, 405);
    })
  );

  test(
    `${label}: OPENAI_KEY 미설정이면 500`,
    withEnv({ OPENAI_KEY: undefined }, async () => {
      const { default: handler } = await import(`${modPath}?case=nokey-${label}`);
      const res = mockRes();
      await handler({ method: "POST", body: {} }, res);
      assert.equal(res.statusCode, 500);
    })
  );

  test(
    `${label}: 요청 본문이 너무 크면 413`,
    withEnv({ OPENAI_KEY: "sk-test" }, async () => {
      const { default: handler } = await import(`${modPath}?case=big-${label}`);
      const res = mockRes();
      const big = "x".repeat(sizeLimit + 1);
      await handler({ method: "POST", body: big }, res);
      assert.equal(res.statusCode, 413);
    })
  );

  test(
    `${label}: 본문이 올바른 JSON이 아니면 500이 아니라 400을 준다 (M2)`,
    withEnv({ OPENAI_KEY: "sk-test" }, async () => {
      const { default: handler } = await import(`${modPath}?case=badjson-${label}`);
      const res = mockRes();
      await handler({ method: "POST", body: "{ 이건 JSON이 아님" }, res);
      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error);
    })
  );
}

test(
  "chat: 업스트림이 깨진 tool_calls 인자를 주면 500이 아니라 400을 준다 (M2)",
  withEnv({ OPENAI_KEY: "sk-test", ALLOW_ORIGIN: "https://example.com" }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "",
            tool_calls: [{ function: { name: "cancel_autopay", arguments: "{ 이것도 JSON 아님" } }],
          },
        }],
      }),
    });
    try {
      const { default: handler } = await import("../api/chat.js?case=badtoolargs");
      const res = mockRes();
      await handler({ method: "POST", body: { utterance: "안녕", menuCandidates: [] } }, res);
      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error);
    } finally {
      globalThis.fetch = originalFetch;
    }
  })
);

test(
  "chat: 정상 응답이면 message·toolCalls를 그대로 돌려준다",
  withEnv({ OPENAI_KEY: "sk-test", ALLOW_ORIGIN: "https://example.com" }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: "안녕하세요",
            tool_calls: [{ function: { name: "cancel_autopay", arguments: '{"autopay_id":"ap1"}' } }],
          },
        }],
      }),
    });
    try {
      const { default: handler } = await import("../api/chat.js?case=ok");
      const res = mockRes();
      await handler({ method: "POST", body: { utterance: "통신비 해지", menuCandidates: [] } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.message, "안녕하세요");
      assert.deepEqual(res.body.toolCalls, [{ name: "cancel_autopay", args: { autopay_id: "ap1" } }]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  })
);

test(
  "chat: 업스트림이 실패 응답이면 502",
  withEnv({ OPENAI_KEY: "sk-test" }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    try {
      const { default: handler } = await import("../api/chat.js?case=upstreamfail");
      const res = mockRes();
      await handler({ method: "POST", body: { utterance: "안녕", menuCandidates: [] } }, res);
      assert.equal(res.statusCode, 502);
    } finally {
      globalThis.fetch = originalFetch;
    }
  })
);
