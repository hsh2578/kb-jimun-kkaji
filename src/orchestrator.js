// 3계층 분기.
//   L1 라우팅  — 실행도 조회도 못 해도 "어디 있는지"는 반드시 답한다
//   L2 조회    — 데이터를 조합해 바로 답한다
//   L3 실행    — 부수효과를 경고하고 계획만 만든다. 실행은 사람이 인증해야 한다
import { scrubPII } from "./llm/pii.js";
import { createExecutor } from "./exec/auth-gate.js";
import { analyzeImpact as defaultImpact } from "./exec/impact.js";
import { toOpenAITools } from "./tools/query-tools.js";
import { AFFILIATE_NAME } from "./menu/utterance.js";

export function createOrchestrator({ router, llm, tools, authGate, impactFn = defaultImpact }) {
  const executor = createExecutor({ authGate, tools });
  const planTools = new Map(); // planId -> 도구 이름. confirm()에서 감사 로그를 남기기 위함.
  const executionAudit = []; // 실제로 실행된 도구 호출의 기록. 은행이 남겨야 하는 단 하나의 로그.

  async function handle(utterance, history = []) {
    const { text, removed } = scrubPII(utterance);

    // history는 호출자가 이미 스크럽했다고 믿지 않는다 — 여기서 다시 한번 걷어낸다.
    // (예: js/main.js는 오늘 스크럽 전 원본 발화를 history에 push한다. 그래도 여기를 통과하면 안전해야 한다.)
    const cleanHistory = history.map((turn) => {
      if (!turn || typeof turn.content !== "string") return turn;
      return { ...turn, content: scrubPII(turn.content).text };
    });

    // 라우터가 죽어도 대화는 계속된다 — 후보 없이 진행한다.
    let menus = [];
    try {
      menus = await router.search(text, { topK: 5 });
    } catch {
      menus = [];
    }

    const audit = {
      sentToLLM: text,
      piiRemoved: removed,
      candidates: menus.map((m) => m.id),
      toolCalls: [],
      blockedCalls: [],
    };

    // LLM이 죽어도 위치 안내(L1)까지는 반드시 낸다.
    let res;
    try {
      res = await llm.chat({
        utterance: text,
        history: cleanHistory,
        tools: toOpenAITools(tools),
        menuCandidates: menus,
      });
    } catch {
      return { layer: "L1", message: describeMenus(menus), menus, audit };
    }

    const call = res.toolCalls?.[0];

    // L1 — 실행할 도구가 없다. 그래도 위치는 반드시 안내한다.
    // (C2) stub 어댑터는 res.message를 항상 비어있지 않게 채워 보낸다 — 예전에는 그 때문에
    // "|| describeMenus(menus)"가 한 번도 걸리지 않아 위치 안내(L1의 핵심)가 통째로 빠졌다.
    // LLM이 텍스트를 만들었든 안 만들었든 위치 한 줄은 항상 붙는다.
    if (!call) {
      const location = describeMenus(menus);
      const message = res.message ? `${res.message} ${location}` : location;
      return { layer: "L1", message, menus, audit };
    }

    const tool = tools[call.name];
    if (!tool) {
      return { layer: "L1", message: describeMenus(menus), menus, audit };
    }

    // L2 — 조회는 바로 실행한다. 도구가 터져도 예외를 밖으로 내지 않는다.
    if (!tool.requiresAuth) {
      try {
        audit.toolCalls.push(call.name);
        const plan = await executor.prepare(call.name, call.args);
        const data = await executor.execute(plan.planId, null);
        return { layer: "L2", message: res.message, data, menus, audit };
      } catch {
        return { layer: "L1", message: `지금은 처리할 수 없습니다. ${describeMenus(menus)}`, menus, audit };
      }
    }

    // L3 — 실행은 계획까지만. 영향 분석이 터져도 예외를 밖으로 내지 않는다.
    let impact;
    try {
      impact = await impactFn(call.name, call.args);
    } catch {
      return { layer: "L1", message: `지금은 처리할 수 없습니다. ${describeMenus(menus)}`, menus, audit };
    }
    if (impact.blocked) {
      return { layer: "L3", message: impact.reason, menus, audit };
    }
    const plan = await executor.prepare(call.name, call.args);
    planTools.set(plan.planId, call.name);
    audit.blockedCalls.push(call.name); // 인증 전이라 아직 호출되지 않았음을 남긴다
    return { layer: "L3", message: res.message, plan, warnings: impact.warnings, menus, audit };
  }

  async function confirm(planId, token) {
    const data = await executor.execute(planId, token);
    // 실행된 것만 여기 온다 — execute()가 인증 실패나 중복 실행이면 위에서 throw로 끝난다.
    const entry = { tool: planTools.get(planId) ?? null, planId };
    executionAudit.push(entry);
    return { ...data, audit: entry };
  }

  return { handle, confirm, executionAudit };
}

function describeMenus(menus) {
  if (!menus.length) return "지금은 찾지 못했습니다. 조금 더 구체적으로 말씀해 주시겠어요?";
  const m = menus[0];
  const where = [AFFILIATE_NAME[m.affiliate] ?? m.affiliate, ...m.path, m.name].join(" > ");
  return `${where} 에 있습니다.`;
}
