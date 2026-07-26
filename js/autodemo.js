// 자동 시연 — 발표자가 타이핑하지 않아도 시나리오가 순서대로 돈다.
//
// 한 가지 의도적인 제약: L3(실행) 단계에서는 자동으로 진행하지 않고 멈춘다.
// WebAuthn은 사용자 제스처가 있어야 인증기가 뜨므로 프로그램이 대신 누를 수 없고,
// 무엇보다 "실행은 사람이 인증해야 한다"는 것이 이 제품의 주장이다.
// 자동 시연이 그 주장을 스스로 어기면 안 된다.

export const DEMO_STEPS = [
  {
    say: "내 연금 어디 들어가 있지?",
    note: "은행·증권·보험 3사에 흩어진 연금을 한 번에. 고객은 'KB'라고 생각하지 '은행/증권/보험'이라고 생각하지 않습니다.",
  },
  {
    say: "이번 달 카드 얼마나 더 써야 혜택 받아?",
    note: "KB국민카드 인기 메뉴 5위 「나의카드할인한도조회」. 이름만으로는 무슨 메뉴인지 알 수 없습니다.",
  },
  {
    say: "세금 신고해야 하는데 금융 서류 뭐뭐 떼야 돼?",
    note: "같은 목적의 서류가 계열사마다 다른 이름입니다. 예금잔액증명서(은행) ↔ 잔고증명서(증권).",
  },
  {
    say: "통신비 자동으로 나가는 거 그만하고 싶어",
    note: "'자동납부'라고 말한 적이 없습니다. KB에는 '자동' 계열 메뉴가 16개입니다.",
    stopForAuth: true,
  },
  {
    say: "환율 우대 어디서 받아?",
    note: "실행할 도구가 없어도 위치는 반드시 안내합니다. L1은 오프라인에서도 지켜지는 최소 약속입니다.",
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
