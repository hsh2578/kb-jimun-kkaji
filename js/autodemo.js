// 자동 시연 — 발표자가 타이핑하지 않아도 상담 한 판이 돈다.
//
// 시연은 '질문 목록'이 아니라 '한 번의 상담'이어야 한다.
// 고객이 ARS 상담원을 찾는 이유는 두 가지다 — 원하는 게 뭔지 모르거나(①),
// 알아도 어디서 어떻게 하는지 모르거나(②). 아래 순서가 그 두 가지를 차례로 지난다.
//   ① 증상만 말함  → 진단해서 먼저 보여줌
//   ② 하고 싶은 걸 말함 → 부족한 정보를 되물어 채우고 → 실행 직전까지
// 상담에는 두 가지 모드가 있고, 둘 다 보여야 한다.
//   ⓐ 여러 번 주고받으며 원하는 걸 알아내는 상담 (3~5번 턴)
//      — 고객이 처음부터 다 말해주지 않는다. 조금씩 좁혀간다.
//   ⓑ 요청이 명확하면 한 턴에 끝내는 처리 (6번 턴)
//      — 명확한데도 되물으면 그건 상담이 아니라 취조다.
export const DEMO_STEPS = [
  {
    say: "요즘 돈이 자꾸 새는 것 같은데",
    note: "요청이 아니라 증상입니다. 검색어가 없으니 메뉴로는 찾을 수 없습니다. AI가 '매달 빠져나가는 돈'으로 해석해 먼저 보여주고, 다음 걸음을 제안합니다.",
  },
  {
    say: "케이블 방송은 안 본 지 오래됐어",
    note: "'해지해줘'라고 하지 않았습니다. 앞에서 본 목록 중 하나를 가리켰을 뿐인데 실행 계획이 만들어집니다.",
    execute: true,
  },
  {
    say: "돈 좀 보내야 하는데",
    note: "받는 사람도 금액도 없습니다. 챗봇이라면 '이체 메뉴로 가세요'라고 답할 자리입니다.",
  },
  {
    say: "아들",
    note: "한 번에 하나씩만 묻습니다. 받는 사람을 알았으니 이제 금액을 묻습니다 — 취조가 아니라 상담입니다.",
  },
  {
    say: "30만원",
    note: "세 번의 대화로 흩어져 있던 조각이 다 모였습니다. 앞 대화를 기억하므로 누구에게인지 다시 묻지 않습니다.",
    execute: true,
  },
  {
    say: "고유가 지원금 신청해줘",
    note: "이번엔 요청이 명확합니다. 명확한데도 되물으면 상담이 아니라 취조입니다. 바로 처리합니다.",
    execute: true,
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

      // L3 — 인증이 걸린 계획이 화면에 있으면 시연이 대신 눌러 실행까지 보여준다.
      //
      // 예전에는 여기서 멈췄다. "실행은 사람이 인증해야 한다"는 주장을 시연이
      // 스스로 지키게 하려던 것인데, 실제로는 시연이 매번 첫 실행 앞에서 끊겨
      // 심사위원이 "무엇을 대신 해주는가"를 끝까지 못 봤다. 이건 프로토타입이고,
      // 보여줘야 하는 것은 '실행까지 간다'는 사실이다.
      //
      // 인증을 건너뛰는 것이 아니다 — AuthGate 는 그대로 증명을 요구하고,
      // 이때 쓰이는 것은 method:"demo-fallback" 증명이라 화면과 판단 로그에
      // "실제 인증 아님"이 그대로 남는다. 사람이 직접 누르면 기기 인증기를 거친다.
      const pending = document.querySelector("button.auth:not(:disabled)");
      if (step.execute && pending) {
        setCaption("실행 직전입니다. 무엇을·어디에 하는지 보여준 뒤에만 진행합니다.");
        pending.classList.add("is-calling");
        pending.scrollIntoView({ block: "nearest" });
        await sleep(1500);
        if (cancelled) break;
        pending.click();
        await sleep(3200);
      }
      if (cancelled) break;

      await sleep(BETWEEN_MS);
    }

    if (!cancelled) {
      setCaption("한 번의 대화로 조회 1건과 실행 3건이 끝났습니다. 이제 아무 말이나 직접 해보세요.");
    }
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
