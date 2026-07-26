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
      // 이력 복원용 원본 호출(id·인자 포함). 화면 표시는 toolCalls/blockedCalls 가 맡는다.
      calls: [],
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
        audit.calls.push({ id: callId(call, 0), name: call.name, args: call.args });
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
    audit.calls.push({ id: callId(call, 0), name: call.name, args: call.args });
    return { layer: "L3", message: res.message, plan, warnings: impact.warnings, menus, audit };
  }

  // 대화 이력에 넣을 턴들을 만든다. 반환값은 배열이다 — 도구를 호출한 턴은
  // assistant(tool_calls) + tool(결과) 두 개가 한 쌍이기 때문이다.
  //
  // 왜 이렇게까지 하는가 — 두 번 당했다.
  //   1차: "(apply_subsidy 을(를) 실행해 결과를 이미 보여주었다.)" 라는 메타 문장을
  //        넣었더니, 모델이 그 말투를 베껴서 도구를 부르는 대신 똑같이 생긴 문장을
  //        답변으로 뱉었다. 지원금 신청이 실행되지 않았다.
  //   2차: 사람 말투로 바꿔 "말씀하신 내용을 처리해 결과를 보여드렸습니다." 를
  //        넣었더니, 이번엔 "연금 현황을 조회해 결과를 보여드렸습니다." 라고 베꼈다.
  //        연금·대출·지원금 조회가 전부 텍스트 답변으로 새 나갔다.
  // 문장을 고르는 문제가 아니었다. 이력에 '답변처럼 생긴 문장'이 있는 한 모델은
  // 그것을 흉내 낸다. 그래서 흉내 낼 본보기 자체를 없앤다 — OpenAI 도구
  // 프로토콜 그대로, 도구를 부른 사실을 구조로 남긴다.
  //
  // tool 결과에는 수치를 담지 않는다. 잔액·계좌번호가 LLM으로 나가면 이 제품이
  // 하지 않겠다고 한 일을 하는 것이다. 결과는 화면에만 있다.
  const TOOL_DONE = "실행됨. 결과는 사용자 화면에 표시함. 수치는 비공개.";

  function historyTurns(r) {
    if (r.message) return [{ role: "assistant", content: r.message }];

    const calls = r.audit?.calls ?? [];
    if (calls.length) {
      return [
        {
          role: "assistant",
          content: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
          })),
        },
        ...calls.map((c) => ({ role: "tool", tool_call_id: c.id, content: TOOL_DONE })),
      ];
    }
    return [{ role: "assistant", content: "메뉴 위치를 안내해 드렸습니다." }];
  }

  async function confirm(planId, token) {
    const data = await executor.execute(planId, token);
    // 실행된 것만 여기 온다 — execute()가 인증 실패나 중복 실행이면 위에서 throw로 끝난다.
    const entry = { tool: planTools.get(planId) ?? null, planId };
    executionAudit.push(entry);
    return { ...data, audit: entry };
  }

  return { handle, confirm, executionAudit, historyTurns };
}

// 도구 호출 id. 프록시가 넘겨주면 그것을 쓰고, 없으면(stub 어댑터 등) 자리표를 만든다.
// id 가 비면 assistant.tool_calls 와 tool 메시지가 짝을 이루지 못해 업스트림이 400을 낸다.
let callSeq = 0;
function callId(call, _i) {
  return call.id || `call_local_${++callSeq}`;
}

// 되묻기인지, 답을 하고 예의상 물음으로 닫은 것인지 가른다.
//
// 물음표만 보면 너무 넓다. 실측: "환율 우대는 ... 혜택이 제공됩니다. 더 궁금한
// 점이 있으신가요?" 가 되묻기로 분류되어, 도구가 없을 때 반드시 붙어야 할
// 메뉴 위치 안내가 통째로 사라졌다. L1의 최소 약속이 깨진 것이다.
//
// 되묻기는 짧다("어느 분께 보내드릴까요?"). 설명은 길다. 길이로 가른다 —
// 한국어 종결어미를 훑는 것보다 오탐이 적다.
const CLARIFY_MAX_LEN = 60;

export function isQuestion(text) {
  if (typeof text !== "string") return false;
  const t = text.trim();
  return /\?$/.test(t) && t.length <= CLARIFY_MAX_LEN;
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
