// 자동 시연 — 발표자가 타이핑하지 않아도 상담 한 판이 돈다.
//
// ★ 이 시연의 유일한 기준: 챗봇이 못 하는 것만 보여준다.
//
//   챗봇도 하는 것 (넣지 않는다)
//     · "○○ 메뉴에 있습니다" 라고 위치만 알려주기
//     · 상품 설명, 일반 상식 답변
//
//   챗봇이 못 하는 것 (이것만 넣는다)
//     · 실행 — 돈이 실제로 나가고 잔액이 바뀐다
//     · 지문 인증 — 실행 앞에 사람의 승인이 끼어든다
//     · 파일 — 명세서·증명서를 실제로 손에 쥐어준다
//     · 화면 열기 — 경로를 읽어주는 대신 그 화면을 연다
//     · 3사 통합 — 은행·카드·증권이 한 대화 안에 있다
//     · 되묻고 이어받기 — 조각난 정보를 모아 끝까지 간다
//     · 부수효과 경고 — 무슨 일이 벌어지는지 먼저 말한다
//
// 자막은 폰 안이 아니라 폰 밖 아래 자리에만 쓴다. 앱 화면과 겹치지 않는다.
// bot  = 챗봇이었다면 여기서 끝났을 지점
// ours = 우리가 실제로 한 일
export const DEMO_STEPS = [
  { say: "요즘 돈이 자꾸 새는 것 같은데",
    bot: "“자동이체 관리 메뉴에서 확인하세요”",
    ours: "은행·카드에 흩어진 출금을 모아 보여줍니다" },
  { say: "케이블 방송은 안 본 지 오래됐어", execute: true,
    bot: "“해지는 앱에서 직접 진행해 주세요”",
    ours: "해지를 실행합니다 — 중단 영향을 먼저 알리고, 지문으로" },

  { say: "나머지는 계속 쓸 거야. 대신 돈 좀 보내야 하는데",
    bot: "“이체 메뉴로 이동해 주세요”",
    ours: "받는 분부터 되묻습니다 — 지어내지 않습니다" },
  { say: "아들",
    bot: "“계좌번호를 입력해 주세요”",
    ours: "계좌번호 없이 관계만으로 찾습니다" },
  { say: "30만원", execute: true,
    bot: "이체는 할 수 없습니다",
    ours: "300,000원이 실제로 나가고 잔액이 바뀝니다" },

  { say: "고맙다. 나 받을 수 있는 거 뭐 없나?",
    bot: "“이벤트 페이지를 확인해 보세요”",
    ours: "대상이 아닌 것까지 이유와 함께 보여줍니다" },
  { say: "고유가 지원금 신청해줘", execute: true,
    bot: "“신청은 해당 메뉴에서 가능합니다”",
    ours: "신청을 접수합니다 — 남은 제출 서류까지 안내" },

  // 막아야 할 때 막는다 — 챗봇에는 막을 것 자체가 없다.
  { say: "청년 교통비 환급도 신청해줘",
    bot: "“자세한 내용은 이벤트 안내를 참고하세요”",
    ours: "대상이 아니라 실행하지 않습니다 — 이유까지 말합니다" },

  { say: "그건 나중에 보고. 내 연금은 어디 들어가 있지?",
    bot: "은행 챗봇은 은행 것만 압니다",
    ours: "은행·증권·보험 3사를 한 화면에" },

  // 실제 숫자. 위치를 답하면 챗봇이다.
  { say: "환율은 지금 얼마야?",
    bot: "“환율 조회 메뉴에서 확인하세요”",
    ours: "환율과 우대율을 숫자로 바로 보여줍니다" },

  // 잔액을 넘는 이체는 계획조차 만들지 않는다.
  { say: "아들한테 1억 보내줘",
    bot: "이체는 할 수 없습니다",
    ours: "잔액을 넘어 실행하지 않습니다 — 지문 버튼도 뜨지 않습니다" },

  // 지시대명사로 부른 상대를 찾아 실행까지.
  { say: "아까 보낸 데로 5만원만 더 보내줘", execute: true,
    bot: "“최근 이체 내역을 확인해 주세요”",
    ours: "‘아까 거기’를 최근 내역에서 찾아 보냅니다" },

  // 부담을 줄여주는 실행. 수수료 증가를 먼저 알린다.
  { say: "노트북 할부 6개월로 늘려줘", execute: true,
    bot: "“할부 변경은 카드 앱에서 가능합니다”",
    ours: "수수료가 늘어난다는 사실을 먼저 알리고 변경합니다" },

  { say: "잔고증명서 하나 떼줘", execute: true, download: true,
    bot: "“증명서 발급 메뉴로 가세요”",
    ours: "은행 것인지 증권 것인지 가려서 발급 — 파일까지" },
  { say: "카드 명세서도 엑셀로 뽑아줘", execute: true, download: true,
    bot: "“명세서는 앱에서 내려받으세요”",
    ours: "엑셀 파일을 실제로 만들어 손에 쥐어줍니다" },
  { say: "연말정산증명서도 하나 떼줘", execute: true, download: true,
    bot: "“제증명 발급 메뉴를 이용해 주세요”",
    ours: "은행 서류도 같은 대화 안에서 발급합니다" },

  { say: "이체한도 500만원으로 올려줘", execute: true,
    bot: "“한도 변경은 보안 메뉴에서 가능합니다”",
    ours: "보이스피싱 위험을 먼저 경고하고 실행합니다" },
  { say: "지갑을 잃어버렸어. 톡톡카드 분실신고 해줘", execute: true,
    bot: "“분실신고는 고객센터로 연락하세요”",
    ours: "분실신고를 즉시 접수합니다" },

  { say: "다음 주에 해외 나가는데 환전은 어디서 해?", openMenu: true,
    bot: "“개인뱅킹 > 외환 > 환전신청에 있습니다”",
    ours: "그 화면을 직접 엽니다 — 경로를 읽어주지 않습니다" },
];

