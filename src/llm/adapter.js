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

// (C2) LLM 없이도 화면이 죽지 않게 하는 최소 응답.
// "처리할 준비가 되지 않았습니다"는 마치 일시적 오류처럼 읽혀서 정직하지 않다 —
// 이 모드는 config.local.js가 없거나 mode:"proxy"가 아니면 항상 켜지는, 의도된 저하 모드다.
// L2 조회·L3 실행은 이 모드에서 절대 불가능하다는 사실을 그대로 말한다.
function stubChat() {
  return {
    message: "오프라인 모드입니다. AI 조회·실행 없이 메뉴 위치만 안내해 드릴게요.",
    toolCalls: [],
  };
}
