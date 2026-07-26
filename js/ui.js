// 화면 렌더링. 보안 규칙: 사용자 입력·도구 결과·메뉴 이름·LLM 출력은
// 반드시 textContent로만 꽂는다. innerHTML은 아래의 정적 골격(보간 없음)에만 쓴다.
import {
  formatAuditLog,
  formatActionResult,
  formatPlanSummary,
  formatQueryResult,
  formatAuthEvent,
} from "../src/ui/format.js";

// 시연용 제안 발화. 심사위원이 무엇부터 눌러야 할지 헤매지 않게 한다.
// (docs/demo-script.md 의 시연 순서와 같다.)
const SUGGESTIONS = [
  "내 연금 어디 들어가 있지?",
  "통신비 자동으로 나가는 거 그만하고 싶어",
  "이번 달 카드 얼마나 더 써야 혜택 받아?",
  "세금 신고해야 하는데 금융 서류 뭐뭐 떼야 돼?",
  "환율 우대 어디서 받아?",
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
        <div id="log" class="log" aria-live="polite"></div>
        <div id="suggest" class="suggest"></div>
        <form id="composer">
          <input id="input" autocomplete="off" placeholder="말씀하세요. 메뉴는 제가 찾습니다." />
          <button type="submit">보내기</button>
        </form>
      </div>
    </div>
    <aside class="audit">
      <h2>AI 판단 로그</h2>
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

  // 제안 칩 — 정적 문자열이지만 규칙대로 textContent 로 꽂는다.
  for (const text of SUGGESTIONS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      input.value = text;
      input.focus();
    });
    suggest.appendChild(chip);
  }

  root.querySelector("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
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
          const out = await onConfirm(r.plan.planId);
          if (out?.authProof) {
            const authLine = formatAuthEvent(out.authProof);
            if (authLine) {
              append(out.authProof.method === "webauthn" ? "bot" : "warn", authLine);
              logAuthEvent(authLine);
            }
          }
          append("bot", formatActionResult(r.plan, out));
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

  return { renderResult, append, renderNotice };
}
