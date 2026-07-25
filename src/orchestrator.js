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

  async function handle(utterance, history = []) {
    const { text, removed } = scrubPII(utterance);
    const menus = await router.search(text, { topK: 5 });

    const audit = {
      sentToLLM: text,
      piiRemoved: removed,
      candidates: menus.map((m) => m.id),
      toolCalls: [],
      blockedCalls: [],
    };

    const res = await llm.chat({
      utterance: text,
      history,
      tools: toOpenAITools(tools),
      menuCandidates: menus,
    });

    const call = res.toolCalls?.[0];

    // L1 — 실행할 도구가 없다. 그래도 위치는 안내한다.
    if (!call) {
      return { layer: "L1", message: res.message || describeMenus(menus), menus, audit };
    }

    const tool = tools[call.name];
    if (!tool) {
      return { layer: "L1", message: describeMenus(menus), menus, audit };
    }

    // L2 — 조회는 바로 실행한다.
    if (!tool.requiresAuth) {
      audit.toolCalls.push(call.name);
      const plan = await executor.prepare(call.name, call.args);
      const data = await executor.execute(plan.planId, null);
      return { layer: "L2", message: res.message, data, menus, audit };
    }

    // L3 — 실행은 계획까지만.
    const impact = await impactFn(call.name, call.args);
    if (impact.blocked) {
      return { layer: "L3", message: impact.reason, menus, audit };
    }
    const plan = await executor.prepare(call.name, call.args);
    audit.blockedCalls.push(call.name); // 인증 전이라 아직 호출되지 않았음을 남긴다
    return { layer: "L3", message: res.message, plan, warnings: impact.warnings, menus, audit };
  }

  async function confirm(planId, token) {
    return await executor.execute(planId, token);
  }

  return { handle, confirm };
}

function describeMenus(menus) {
  if (!menus.length) return "찾지 못했습니다. 다시 말씀해 주세요.";
  const m = menus[0];
  const where = [AFFILIATE_NAME[m.affiliate] ?? m.affiliate, ...m.path, m.name].join(" > ");
  return `${where} 에 있습니다.`;
}
