// 자동 시연 — 발표자가 타이핑하지 않아도 상담 한 판이 돈다.
//
// 시연은 '질문 목록'이 아니라 '한 번의 상담'이어야 한다.
// 고객이 ARS 상담원을 찾는 이유는 두 가지다 — 원하는 게 뭔지 모르거나,
// 알아도 어디서 어떻게 하는지 모르거나. 아래 네 막이 그 둘을 지난다.
//
// ★ 한 가지 규칙: 하나를 시작했으면 끝내고 넘어간다.
//   예전 시연은 AI가 "다른 것도 정리해 드릴까요?" 하고 물으면 다음 발화가
//   엉뚱한 주제로 갔다. 벽에다 말하는 꼴이었고, 대화가 계속 끊기는 느낌을 줬다.
//   이제 AI가 제안하면 반드시 그 제안에 답한다 — 받아들이든, 거절하든.
//   거절도 대화다. "아니 그건 됐고" 한마디면 주제 전환이 자연스러워진다.
export const DEMO_STEPS = [
  // ── 1막. 증상 → 진단 → 해지까지 끝낸다 ──────────────────
  {
    say: "요즘 돈이 자꾸 새는 것 같은데",
    note: "요청이 아니라 증상입니다. 검색어가 없으니 메뉴로는 찾을 수 없습니다.",
  },
  {
    say: "케이블 방송은 안 본 지 오래됐어",
    note: "'해지해줘'라고 하지 않았습니다. 목록 중 하나를 가리켰을 뿐입니다.",
    execute: true,
  },
  {
    // AI: "다른 것도 정리해 드릴까요?" → 답하고 넘어간다
    say: "나머지는 계속 쓸 거야. 대신 이번 달 카드값이 궁금한데",
    note: "AI의 제안에 답하고 다음으로 넘어갑니다. 거절도 대화입니다.",
  },
  {
    // AI: "할부로 나가는 금액도 따로 보시겠어요?" → 받아들인다
    say: "응 할부도 보여줘",
    note: "총 할부원금이 아니라 이번 달 청구액을 답합니다. 통장에서 빠져나갈 돈이 궁금한 겁니다.",
  },
  {
    // AI: "기간을 늘리면 매달 부담이 줄어요. 바꿔 드릴까요?" → 거절하고 전환
    say: "그건 놔둬. 그보다 돈 좀 보내야 하는데",
    note: "제안을 거절하고 새 용건으로 넘어갑니다. 흐름이 끊기지 않습니다.",
  },

  // ── 2막. 세 번에 걸쳐 조각을 모아 이체를 끝낸다 ──────────
  {
    say: "아들",
    note: "한 번에 하나씩만 묻습니다. 듣지 않은 이름을 지어내지 않습니다.",
  },
  {
    say: "30만원",
    note: "세 번의 대화로 조각이 다 모였습니다. 누구에게인지 다시 묻지 않습니다.",
    execute: true,
  },
  {
    // AI: "더 도와드릴 일 있으세요?" → 답한다
    say: "응, 나 받을 수 있는 거 뭐 없나?",
    note: "무엇을 받을 수 있는지조차 모르는 상태입니다.",
  },

  // ── 3막. 몰라서 못 받던 돈을 찾아 신청까지 끝낸다 ────────
  {
    // AI: "신청해 드릴까요?" → 받아들인다
    say: "고유가 지원금 신청해줘",
    note: "정식 명칭은 「고유가 유류비 지원금」입니다. 가운데를 빼먹어도 찾아냅니다.",
    execute: true,
  },
  {
    // AI: "받으실 수 있는 지원금이 더 있어요. 같이 볼까요?" → 답하고 전환
    say: "그건 나중에. 내 연금은 어디 들어가 있지?",
    note: "은행·증권·보험 세 곳에 흩어져 있습니다. 고객은 'KB'라고 생각합니다.",
  },

  // ── 4막. 3사에 흩어진 것을 한 대화에서 끝낸다 ────────────
  {
    // AI: "운용지시가 없는 계좌가 있어요. 어떻게 할지 같이 볼까요?" → 되묻는다
    say: "운용지시가 없다는 게 무슨 말이야?",
    note: "모르는 말이 나오면 되물을 수 있어야 상담입니다.",
  },
  {
    say: "알겠어. 세금 신고할 때 필요한 서류는 뭐뭐 떼야 돼?",
    note: "같은 목적의 서류가 계열사마다 이름이 다릅니다. 예금잔액증명서(은행) ↔ 잔고증명서(증권).",
  },
  {
    // AI: "필요한 서류를 말씀하시면 바로 발급해 드릴게요." → 답한다
    say: "잔고증명서 하나 떼줘",
    note: "은행 것인지 증권 것인지 고객은 몰라도 됩니다. AI가 KB증권으로 보냅니다.",
    execute: true,
  },
  {
    // AI: "다른 서류도 필요하세요?" → 답하고 전환
    say: "아니 그거면 돼. 카드 명세서만 엑셀로 뽑아줘",
    note: "돈이 움직이지 않아도 개인정보가 움직입니다. 실행 전에 그 사실을 먼저 알립니다.",
    execute: true,
  },
  {
    // AI: "다른 달도 필요하시면 말씀해 주세요." → 답하고 전환
    say: "이번 달만 있으면 돼. 대출은 얼마나 남았어?",
    note: "은행 잔액도 같은 대화 안에서 이어집니다. 앱을 옮겨 다닐 필요가 없습니다.",
  },
  {
    say: "만기 다가오는 상품도 있어?",
    note: "묻지 않았으면 놓쳤을 일입니다. 만기는 알림이 와도 어디를 봐야 하는지 모르는 항목입니다.",
  },
  {
    // AI: "만기 이후를 어떻게 할지 같이 정할까요?" → 답하고 전환
    say: "그건 만기 때 다시 얘기하자. 증권 계좌엔 뭐 들고 있어?",
    note: "은행 앱 안에서 증권 보유 종목까지 이어집니다.",
  },
  {
    say: "이번 달 카드 혜택은 얼마나 남았어?",
    note: "KB국민카드 인기 메뉴 5위 「나의카드할인한도조회」. 이름만으로는 무슨 메뉴인지 알 수 없습니다.",
  },

  // ── 5막. 못 하는 것도 정직하게 ──────────────────────────
  {
    say: "다음 주에 해외 나가는데 뭐 준비해야 돼?",
    note: "'환전'이라고 말한 적이 없습니다. 생활 사건을 금융 행동으로 옮깁니다.",
  },
  {
    say: "환율 우대는 어디서 받아?",
    note: "실행할 도구가 없어도 위치는 반드시 안내합니다. 오프라인에서도 지켜지는 최소 약속입니다.",
  },
];

