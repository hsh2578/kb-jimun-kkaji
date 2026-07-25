// 화면 렌더링. 보안 규칙: 사용자 입력·도구 결과·메뉴 이름·LLM 출력은
// 반드시 textContent로만 꽂는다. innerHTML은 아래의 정적 골격(보간 없음)에만 쓴다.
import {
  formatAuditLog,
  formatActionResult,
  formatPlanSummary,
  formatQueryResult,
} from "../src/ui/format.js";

export function createUI(root, { onSend, onConfirm }) {
  root.innerHTML = `
    <div class="pane">
      <div id="log" class="log" aria-live="polite"></div>
      <form id="composer">
        <input id="input" autocomplete="off" placeholder="무엇을 도와드릴까요? 예) 통신비 자동으로 나가는 거 그만하고 싶어" />
        <button type="submit">보내기</button>
      </form>
    </div>
    <aside class="audit">
      <h2>AI 판단 로그</h2>
      <pre id="audit"></pre>
    </aside>`;

  const log = root.querySelector("#log");
  const auditEl = root.querySelector("#audit");
  const input = root.querySelector("#input");

  root.querySelector("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    append("user", text);
    await onSend(text);
  });

  function append(who, text) {
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
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
      btn.textContent = "🔒 지문으로 실행";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          const out = await onConfirm(r.plan.planId);
          append("bot", formatActionResult(r.plan, out));
        } catch (err) {
          append("warn", `실패했습니다: ${err?.message ?? "알 수 없는 오류"}`);
          btn.disabled = false;
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
