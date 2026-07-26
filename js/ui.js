// 화면 렌더링. 보안 규칙: 사용자 입력·도구 결과·메뉴 이름·LLM 출력은
// 반드시 textContent로만 꽂는다. innerHTML은 아래의 정적 골격(보간 없음)에만 쓴다.
import {
  formatAuditLog,
  formatActionResult,
  formatPlanSummary,
  formatQueryResult,
  formatAuthEvent,
  speakForQuery,
  followUpForQuery,
  followUpForAction,
} from "../src/ui/format.js";
import { createAutoDemo } from "./autodemo.js";
import { createVoiceInput } from "./voice.js";

// 첫 화면의 제안. 단순한 예시 목록이 아니라 "이 AI가 어디까지 하는가"를
// 가르치는 자리다.
//
// 예전에는 가로 스크롤 칩이었다. 8개 중 2.5개만 보였고 나머지는 잘렸다.
// 2,656개 메뉴·3사를 다룬다는 게 우리 주장인데 화면이 그 넓이를 전혀
// 전달하지 못했다. 세로 카드로 바꾸고 분야 라벨을 붙인다 — 한눈에
// 은행·카드·증권이 다 보이고, 조회만이 아니라 실행까지 한다는 것도 보인다.
const SUGGESTIONS = [
  { icon: "💸", label: "이체", say: "아들한테 이체해줘" },
  { icon: "🔁", label: "자동이체", say: "요즘 돈이 자꾸 새는 것 같은데" },
  { icon: "💳", label: "카드", say: "이번 달 카드값 얼마야?" },
  { icon: "🎁", label: "지원금", say: "고유가 지원금 신청할 수 있어?" },
  { icon: "📊", label: "명세서", say: "카드 명세서 엑셀로 뽑아줘" },
  { icon: "🏦", label: "3사 통합", say: "내 연금 어디 들어가 있지?" },
  { icon: "✈️", label: "해외", say: "해외 나가는데 뭐 준비해야 돼?" },
];