// 시연 영상용 호흡.
const TYPE_MS = 34;          // 글자당 타이핑 간격
const AFTER_SEND_MS = 5600;  // 응답을 읽을 시간
const BETWEEN_MS = 1400;     // 다음 시나리오까지

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createAutoDemo({ input, form, button, setCaption, onStop }) {
  let running = false;
  let cancelled = false;

  async function type(text) {
    input.value = "";
    input.focus();
    for (const ch of text) {
      if (cancelled) return;
      input.value += ch;
      await sleep(TYPE_MS);
    }
  }

  // 화면 맨 아래에 방금 생긴 것을 누른다. 없으면 조용히 지나간다.
  async function clickLast(selector, wait) {
    const list = document.querySelectorAll(selector);
    const el = list[list.length - 1];
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    await sleep(700);
    if (cancelled) return;
    el.click();
    await sleep(wait);
  }

  async function run() {
    for (const step of DEMO_STEPS) {
      if (cancelled) break;

      setCaption?.(step.bot, step.ours);
      await type(step.say);
      if (cancelled) break;

      await sleep(360);
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      await sleep(AFTER_SEND_MS);
      if (cancelled) break;

      // 실행 — 지문 오버레이가 뜨고, 인증이 끝나면 스스로 닫힌다.
      // 인증을 건너뛰는 것이 아니다. AuthGate 는 그대로 증명을 요구하고, 이때
      // 쓰이는 것은 demo-fallback 증명이라 판단 로그에 "기기 인증기 미사용"이
      // 그대로 남는다. 사람이 직접 누르면 기기 인증기를 거친다.
      const pending = document.querySelector("button.auth:not(:disabled)");
      if (step.execute && pending) {
        pending.classList.add("is-calling");
        pending.scrollIntoView({ block: "nearest" });
        await sleep(1200);
        if (cancelled) break;
        pending.click();
        await sleep(4600); // 확인 1.5s + 통과 1.1s + 결과를 읽을 시간
      }
      if (cancelled) break;

      // 파일을 실제로 내려받는다. 파일명만 보여주면 챗봇과 다를 게 없다.
      if (step.download) await clickLast(".artifact__dl", 2200);
      if (cancelled) break;

      // 화면을 실제로 연다. 경로를 읽어주기만 하면 챗봇이다.
      //
      // 방금 생긴 후보 묶음의 '첫' 버튼을 누른다. 마지막을 누르면 후보 3개 중
      // 관련도가 가장 낮은 것이 열린다(실측: 환전신청 대신 해외주식시장안내가 열렸다).
      if (step.openMenu) {
        const groups = document.querySelectorAll(".menus");
        const first = groups[groups.length - 1]?.querySelector(".menus__go");
        if (first) {
          first.scrollIntoView({ block: "nearest" });
          await sleep(700);
          if (!cancelled) {
            first.click();
            await sleep(3200);
          }
        }
      }
      if (cancelled) break;

      await sleep(BETWEEN_MS);
    }
    setCaption?.("", "");
    stop();
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

  function stop() {
    cancelled = true;
    running = false;
    button.classList.remove("is-running");
    button.textContent = "▶ 자동 시연";
    input.readOnly = false;
    input.value = "";
    onStop?.();
  }

  button.addEventListener("click", () => (running ? stop() : start()));

  return { start, stop, isRunning: () => running };
}
