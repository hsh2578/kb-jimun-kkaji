// 자동 시연 — 발표자가 타이핑하지 않아도 시나리오가 순서대로 돈다.
//
// 한 가지 의도적인 제약: L3(실행) 단계에서는 자동으로 진행하지 않고 멈춘다.
// WebAuthn은 사용자 제스처가 있어야 인증기가 뜨므로 프로그램이 대신 누를 수 없고,
// 무엇보다 "실행은 사람이 인증해야 한다"는 것이 이 제품의 주장이다.
// 자동 시연이 그 주장을 스스로 어기면 안 된다.

// 시연은 '질문 목록'이 아니라 '한 번의 상담'이어야 한다.
// 고객이 ARS 상담원을 찾는 이유는 두 가지다 — 원하는 게 뭔지 모르거나(①),
// 알아도 어디서 어떻게 하는지 모르거나(②). 아래 순서가 그 두 가지를 차례로 지난다.
//   ① 증상만 말함  → 진단해서 먼저 보여줌
//   ② 하고 싶은 걸 말함 → 부족한 정보를 되물어 채우고 → 실행 직전까지
export const DEMO_STEPS = [
  {
    say: "요즘 돈이 자꾸 새는 것 같은데",
    note: "① 요청이 아니라 증상입니다. 검색어가 없으니 메뉴로는 못 찾습니다. AI가 '매달 빠져나가는 돈'으로 해석해 먼저 보여줍니다.",
  },
  {
    say: "이번 달 카드값이랑 할부는 얼마야?",
    note: "한 문장에 두 가지를 물었습니다. 카드 2장 합계와 이번 달 할부 청구액은 서로 다른 데이터입니다.",
  },
  {
    say: "고유가 지원금 신청할 수 있어?",
    note: "② 정식 명칭은 「고유가 유류비 지원금」입니다. 가운데를 빼먹어도 찾아냅니다. 몰라서 못 받는 돈이 여기 있습니다.",
  },
  {
    say: "아들한테 이체해줘",
    note: "금액을 말하지 않았습니다. 챗봇은 여기서 멈추고, 상담원은 되묻습니다. 추측해서 보내지 않습니다.",
  },
  {
    say: "30만원",
    note: "앞 대화를 기억합니다. '누구에게'를 다시 묻지 않습니다 — 이게 명령이 아니라 대화인 이유입니다.",
    stopForAuth: true,
  },
];

const TYPE_MS = 42;      // 글자당 타이핑 간격
const AFTER_SEND_MS = 5200;  // 응답을 읽을 시간
const BETWEEN_MS = 1400;     // 다음 시나리오까지

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createAutoDemo({ input, form, button, caption, onStop }) {
  let running = false;
  let cancelled = false;

  function setCaption(text) {
    caption.textContent = text ?? "";
    caption.classList.toggle("is-on", Boolean(text));
  }

  async function type(text) {
    input.value = "";
    input.focus();
    for (const ch of text) {
      if (cancelled) return;
      input.value += ch;
      await sleep(TYPE_MS);
    }
  }

  async function run() {
    for (const step of DEMO_STEPS) {
      if (cancelled) break;

      setCaption(step.note);
      await type(step.say);
      if (cancelled) break;

      await sleep(420);
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await sleep(AFTER_SEND_MS);
      if (cancelled) break;

      // L3 — 인증이 걸린 계획이 화면에 있으면 여기서 멈춘다.
      const pending = document.querySelector("button.auth:not(:disabled)");
      if (step.stopForAuth && pending) {
        setCaption("여기서 멈춥니다 — 실행은 사람이 인증해야 합니다. 🔒 버튼을 직접 눌러보세요.");
        pending.classList.add("is-calling");
        pending.scrollIntoView({ block: "nearest" });
        stop();
        return;
      }

      await sleep(BETWEEN_MS);
    }

    if (!cancelled) setCaption("시연이 끝났습니다. 이제 아무 말이나 직접 입력해보세요.");
    stop({ keepCaption: true });
  }

  function start() {
    if (running) return;
    running = true;
    cancelled = false;
    button.classList.add("is-running");
    button.textContent = "■ 중지";
    input.readOnly = true;
    run();
  }

  function stop({ keepCaption = false } = {}) {
    cancelled = true;
    running = false;
    button.classList.remove("is-running");
    button.textContent = "▶ 자동 시연";
    input.readOnly = false;
    input.value = "";
    if (!keepCaption) setCaption("");
    onStop?.();
  }

  button.addEventListener("click", () => (running ? stop() : start()));

  return { start, stop, isRunning: () => running };
}
