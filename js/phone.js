// 전화 채널 진입점. data/index.json이 아직 없어도(백그라운드 생성 중) 통화는 죽지 않는다.
// 화면 렌더링 보안 규칙은 js/ui.js와 동일: 사용자 입력·도구 결과·LLM 출력은 textContent로만 꽂는다.
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { verifyAuthProof, createFallbackProof } from "../src/auth/webauthn.js";
import { formatActionResult, formatAuthEvent } from "../src/ui/format.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { CLARIFY, CLARIFY_TOOL } from "../src/tools/clarify.js";
import { resolveAutopay } from "../src/exec/impact.js";
import { toSeniorSpeech, chunkOneAtATime, buildConfirmation, SILENCE_TOLERANCE_MS } from "../src/voice/senior-voice.js";

const cfg = window.KB_CONFIG ?? { mode: "rules" };

let index = { items: [], dim: 0 };
let indexReady = true;
try {
  const res = await fetch("./data/index.json");
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  index = await res.json();
} catch {
  indexReady = false;
}

const llm = createLLMAdapter({ kind: cfg.mode === "proxy" ? "proxy" : "stub", proxyUrl: cfg.proxyUrl ?? "" });
const router = createRouter({ items: index.items ?? [], dim: index.dim, embedFn: (t) => llm.embed(t) });
// 기본값은 fail-closed — verifyAuthProof를 주입해야 토큰이 나온다. 전화 채널은
// 브라우저 인증기가 없으므로 항상 대체 인증(demo-fallback) 경로를 쓴다 — js/main.js와
// 달리 webauthn.isAvailable()을 확인할 이유조차 없다.
const authGate = createAuthGate({ verifyProof: verifyAuthProof });
const orch = createOrchestrator({ router, llm, authGate, tools: { ...QUERY_TOOLS, ...ACTION_TOOLS, [CLARIFY]: CLARIFY_TOOL } });

const transcript = document.getElementById("transcript");
const sayInput = document.getElementById("say");

// L3 계획을 하나만 대기시킨다 — "번호를 눌러주세요" 이후 다음 입력을 그 확인으로
// 취급한다. 실제 ARS의 키패드 입력 자리이고, 여기서는 항상 대체 인증으로 처리한다.
let pendingPlan = null;

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
  u.rate = 0.85; // ① 천천히 — 고령층 음성 원칙, 임의로 올리지 않는다
  window.speechSynthesis.speak(u);
}

async function handle(text) {
  line("user", text);
  // (I6) keydown/음성 인식 콜백은 await하지 않고 handle()을 부른다 — 여기서 던진 예외는
  // 잡아주지 않으면 조용한 미응답 상태로 남는다. 반드시 화면·음성으로 실패를 알린다.
  try {
    // ⑥ 기존 인증 — 직전 턴에서 "번호를 눌러주세요"라고 안내했다면 이번 입력은
    // 새 발화가 아니라 그 확인(키패드 입력 자리)이다. 전화 채널에는 브라우저
    // 인증기가 없으므로 항상 대체 인증(demo-fallback)으로 처리하고, 실제 지문
    // 인증을 받은 것처럼 들리지 않도록 그 사실을 그대로 말해준다.
    if (pendingPlan) {
      const plan = pendingPlan;
      pendingPlan = null;
      try {
        const proof = createFallbackProof(plan.planId);
        const token = authGate.issue(plan.planId, proof);
        const out = await orch.confirm(plan.planId, token);
        speak(formatAuthEvent(proof));
        speak(toSeniorSpeech(formatActionResult(plan, out)));
      } catch (err) {
        speak("확인에 실패했습니다. 처음부터 다시 말씀해 주시겠어요?");
      }
      return;
    }

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
      // (M4) LLM이 넘긴 건 내부 id(autopay_id)나 힌트일 뿐, 고객이 알아들을 이름이 아니다.
      // 실제 등록명은 여기서 resolveAutopay로 되찾아야 "케이블 방송을(를) 멈추실까요?"처럼 말할 수 있다.
      const ap = resolveAutopay(r.plan.args ?? {});
      if (!ap) {
        speak("어떤 자동이체를 말씀하시는지 확인하지 못했습니다. 항목 이름을 다시 한번 말씀해 주시겠어요?");
        return;
      }
      speak(buildConfirmation({ // ⑤ 되풀이 확인
        verb: "멈추",
        target: ap.name,
        effect: r.warnings?.[0] ?? "다음 달부터 반영됩니다",
      }));
      pendingPlan = r.plan; // 다음 입력을 이 계획의 확인으로 취급한다
      speak("확인을 위해 문자로 보내드린 번호를 눌러주세요."); // ⑥ 기존 인증
      return;
    }

    speak(toSeniorSpeech(r.message ?? "다시 말씀해 주시겠어요?"));
  } catch (err) {
    speak("죄송합니다, 처리 중 문제가 발생했습니다. 다시 한번 말씀해 주시겠어요?");
  }
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

if (!indexReady) {
  line("bot", "메뉴 인덱스가 아직 준비되지 않았습니다");
}

speak("네, KB국민은행입니다. 무엇을 도와드릴까요?");
