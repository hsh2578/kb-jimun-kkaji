// 되묻기를 '정식 도구'로 만든다.
//
// 왜 도구인가 — 되묻기를 LLM이 그냥 문장으로 내면, 그것이 질문인지 안내인지
// 오케스트레이터가 알 수 없다. 문자열 끝의 "?"로 추측하면 반드시 틀린다.
// 도구로 만들면 되묻기가 구조로 드러나고, AI 판단 로그에도 그대로 찍히며,
// 테스트할 수 있다.
//
// 이 도구는 다른 도구와 달리 부수효과도 데이터 조회도 없다. 오케스트레이터가
// tools[name] 조회 이전에 가로채므로 run()은 호출되지 않지만, 도구 목록의
// 형태를 맞추기 위해 그대로 둔다(toOpenAITools가 parameters를 읽는다).
export const CLARIFY = "ask_clarification";

export const CLARIFY_TOOL = {
  description:
    "고객에게 되묻는다. 실행에 필요한 정보(받는 사람, 금액, 대상)가 빠졌을 때 " +
    "추측해서 진행하지 말고 이 도구로 한 번에 하나만 묻는다. " +
    "이미 알아들은 부분은 question 안에서 먼저 확인해 준다 " +
    "(예: '아드님 계좌로 보내드릴게요. 얼마를 보낼까요?'). " +
    "조회·확인 요청에는 쓰지 않는다 — 조회는 먼저 보여주고 좁히는 편이 낫다.",
  parameters: { question: "string" },
  requiresAuth: false,
  run: async ({ question }) => ({ question }),
};