export function createUI(root, { onSend, onConfirm }) {
  // innerHTML 은 이 정적 골격에만 쓴다 — 보간되는 값이 하나도 없다.
  // 사용자 입력·도구 결과·LLM 출력은 아래에서 전부 textContent 로만 꽂는다.
  root.innerHTML = `
    <div class="phone">
      <div class="phone__screen">
        <div class="phone__bar">
          <svg viewBox="0 0 84 62" aria-hidden="true"><path d="M83.8 31.13l-.74-.46c-2.52-2.51-6-3.6-10.69-3.33A20.1 20.1 0 0 0 63 30.56v-.11c0-1.22.14-2.54.27-3.82a37.29 37.29 0 0 0 .28-3.89A9.15 9.15 0 0 0 63 19.2a.68.68 0 0 0-.67-.42A10 10 0 0 0 58 20.19l-.32.71a29.15 29.15 0 0 1-.63 5.75l-.17.47a70.11 70.11 0 0 0 0 14.63c0 .42.86 1 1.48 1.28s2.82-.32 4-.79l.47-.07a.7.7 0 0 0 .6-.81v-1.21c.89-3.62 4.5-7.93 8.76-8.59a6.08 6.08 0 0 1 5.82 1.88c.2.29.64 2.9-1 5.89a12.18 12.18 0 0 1-6.66 5.25A25.64 25.64 0 0 1 60.25 46l-3.74-2.53c-3.17-2.23-7.11-5-10.69-6.36a12.67 12.67 0 0 1-2.43-1.73l-.37-.3c-2.06-1.66-6-4.27-9.13-6.37l-1.7-1.14v-.35c.09-.1 2.06-1.29 2.06-1.29 2.78-1.62 4.06-2.42 4.33-2.83-.05.07.37-.22.37-.22L45.83 19c6.59-3.63 14.06-7.74 18-11.8l.17-.61.09-.59a3.81 3.81 0 0 0 .06-2.31.75.75 0 0 0-.53-.53c-3.06-.3-7 1.54-10.61 4.91a9.86 9.86 0 0 1-2.22 1.53l-.55.3c-4 2.26-12.9 7.8-17.57 10.8a154.59 154.59 0 0 1 2.38-18.11l-.13-.71-.48-.88-.37-.67L34 .3a3 3 0 0 0-2.29-.14l-.94.35-1.24.49a.7.7 0 0 0-.53.4c-2.23 5.4-4.09 14.28-4.53 21.38a110.56 110.56 0 0 0-10.61-5.87h-.06l-.25-.05a7.7 7.7 0 0 1-2.47-1.15L9.4 14.58l-2.6-1.66-.68-.15a8.14 8.14 0 0 0-3.89 2.6.78.78 0 0 0-.11.42 2.61 2.61 0 0 0 .11.61l.12.53.12.32a37.48 37.48 0 0 0 7.46 5.06l3.56 1.88 5.46 3 .93.73.65.37.11.08L10.71 35l-5.22 3.44a29.35 29.35 0 0 1-3 1.45 4.28 4.28 0 0 0-2.35 1.94l-.14.3.14.2.4.3.53.35.58.39.54.09c.92 0 2.28-.49 4.82-1.6 2.33-1 8.68-4.86 11.38-6.49l1.16-.7A2.53 2.53 0 0 0 21 34a14.22 14.22 0 0 1 2.45-1.48l.81-.45v.32a112.08 112.08 0 0 0 1.51 19v.08l.08.19a20.6 20.6 0 0 1 1.41 4.35l1 3.46.29.33a6.85 6.85 0 0 0 3.59.94h.3l.19-.42a8.26 8.26 0 0 0 .13-1.59c0-.63 0-1.33-.1-2.18l-.08-1.25c-.38-5.79-.76-14.15-.76-19.71V35l5.29 3.33c7.32 4.75 18.38 11.93 25.06 13.82a1 1 0 0 0 1-.22l1-.66.19-.08a1.88 1.88 0 0 0 .69-1.53c5.63-.28 13.49-2.45 17.69-7.74a11 11 0 0 0 2.36-6.7 5.74 5.74 0 0 0-1.37-4.12"/></svg>
          <span>KB스타뱅킹</span><span class="sep">·</span><span>지문까지</span>
          <span class="env">Demo</span>
        </div>
        <div id="log" class="log" aria-live="polite">
          <div id="welcome" class="welcome">
            <svg class="welcome__mark" viewBox="0 0 84 62" aria-hidden="true"><path d="M83.8 31.13l-.74-.46c-2.52-2.51-6-3.6-10.69-3.33A20.1 20.1 0 0 0 63 30.56v-.11c0-1.22.14-2.54.27-3.82a37.29 37.29 0 0 0 .28-3.89A9.15 9.15 0 0 0 63 19.2a.68.68 0 0 0-.67-.42A10 10 0 0 0 58 20.19l-.32.71a29.15 29.15 0 0 1-.63 5.75l-.17.47a70.11 70.11 0 0 0 0 14.63c0 .42.86 1 1.48 1.28s2.82-.32 4-.79l.47-.07a.7.7 0 0 0 .6-.81v-1.21c.89-3.62 4.5-7.93 8.76-8.59a6.08 6.08 0 0 1 5.82 1.88c.2.29.64 2.9-1 5.89a12.18 12.18 0 0 1-6.66 5.25A25.64 25.64 0 0 1 60.25 46l-3.74-2.53c-3.17-2.23-7.11-5-10.69-6.36a12.67 12.67 0 0 1-2.43-1.73l-.37-.3c-2.06-1.66-6-4.27-9.13-6.37l-1.7-1.14v-.35c.09-.1 2.06-1.29 2.06-1.29 2.78-1.62 4.06-2.42 4.33-2.83-.05.07.37-.22.37-.22L45.83 19c6.59-3.63 14.06-7.74 18-11.8l.17-.61.09-.59a3.81 3.81 0 0 0 .06-2.31.75.75 0 0 0-.53-.53c-3.06-.3-7 1.54-10.61 4.91a9.86 9.86 0 0 1-2.22 1.53l-.55.3c-4 2.26-12.9 7.8-17.57 10.8a154.59 154.59 0 0 1 2.38-18.11l-.13-.71-.48-.88-.37-.67L34 .3a3 3 0 0 0-2.29-.14l-.94.35-1.24.49a.7.7 0 0 0-.53.4c-2.23 5.4-4.09 14.28-4.53 21.38a110.56 110.56 0 0 0-10.61-5.87h-.06l-.25-.05a7.7 7.7 0 0 1-2.47-1.15L9.4 14.58l-2.6-1.66-.68-.15a8.14 8.14 0 0 0-3.89 2.6.78.78 0 0 0-.11.42 2.61 2.61 0 0 0 .11.61l.12.53.12.32a37.48 37.48 0 0 0 7.46 5.06l3.56 1.88 5.46 3 .93.73.65.37.11.08L10.71 35l-5.22 3.44a29.35 29.35 0 0 1-3 1.45 4.28 4.28 0 0 0-2.35 1.94l-.14.3.14.2.4.3.53.35.58.39.54.09c.92 0 2.28-.49 4.82-1.6 2.33-1 8.68-4.86 11.38-6.49l1.16-.7A2.53 2.53 0 0 0 21 34a14.22 14.22 0 0 1 2.45-1.48l.81-.45v.32a112.08 112.08 0 0 0 1.51 19v.08l.08.19a20.6 20.6 0 0 1 1.41 4.35l1 3.46.29.33a6.85 6.85 0 0 0 3.59.94h.3l.19-.42a8.26 8.26 0 0 0 .13-1.59c0-.63 0-1.33-.1-2.18l-.08-1.25c-.38-5.79-.76-14.15-.76-19.71V35l5.29 3.33c7.32 4.75 18.38 11.93 25.06 13.82a1 1 0 0 0 1-.22l1-.66.19-.08a1.88 1.88 0 0 0 .69-1.53c5.63-.28 13.49-2.45 17.69-7.74a11 11 0 0 0 2.36-6.7 5.74 5.74 0 0 0-1.37-4.12"/></svg>
            <h2 class="welcome__title">무엇이든 말씀하세요</h2>
            <p class="welcome__lede">메뉴를 찾지 마세요. 사람에게 말하듯 하면 됩니다.</p>
            <p id="welcome-meta" class="welcome__meta"></p>
            <div id="suggest" class="suggest"></div>
          </div>
        </div>
        <p id="caption" class="caption" aria-live="polite"></p>
        <form id="composer">
          <button type="button" id="mic" class="mic" aria-label="음성으로 말하기" title="음성으로 말하기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"/><path d="M18 11a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11Z"/></svg>
          </button>
          <input id="input" autocomplete="off" placeholder="말씀하세요. 메뉴는 제가 찾습니다." />
          <button type="submit">보내기</button>
        </form>
      </div>
    </div>
    <aside class="audit">
      <div class="audit__head">
        <h2>AI 판단 로그</h2>
        <button type="button" id="autodemo" class="autodemo">▶ 자동 시연</button>
      </div>
      <p class="audit__lede">
        미리 짜둔 대본이 아닙니다. <b>AI가 어떤 기능을 호출할지 스스로 판단하는 과정</b>과,
        <b>LLM으로 무엇이 전송됐는지</b>를 그대로 보여줍니다.
      </p>
      <pre id="audit"></pre>
    </aside>`;

  const log = root.querySelector("#log");
  const auditEl = root.querySelector("#audit");
  const input = root.querySelector("#input");
  const suggest = root.querySelector("#suggest");

  // 자동 시연 — 발표자가 타이핑하지 않아도 시나리오가 순서대로 돈다.
  const demo = createAutoDemo({
    input,
    form: root.querySelector("#composer"),
    button: root.querySelector("#autodemo"),
    caption: root.querySelector("#caption"),
  });

  // 사용자가 직접 입력하기 시작하면 자동 시연을 멈춘다 — 두 손이 겹치면 안 된다.
  input.addEventListener("keydown", () => { if (demo.isRunning()) demo.stop(); });

  // 음성 입력 — 이 서비스가 겨냥하는 사람에게는 타이핑 자체가 장벽이다.
  // 메뉴를 대신 걸어주면서 입력은 손으로만 받으면 절반만 해결한 것이다.
  const mic = root.querySelector("#mic");
  const voice = createVoiceInput({
    onInterim: (t) => { input.value = t; },
    onFinal: (t) => {
      input.value = t;
      root.querySelector("#composer").requestSubmit();
    },
    onStateChange: (s) => {
      mic.classList.toggle("is-listening", s === "listening");
      mic.setAttribute("aria-label", s === "listening" ? "듣는 중 — 누르면 멈춥니다" : "음성으로 말하기");
    },
    onError: (msg) => append("warn", msg),
  });

  if (voice.isSupported()) {
    mic.addEventListener("click", () => {
      if (demo.isRunning()) demo.stop();
      voice.toggle();
    });
  } else {
    // 지원하지 않는 브라우저에서 눌리기만 하고 아무 일도 없으면 고장으로 읽힌다.
    // 버튼을 지우지 않고 왜 못 쓰는지 말한다.
    mic.classList.add("is-off");
    mic.title = "이 브라우저는 음성 입력을 지원하지 않습니다 (Chrome·Edge 권장)";
    mic.addEventListener("click", () =>
      append("warn", "이 브라우저는 음성 입력을 지원하지 않습니다. Chrome 또는 Edge에서 사용해 주세요.")
    );
  }

  // 제안 카드 — 정적 문자열이지만 규칙대로 textContent 로 꽂는다.
  // 누르면 입력만 채우지 않고 곧바로 보낸다. 눌렀는데 아무 일도 안 일어나면
  // (입력창에 글자만 들어가면) 한 번 더 눌러야 한다는 걸 모르는 사람이 있다.
  for (const { icon, label, say } of SUGGESTIONS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "suggest__card";

    const head = document.createElement("span");
    head.className = "suggest__label";
    head.textContent = `${icon} ${label}`;

    const body = document.createElement("span");
    body.className = "suggest__say";
    body.textContent = say;

    card.append(head, body);
    card.addEventListener("click", () => {
      input.value = say;
      root.querySelector("#composer").requestSubmit();
    });
    suggest.appendChild(card);
  }

  root.querySelector("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    // 대화가 시작되면 초대 화면은 물러난다 — 로그와 겹쳐 있으면 안 된다.
    root.querySelector("#welcome")?.remove();
    append("user", text);
    // (I6) 렌더링·처리 중 어디서든 예외가 나면 대화가 조용히 죽는 대신 화면에 남긴다.
    try {
      await onSend(text);
    } catch (err) {
      append("warn", `문제가 발생했습니다: ${err?.message ?? "알 수 없는 오류"}`);
    }
  });

  function append(who, text) {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // 인증 방식(WebAuthn 실제 인증 vs 데모 대체 인증)을 AI 판단 로그 패널에도 남긴다.
  // renderResult가 매 턴마다 auditEl.textContent를 통째로 새로 쓰므로, 여기서는
  // "이번 턴에 이미 그려진 내용 뒤에 덧붙이는" 방식으로만 손댄다.
  function logAuthEvent(line) {
    auditEl.textContent = auditEl.textContent ? `${auditEl.textContent}\n${line}` : line;
  }

  function renderResult(r) {
    if (r.message) append("bot", r.message);

    if (r.layer === "L1" && r.menus?.length) {
      const ul = document.createElement("ul");
      ul.className = "menus";
      for (const m of r.menus.slice(0, 3)) {
        const li = document.createElement("li");
        li.textContent = [...m.path, m.name].join(" > ");
        ul.appendChild(li);
      }
      log.appendChild(ul);
    }

    if (r.layer === "L2" && r.data) {
      // 숫자를 내놓기 전에 사람처럼 한마디 한다. 목록만 툭 던지면 상담이 아니라
      // 조회기다. 이 문장은 기기에서 만들어진다 — 금액은 LLM에 가지 않는다.
      if (!r.message) {
        const said = speakForQuery(r.audit?.toolCalls?.[0]);
        if (said) append("bot", said);
      }
      const lines = formatQueryResult(r.data);
      if (lines.length) {
        const ul = document.createElement("ul");
        ul.className = "data";
        for (const line of lines) {
          const li = document.createElement("li");
          li.textContent = line;
          ul.appendChild(li);
        }
        log.appendChild(ul);
      }
      // 결과 뒤에 다음 걸음을 하나 열어둔다. 이게 없으면 한 턴이 답 하나로 닫혀서
      // 상담이 아니라 자판기가 된다 — 물어보면 답이 나오고 거기서 끝난다.
      if (!r.message) {
        const next = followUpForQuery(r.audit?.toolCalls?.[0]);
        if (next) append("bot", next);
      }
    }

    if (r.layer === "L3" && r.plan) {
      // (C4) 인증 버튼을 누르기 전에 무엇을, 어디에 할 것인지 반드시 보여준다.
      const summary = document.createElement("div");
      summary.className = "plan-summary";
      summary.textContent = formatPlanSummary(r.plan);
      log.appendChild(summary);

      for (const w of r.warnings ?? []) append("warn", `⚠️ ${w}`);
      const btn = document.createElement("button");
      btn.className = "auth";
      const idleLabel = "🔒 지문으로 실행";
      btn.textContent = idleLabel;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        // (I6과 동일한 원칙) 인증 세리머니는 실제 시간이 걸린다 — 버튼이 죽은 것처럼
        // 보이지 않도록 진행 상태를 반드시 보여준다.
        btn.textContent = "인증을 기다리는 중…";
        try {
          // 자동 시연이 스스로 누른 경우에는 WebAuthn 세리머니를 시도하지 않는다.
          // 브라우저 인증기는 '사람의 제스처'를 요구하므로 프로그램이 누르면
          // 반드시 실패하고, 그 영어 예외가 시연 화면에 그대로 남는다.
          // 대체 인증으로 가되 화면에는 "실제 인증 아님"이 그대로 표시된다.
          const out = await onConfirm(r.plan.planId, { auto: demo.isRunning() });
          if (out?.authProof) {
            const authLine = formatAuthEvent(out.authProof);
            if (authLine) {
              append(out.authProof.method === "webauthn" ? "bot" : "warn", authLine);
              logAuthEvent(authLine);
            }
          }
          // 실행이 끝났으면 버튼을 치운다.
          // 예전에는 "인증을 기다리는 중…" 이라고 적힌 검은 막대가 disabled 인 채로
          // 대화 한가운데 영구히 남았다. 실행은 이미 끝났는데 화면은 아직 기다리는
          // 것처럼 보여서, 인증이 실패한 줄 알게 된다(실측 지적).
          btn.remove();
          append("bot", formatActionResult(r.plan, out));
          // 실행 하나로 대화가 끝나면 안 된다 — 다음 걸음을 열어둔다.
          const next = followUpForAction(r.plan.tool);
          if (next) append("bot", next);
        } catch (err) {
          // 실패했을 때 조용히 원래 상태로 돌아가지 않는다 — 무엇이 왜 실패했는지
          // 화면에 남기고, 다시 시도할 수 있게 버튼을 되살린다.
          append("warn", `인증에 실패했습니다: ${err?.message ?? "알 수 없는 오류"}`);
          btn.disabled = false;
          btn.textContent = idleLabel;
        }
      });
      log.appendChild(btn);
    }

    if (r.audit) auditEl.textContent = formatAuditLog(r.audit).join("\n");
    log.scrollTop = log.scrollHeight;
  }

  function renderNotice(text) {
    const div = document.createElement("div");
    div.className = "notice";
    div.textContent = text;
    log.appendChild(div);
  }

  // 초대 화면에 신뢰의 숫자를 얹는다.
  // 예전에는 "메뉴 N건을 알고 있습니다"를 봇 말풍선으로 따로 띄웠는데,
  // 초대 화면이 이미 "무엇이든 말씀하세요"라고 인사하고 있어서 인사가 두 번 났다.
  function setMenuCount(n) {
    const el = root.querySelector("#welcome-meta");
    if (el) el.textContent = `KB국민은행·KB국민카드·KB증권 ${Number(n).toLocaleString("ko-KR")}개 메뉴를 알고 있습니다`;
  }

  return { renderResult, append, renderNotice, setMenuCount };
}
