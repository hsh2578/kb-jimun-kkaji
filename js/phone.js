// 전화 채널 진입점. data/index.json이 아직 없어도(백그라운드 생성 중) 통화는 죽지 않는다.
// 화면 렌더링 보안 규칙은 js/ui.js와 동일: 사용자 입력·도구 결과·LLM 출력은 textContent로만 꽂는다.
import { createOrchestrator } from "../src/orchestrator.js";
import { createRouter } from "../src/router/menu-router.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
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
  u.rate = 0.85; // ① 천천히 — 고령층 음성 원칙, 임의로 올리지 않는다
  window.speechSynthesis.speak(u);
}

async function handle(text) {
  line("user", text);
  // (I6) keydown/음성 인식 콜백은 await하지 않고 handle()을 부른다 — 여기서 던진 예외는
  // 잡아주지 않으면 조용한 미응답 상태로 남는다. 반드시 화면·음성으로 실패를 알린다.
  try {
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
