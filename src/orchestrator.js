// 3계층 분기.
//   L1 라우팅  — 실행도 조회도 못 해도 "어디 있는지"는 반드시 답한다
//   L2 조회    — 데이터를 조합해 바로 답한다
//   L3 실행    — 부수효과를 경고하고 계획만 만든다. 실행은 사람이 인증해야 한다
import { scrubPII } from "./llm/pii.js";
import { createExecutor } from "./exec/auth-gate.js";
import { analyzeImpact as defaultImpact } from "./exec/impact.js";
import { toOpenAITools } from "./tools/query-tools.js";
import { CLARIFY } from "./tools/clarify.js";
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
    // 모델이 도구를 '부르는' 대신 호출 문법을 글로 적어 보내는 일이 있다
    // (실측: 화면에 ask_clarification({question: '...'}) 가 그대로 찍혔다).
    // 프롬프트로 막아도 확률적으로 새므로, 화면에 코드가 나가는 일만은 여기서 끊는다.
    // 이 방어선이 걸렸다는 사실은 감사 로그에 남겨 조용히 숨기지 않는다.
    if (looksLikeToolCall(res.message)) {
      audit.suppressedToolText = res.message;
      res = { ...res, message: "" };
    }

    // L1 — 실행할 도구가 없다. 그래도 위치는 반드시 안내한다.
    // (C2) stub 어댑터는 res.message를 항상 비어있지 않게 채워 보낸다 — 예전에는 그 때문에
    // "|| describeMenus(menus)"가 한 번도 걸리지 않아 위치 안내(L1의 핵심)가 통째로 빠졌다.
    // LLM이 텍스트를 만들었든 안 만들었든 위치 한 줄은 항상 붙는다.
    if (!call) {
      // 모델이 되묻기 도구를 쓰지 않고 그냥 질문 문장만 낼 때가 있다(실측 3/3회:
      // "아드님 계좌로 보내드릴게요. 얼마를 보낼까요?" 를 텍스트로 냈다).
      // 여기에 메뉴 위치를 이어붙이면 "얼마를 보낼까요? KB증권 > 이체 에 있습니다."
      // 가 되어 질문도 안내도 아닌 문장이 된다. 질문이면 질문으로 끝낸다.
      if (isQuestion(res.message)) {
        audit.askedBack = res.message;
        return { layer: "ASK", message: res.message, menus: [], audit };
      }
      const location = describeMenus(menus);
      const message = res.message ? `${res.message} ${location}` : location;
      return { layer: "L1", message, menus, audit };
    }

    // 되묻기 — 상담이 성립하는 지점이다.
    // 여기서 메뉴 위치를 덧붙이면 안 된다. "얼마를 보낼까요? ○○ > ○○ 에 있습니다"는
    // 질문이 아니라 안내로 읽히고, 고객은 대답 대신 대화를 끝낸다.
    // menus를 비워 보내 화면에도 후보 목록이 그려지지 않게 한다.
    if (call.name === CLARIFY) {
      const question = call.args?.question;
      audit.askedBack = question ?? "";
      if (question) return { layer: "ASK", message: question, menus: [], audit };
      // 질문 없이 되묻기를 부른 건 모델의 실수다 — 대화를 끊지 말고 위치라도 안내한다.
      return { layer: "L1", message: describeMenus(menus), menus, audit };
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

  // 대화 이력에 넣을 assistant 턴을 만든다.
  //
  // LLM이 도구를 호출할 때 content 는 비어 있다. 그걸 그대로 두면 이력이
  // user 만 연속으로 쌓인 기형 대화가 되고, 모델은 첫 턴의 의도에 고정된다.
  // (실측: 연금 조회 이후 카드·세금·자동이체 질문이 전부 list_pensions 로 갔다.)
  // 그래서 텍스트가 없을 때는 "무엇을 처리했는지"를 대신 남긴다.
  // 이 문장은 '모델이 다음 턴에 보게 될 본보기'다.
  //
  // 예전에는 "(apply_subsidy 을(를) 실행해 결과를 이미 보여주었다. 처리 완료.)"
  // 처럼 도구 이름이 든 메타 문장을 넣었다. 그러자 모델이 그 말투를 따라 해서,
  // 도구를 호출하는 대신 똑같이 생긴 문장을 '답변'으로 뱉었다(실측: 고유가
  // 지원금 신청이 실행되지 않고 그 문장만 화면에 찍혔다).
  // 그래서 사람이 쓸 법한 평범한 문장만 남긴다 — 도구 이름도, 괄호 메타도 없다.
  function historyTurn(r) {
    if (r.message) return { role: "assistant", content: r.message };
    const called = [...(r.audit?.toolCalls ?? []), ...(r.audit?.blockedCalls ?? [])];
    if (called.length) {
      return { role: "assistant", content: "말씀하신 내용을 처리해 결과를 보여드렸습니다." };
    }
    return { role: "assistant", content: "메뉴 위치를 안내해 드렸습니다." };
  }

  async function confirm(planId, token) {
    const data = await executor.execute(planId, token);
    // 실행된 것만 여기 온다 — execute()가 인증 실패나 중복 실행이면 위에서 throw로 끝난다.
    const entry = { tool: planTools.get(planId) ?? null, planId };
    executionAudit.push(entry);
    return { ...data, audit: entry };
  }

  return { handle, confirm, executionAudit, historyTurn };
}

// 답이 아니라 물음인지 본다. 물음표로 끝나면 물음이다 — 한국어 종결어미를
// 훑는 것보다 이 편이 오탐이 적다. (조회 결과가 있는 턴은 애초에 여기 오지 않는다.)
export function isQuestion(text) {
  return typeof text === "string" && /\?\s*$/.test(text.trim());
}

// "ask_clarification({question: '...'})" 처럼 도구 호출을 글로 적은 것인지 본다.
// 한국어 답변에는 나올 수 없는 모양이므로 오탐 위험이 낮다.
export function looksLikeToolCall(text) {
  if (typeof text !== "string") return false;
  return /\b[a-z][a-z0-9_]{3,}\s*\(\s*[{"']/i.test(text);
}

function describeMenus(menus) {
  if (!menus.length) return "지금은 찾지 못했습니다. 조금 더 구체적으로 말씀해 주시겠어요?";
  const m = menus[0];
  const where = [AFFILIATE_NAME[m.affiliate] ?? m.affiliate, ...m.path, m.name].join(" > ");
  return `${where} 에 있습니다.`;
}
