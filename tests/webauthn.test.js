import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWebAuthnProvider,
  describeAuthError,
  verifyWebAuthnProof,
  createFallbackProof,
  verifyFallbackProof,
  verifyAuthProof,
} from "../src/auth/webauthn.js";
import { createAuthGate } from "../src/exec/auth-gate.js";

// node --test는 브라우저가 아니다 — navigator.credentials가 없으므로 실제
// WebAuthn 세리머니(authenticate)는 여기서 실행할 수 없다("No browser available"
// 제약). 대신 (a) isAvailable()이 정직하게 false를 보고하는지, (b) 검증기들이
// 계약대로 동작하는지를 확인한다. 세리머니 자체의 검증은 사람이 브라우저에서
// 확인해야 한다.

test("브라우저가 아닌 환경에서는 isAvailable()이 false를 정직하게 보고한다", async () => {
  const provider = createWebAuthnProvider();
  assert.equal(await provider.isAvailable(), false);
});

// API가 있다는 것과 인증기가 있다는 것은 다르다.
// 크롬은 인증기 없는 노트북에서도 PublicKeyCredential 을 노출하므로, API 존재만
// 보고 WebAuthn 경로로 들어가면 credentials.create() 가 그제서야 터진다. 실측으로
// 브라우저의 영어 예외가 시연 화면에 그대로 찍혔다.
test("API는 있지만 인증기가 없으면 isAvailable()은 false다", async () => {
  // Node 24 의 globalThis.navigator 는 getter 전용이라 대입이 안 된다 — 속성을 갈아끼운다.
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const savedNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", {
    value: { PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => false } },
    configurable: true,
  });
  Object.defineProperty(globalThis, "navigator", { value: { credentials: {} }, configurable: true });
  try {
    assert.equal(await createWebAuthnProvider().isAvailable(), false);
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, "window", savedWindow);
    else delete globalThis.window;
    if (savedNav) Object.defineProperty(globalThis, "navigator", savedNav);
  }
});

test("describeAuthError는 브라우저 영어 예외를 한국어로 옮긴다", () => {
  const focus = describeAuthError(
    Object.assign(new Error("The operation is not allowed at this time because the page does not have focus."), {
      name: "NotAllowedError",
    })
  );
  assert.match(focus, /화면이 활성화/);
  assert.doesNotMatch(focus, /[A-Za-z]{6,}/, "영어 원문이 남아 있으면 안 된다");

  const cancelled = describeAuthError(Object.assign(new Error("timed out"), { name: "NotAllowedError" }));
  assert.match(cancelled, /취소|초과/);
  // 취소와 '인증기 없음'은 다른 사건이다 — 같은 문구로 뭉개면 안 된다.
  assert.notEqual(cancelled, describeAuthError(Object.assign(new Error("x"), { name: "NotSupportedError" })));
});

test("isAvailable()이 false인데 authenticate()를 부르면 조용히 통과하지 않고 던진다", async () => {
  const provider = createWebAuthnProvider();
  await assert.rejects(() => provider.authenticate("plan_1"), /WebAuthn/);
});

test("verifyWebAuthnProof: method가 webauthn이 아니면 거부한다", () => {
  assert.equal(
    verifyWebAuthnProof({ planId: "p1", method: "demo-fallback" }, "p1"),
    false
  );
});

test("verifyWebAuthnProof: planId가 다르면 거부한다 — 계획 A의 인증으로 계획 B를 실행할 수 없다", () => {
  const proof = {
    planId: "plan_A",
    method: "webauthn",
    credentialId: "cred1",
    signature: "sig1",
    challenge: "chal1",
  };
  assert.equal(verifyWebAuthnProof(proof, "plan_B"), false);
  assert.equal(verifyWebAuthnProof(proof, "plan_A"), true);
});

test("verifyWebAuthnProof: credentialId/signature/challenge 중 하나라도 없으면 거부한다", () => {
  const base = { planId: "p1", method: "webauthn", credentialId: "c", signature: "s", challenge: "ch" };
  for (const key of ["credentialId", "signature", "challenge"]) {
    const bad = { ...base, [key]: undefined };
    assert.equal(verifyWebAuthnProof(bad, "p1"), false, `${key} 누락을 거부해야 한다`);
  }
});

test("createFallbackProof: method가 demo-fallback으로 고정되어 있다", () => {
  const proof = createFallbackProof("plan_9");
  assert.equal(proof.method, "demo-fallback");
  assert.equal(proof.planId, "plan_9");
  assert.ok(/실제 인증 아님/.test(proof.note), "대체 인증임을 스스로 밝혀야 한다");
});

test("verifyFallbackProof: planId가 일치하고 method가 demo-fallback일 때만 통과한다", () => {
  const proof = createFallbackProof("plan_9");
  assert.equal(verifyFallbackProof(proof, "plan_9"), true);
  assert.equal(verifyFallbackProof(proof, "plan_다른것"), false);
  assert.equal(verifyFallbackProof({ ...proof, method: "webauthn" }, "plan_9"), false);
});

test("verifyAuthProof: webauthn과 demo-fallback을 모두 받아들이되 형식이 맞을 때만 통과한다", () => {
  const fallback = createFallbackProof("plan_1");
  assert.equal(verifyAuthProof(fallback, "plan_1"), true);

  const webauthnProof = { planId: "plan_1", method: "webauthn", credentialId: "c", signature: "s", challenge: "ch" };
  assert.equal(verifyAuthProof(webauthnProof, "plan_1"), true);

  assert.equal(verifyAuthProof({ planId: "plan_1", method: "무언가" }, "plan_1"), false);
  assert.equal(verifyAuthProof(null, "plan_1"), false);
});

// 통합 지점 — AuthGate는 기본적으로 모든 것을 거부한다(fail closed). verifyAuthProof를
// 주입해야만, 그리고 planId가 맞는 proof를 줘야만 토큰이 나온다는 것을 end-to-end로 확인한다.
test("AuthGate + verifyAuthProof: 올바른 fallback proof면 토큰을 내고, planId가 어긋나면 던진다", () => {
  const gate = createAuthGate({ verifyProof: verifyAuthProof });
  const proof = createFallbackProof("plan_1");
  const token = gate.issue("plan_1", proof);
  assert.equal(typeof token, "string");

  assert.throws(() => gate.issue("plan_2", proof), /인증/);
});

test("AuthGate 기본 검증기는 webauthn 모양의 proof도 주입 없이는 거부한다", () => {
  const gate = createAuthGate(); // verifyProof 주입 없음
  const webauthnProof = { planId: "plan_1", method: "webauthn", credentialId: "c", signature: "s", challenge: "ch" };
  assert.throws(() => gate.issue("plan_1", webauthnProof), /인증/);
});
