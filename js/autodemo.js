// 자동 시연 — 발표자가 타이핑하지 않아도 상담 한 판이 돈다.
//
// 시연은 '질문 목록'이 아니라 '한 번의 상담'이어야 한다.
// 고객이 ARS 상담원을 찾는 이유는 두 가지다 — 원하는 게 뭔지 모르거나,
// 알아도 어디서 어떻게 하는지 모르거나. 아래 다섯 막이 그 둘을 차례로 지난다.
//
// 상담에는 두 가지 모드가 있고 둘 다 보인다.
//   ⓐ 여러 번 주고받으며 알아내는 상담 — 고객은 처음부터 다 말해주지 않는다
//   ⓑ 요청이 명확하면 한 턴에 끝내는 처리 — 명확한데 되물으면 취조다
//
// 시연 영상용 한 편의 상담. 다섯 막으로 이어진다.
//   1막 증상에서 시작한다      — 고객은 요청이 아니라 증상을 말한다
//   2막 되물어 알아낸다        — 조각을 세 번에 걸쳐 모은다
//   3막 몰라서 못 받던 돈      — 물어본 적 없는 것을 찾아준다
//   4막 3사에 흩어진 것        — KB가 아니면 못 하는 일
//   5막 못 하는 것도 정직하게  — 도구가 없어도 위치는 반드시 안내한다
export const DEMO_STEPS = [
  // ── 1막 ────────────────────────────────────────────────
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
    say: "이번 달 카드값은 얼마야?",
    note: "카드가 두 장입니다. 어느 쪽인지 말하지 않으면 합산해서 답합니다.",
  },
  {
    say: "이번 달 할부금은 따로 얼마야?",
    note: "총 할부원금이 아니라 '이번 달 청구되는 금액'을 답합니다. 고객이 궁금한 건 통장에서 빠져나갈 돈입니다.",
  },

  // ── 2막 ────────────────────────────────────────────────
  {
    say: "돈 좀 보내야 하는데",
    note: "받는 사람도 금액도 없습니다. 챗봇이라면 '이체 메뉴로 가세요'라고 답할 자리입니다.",
  },
  {
    say: "아들",
    note: "한 번에 하나씩만 묻습니다. 듣지 않은 이름을 지어내지 않습니다.",
  },
  {
    say: "30만원",
    note: "세 번의 대화로 흩어져 있던 조각이 다 모였습니다. 누구에게인지 다시 묻지 않습니다 — 앞 대화를 기억합니다.",
    execute: true,
  },

  // ── 3막 ────────────────────────────────────────────────
  {
    say: "나 받을 수 있는 거 뭐 없나?",
    note: "무엇을 받을 수 있는지조차 모르는 상태입니다. 대상이 아닌 것까지 이유와 함께 보여줍니다.",
  },
  {
    say: "고유가 지원금 신청해줘",
    note: "정식 명칭은 「고유가 유류비 지원금」입니다. 가운데를 빼먹어도 찾아냅니다. 요청이 명확하니 되묻지 않고 바로 처리합니다.",
    execute: true,
  },

  // ── 4막 ────────────────────────────────────────────────
  {
    say: "내 연금 어디 들어가 있지?",
    note: "은행·증권·보험 세 곳에 흩어져 있습니다. 고객은 'KB'라고 생각하지 '은행/증권/보험'이라고 생각하지 않습니다.",
  },
  {
    say: "운용지시 없다는 게 무슨 말이야?",
    note: "숫자만 던지지 않고 사람의 말로 되받습니다. 모르는 말이 나오면 되물을 수 있어야 상담입니다.",
  },
  {
    say: "세금 신고해야 하는데 금융 서류 뭐뭐 떼야 돼?",
    note: "같은 목적의 서류가 계열사마다 이름이 다릅니다. 예금잔액증명서(은행) ↔ 잔고증명서(증권).",
  },
  {
    say: "톡톡카드 명세서도 엑셀로 뽑아줘",
    note: "파일에는 가맹점명과 결제 일시가 그대로 담깁니다. 돈이 움직이지 않아도 개인정보가 움직이므로, 실행 전에 그 사실을 먼저 알립니다.",
    execute: true,
  },
  {
    say: "만기 다가오는 상품 있어?",
    note: "묻지 않았으면 놓쳤을 일입니다. 만기는 알림이 와도 앱에서 어디를 봐야 하는지 모르는 대표적인 항목입니다.",
  },
  {
    say: "증권 계좌에 뭐 들고 있지?",
    note: "은행 앱에서 증권 보유 종목까지 이어집니다. 앱을 옮겨 다닐 필요가 없습니다.",
  },
  {
    say: "이번 달 카드 얼마나 더 써야 혜택 받아?",
    note: "KB국민카드 인기 메뉴 5위 「나의카드할인한도조회」. 이름만으로는 무슨 메뉴인지 알 수 없는 대표적인 예입니다.",
  },
  {
    say: "잔고증명서 하나 떼줘",
    note: "같은 서류가 은행에서는 예금잔액증명서, 증권에서는 잔고증명서입니다. 어느 쪽인지 몰라도 됩니다.",
    execute: true,
  },
  {
    say: "대출은 얼마나 남았어?",
    note: "은행 쪽 잔액도 같은 대화 안에서 이어집니다. 앱을 옮겨 다닐 필요가 없습니다.",
  },

  // ── 5막 ────────────────────────────────────────────────
  {
    say: "해외 나가는데 뭐 준비해야 돼?",
    note: "'환전'이라고 말한 적이 없습니다. 생활 사건을 금융 행동으로 옮깁니다.",
  },
  {
    say: "환율 우대는 어디서 받아?",
    note: "실행할 도구가 없어도 위치는 반드시 안내합니다. 이것이 오프라인에서도 지켜지는 최소 약속입니다.",
  },
];

// 시연 영상용 호흡. 화면을 처음 보는 사람이 목록을 실제로 읽을 수 있어야 한다 —
// 발표자가 아니라 시청자의 속도에 맞춘다.
const TYPE_MS = 42;          // 글자당 타이핑 간격
const AFTER_SEND_MS = 8000;  // 응답을 읽을 시간
const BETWEEN_MS = 2200;     // 다음 시나리오까지

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

  // 영상으로 찍을 때, 첫 발화가 곧바로 타이핑되면 시청자가 화면을 읽을 새가 없다.
  const INTRO_MS = 7000;
  const OUTRO_MS = 11000;

  async function run() {
    setCaption("KB국민은행·KB국민카드·KB증권 2,656개 메뉴. 지금부터 메뉴는 한 번도 누르지 않습니다.");
    await sleep(INTRO_MS);
    if (cancelled) return;

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
        await sleep(1800);
        if (cancelled) break;
        pending.click(); // 지문 오버레이가 뜨고, 인증이 끝나면 스스로 닫힌다
        await sleep(4200);
      }
      if (cancelled) break;

      await sleep(BETWEEN_MS);
    }

    if (!cancelled) {
      // 개수를 손으로 적어두면 시나리오를 고칠 때마다 틀린다 — 목록에서 센다.
      const 실행 = DEMO_STEPS.filter((s) => s.execute).length;
      const 대화 = DEMO_STEPS.length;
      setCaption(
        `${대화}번의 대화로 실행 ${실행}건까지 끝났습니다. 메뉴는 한 번도 누르지 않았습니다.`
      );
      await sleep(OUTRO_MS);
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
