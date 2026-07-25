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