// 시연 영상용 호흡.
// 처음엔 8초씩 기다렸는데 "느리다"는 지적을 받았다. 응답이 3초쯤 걸리므로
// 실제로 화면이 멈춰 있는 시간은 그보다 짧지만, 그래도 늘어졌다.
// 읽을 수는 있으면서 늘어지지 않는 선으로 줄인다.
const TYPE_MS = 34;          // 글자당 타이핑 간격
const AFTER_SEND_MS = 5600;  // 응답을 읽을 시간
const BETWEEN_MS = 1200;     // 다음 시나리오까지

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
  const INTRO_MS = 5500;
  const OUTRO_MS = 9000;

  async function run() {
    setCaption("KB국민은행·KB국민카드·KB증권 2,656개 메뉴. 지금부터 메뉴는 한 번도 누르지 않습니다.");
    await sleep(INTRO_MS);
    if (cancelled) return;

    for (const step of DEMO_STEPS) {
      if (cancelled) break;

      setCaption(step.note);
      await type(step.say);
      if (cancelled) break;

      await sleep(360);
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await sleep(AFTER_SEND_MS);
      if (cancelled) break;

      // L3 — 인증이 걸린 계획이 화면에 있으면 시연이 대신 눌러 실행까지 보여준다.
      //
      // 인증을 건너뛰는 것이 아니다. AuthGate 는 그대로 증명을 요구하고, 이때
      // 쓰이는 것은 method:"demo-fallback" 증명이라 판단 로그에 "기기 인증기
      // 미사용"이 그대로 남는다. 사람이 직접 누르면 기기 인증기를 거친다.
      const pending = document.querySelector("button.auth:not(:disabled)");
      if (step.execute && pending) {
        pending.classList.add("is-calling");
        pending.scrollIntoView({ block: "nearest" });
        await sleep(1300);
        if (cancelled) break;
        pending.click(); // 지문 오버레이가 뜨고, 인증이 끝나면 스스로 닫힌다
        await sleep(4600); // 확인 1.5s + 통과 1.1s + 결과를 읽을 시간
      }
      if (cancelled) break;

      await sleep(BETWEEN_MS);
    }

    if (!cancelled) {
      // 개수를 손으로 적어두면 시나리오를 고칠 때마다 틀린다 — 목록에서 센다.
      const 실행 = DEMO_STEPS.filter((s) => s.execute).length;
      setCaption(`한 번의 대화로 실행 ${실행}건. 메뉴는 한 번도 누르지 않았습니다.`);
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
