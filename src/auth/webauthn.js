// ⚠️ 정직 고지 — 이 파일이 증명하는 것과 증명하지 못하는 것.
//
// 이 모듈은 브라우저 내장 WebAuthn(navigator.credentials.create/get)만으로
// "지문/PIN 인증기를 실제로 거쳤다"는 것을 보여준다. 하지만 클라이언트 단독
// WebAuthn은 그 자체로 "진짜 보안"이 아니다 — assertion의 서명을 서버가 등록된
// 공개키로 검증하지 않으면, 악의적인 클라이언트는 이 파일 전체를 건너뛰고
// verifyWebAuthnProof()가 참을 반환할 모양의 객체를 그냥 만들어 issue()에 넘길 수
// 있다. 지금 이 프로토타입에는 그 서명을 검증할 서버가 없다 — 그래서
// verifyWebAuthnProof()는 "잘 만들어진 모양인가"만 확인하지, "이 서명이 등록된
// 공개키로 실제로 검증되는가"는 확인하지 못한다. 은행 실장에서는
// docs/superpowers/specs/2026-07-27-kb-jimun-kkaji-design.md 6-7-3절의 네이티브
// 브릿지 뒤 서버가 그 서명 검증을 대신한다.
//
// 그래도 이 파일이 하는 일에는 값어치가 있다.
//   1) AuthGate.issue(planId, proof)가 "증명 없이는 토큰 없음"을 강제하는 자리
//      (seam)를 실제로 만든다 — 전에는 issue(planId)가 아무 증거 없이 토큰을
//      찍어냈고, js/main.js가 한 번의 클릭으로 발급과 소비를 동시에 처리했다.
//      화면 어디에도 "인증을 확인하는 지점"이 없었다.
//   2) 데모 화면에서 사람이 실제로 이 기기의 인증기(지문·얼굴·PIN 등)를 거쳤다는
//      것을 물리적으로 보여준다 — 버튼만 누르면 통과하는 가짜가 아니다.
//   3) planId에서 파생한 challenge를 쓰므로, 계획 A에 대한 assertion을 계획 B에
//      재사용할 수 없다(아래 deriveChallenge 참고).
//
// 즉 이 파일은 "서버 검증 없이도 완결된 보안"이 아니라 "서버 검증이 꽂힐 자리를
// 실제로 파놓은 것"이다. 프레젠테이션에서 이 구분을 흐리지 않는다.

const encoder = new TextEncoder();

function hasWebAuthn() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}

// planId로부터 challenge를 파생시킨다 — "계획 A에 대한 지문 인증으로 계획 B를
// 실행할 수 없다"를 보장하는 지점. 매번 같은 planId에서 같은 challenge가
// 나오므로, 등록(create)과 확인(get)이 같은 값을 참조할 수 있다.
async function deriveChallenge(seed) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(seed)));
  return new Uint8Array(digest);
}

function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(arr).toString("base64"); // node --check 대상이지 실행 경로는 아니다
}

// 브라우저에서 실제로 WebAuthn 세리머니를 수행하는 제공자.
// 등록 정보는 인스턴스 안(클로저)에서만 산다 — 이 데모는 계정 시스템이 아니므로
// 새로고침하면 잊는다. 그것으로 충분하다.
export function createWebAuthnProvider() {
  let registeredCredentialId = null;

  function isAvailable() {
    return hasWebAuthn();
  }

  async function ensureRegistered(planId) {
    if (registeredCredentialId) return registeredCredentialId;
    const challenge = await deriveChallenge(`register:${planId}`);
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "지문까지 (데모)" },
        user: {
          // 데모이므로 challenge를 사용자 id로 재사용한다. 실제 서비스는
          // 은행이 이미 갖고 있는 고유 사용자 id를 쓴다.
          id: challenge,
          name: "demo-user",
          displayName: "데모 사용자",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { userVerification: "required" },
        timeout: 60000,
      },
    });
    if (!credential) throw new Error("WebAuthn 등록에 실패했습니다");
    registeredCredentialId = credential.id;
    return registeredCredentialId;
  }

  // planId를 받아 인증 세리머니를 수행하고 proof를 반환한다.
  // 최초 호출에서는 등록(create)까지 함께 수행한다 — 실제 은행 앱이라면 최초 1회
  // 앱 설치/로그인 시점에 이미 끝나 있을 절차다.
  async function authenticate(planId) {
    if (!hasWebAuthn()) {
      throw new Error("이 브라우저/기기는 WebAuthn을 지원하지 않습니다");
    }
    await ensureRegistered(planId);
    const challenge = await deriveChallenge(planId);
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (!assertion) throw new Error("WebAuthn 인증이 취소되었습니다");
    return {
      planId,
      credentialId: assertion.id,
      signature: toBase64(assertion.response.signature),
      challenge: toBase64(challenge),
      method: "webauthn",
    };
  }

  return { isAvailable, authenticate };
}

// AuthGate.issue()에 주입할 검증기 중 webauthn 몫. "잘 만들어진 모양인가 +
// planId가 일치하는가"만 본다 — 서명 자체를 공개키로 검증하지는 못한다(위 고지 참고).
export function verifyWebAuthnProof(proof, planId) {
  if (!proof || typeof proof !== "object") return false;
  if (proof.method !== "webauthn") return false;
  if (proof.planId !== planId) return false;
  if (typeof proof.credentialId !== "string" || !proof.credentialId) return false;
  if (typeof proof.signature !== "string" || !proof.signature) return false;
  if (typeof proof.challenge !== "string" || !proof.challenge) return false;
  return true;
}

// 인증기가 없는 기기(심사용 노트북, 전화 채널)를 위한 정직한 대체 경로.
// method가 "demo-fallback"으로 고정되어 있어, 이 값을 받은 쪽(js/ui.js,
// src/ui/format.js)이 반드시 "실제 인증 아님"을 화면에 표시하게 만든다 — 조용히
// webauthn과 같은 취급을 받을 수 없다.
export function createFallbackProof(planId) {
  return {
    planId,
    method: "demo-fallback",
    note: "WebAuthn 미지원 환경 — 시연 대체 인증(실제 인증 아님)",
  };
}

export function verifyFallbackProof(proof, planId) {
  if (!proof || typeof proof !== "object") return false;
  if (proof.method !== "demo-fallback") return false;
  if (proof.planId !== planId) return false;
  return true;
}

// AuthGate에 주입하는 통합 검증기. webauthn과 demo-fallback 둘 다 받아들이되,
// 어느 쪽이었는지는 proof.method에 그대로 남아 있으므로 화면 표시(js/ui.js,
// formatAuthEvent)가 절대 두 경우를 같은 문구로 뭉개지 않는다.
export function verifyAuthProof(proof, planId) {
  if (!proof || typeof proof !== "object") return false;
  if (proof.method === "webauthn") return verifyWebAuthnProof(proof, planId);
  if (proof.method === "demo-fallback") return verifyFallbackProof(proof, planId);
  return false;
}
