// Vercel 서버리스 — LLM 프록시. 키는 환경변수에만 존재한다.
// (M2) ALLOW_ORIGIN 미설정 시 "*"로 열어두면 누구나 이 URL을 알아내 팀의 OpenAI 키로
// 요청을 태울 수 있다. 그래서 기본값을 닫힌 쪽("")으로 두고, 설정된 경우에만 CORS 헤더를
// 내보낸다 — 브라우저는 이 헤더가 없으면 교차 출처 응답을 거부한다(fail closed).
// 배포 시 Vercel 프로젝트 환경변수에 ALLOW_ORIGIN=https://<프론트엔드 도메인> 을 반드시 설정할 것.
// (README.md "LLM을 붙여서 실행하기" 절 참고)
import { checkRateLimit } from "./_rate-limit.js";

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "";

export default async function handler(req, res) {
  if (ALLOW_ORIGIN) res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const limited = checkRateLimit(req);
  if (limited) return res.status(limited.status).json({ error: limited.error });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > 100_000) return res.status(413).json({ error: "요청이 너무 큽니다" });

  let utterance, history, tools, menuCandidates;
  try {
    ({ utterance, history = [], tools = [], menuCandidates = [] } = JSON.parse(raw));
  } catch {
    return res.status(400).json({ error: "요청 본문이 올바른 JSON이 아닙니다" });
  }

  // 고객이 ARS 상담원을 찾는 이유는 두 가지다.
  //   ① 원하는 게 뭔지 모른다 — "돈이 자꾸 새는 것 같아" 처럼 증상만 있다.
  //   ② 원하는 걸 알아도 어디서 어떻게 하는지 모른다 — 정식 명칭을 모른다.
  // ①은 진단이, ②는 실행이 필요하다. 둘 다 '검색'으로는 풀리지 않는다.
  // 그래서 이 프롬프트는 라우터가 아니라 상담원을 만든다.
  //
  // 되묻기 범위를 좁게 유지하는 이유(실측으로 얻은 교훈):
  // "모호하면 되묻는다"를 넓게 두면 모델이 도구를 부르기 전에 먼저 질문한다.
  // "내 연금 어디 있지?"에도 "어떤 연금인가요?"라고 되물어 조회가 시작되지 않았다.
  // 조회(읽기)는 되물을 이유가 없다 — 먼저 보여주고 좁히는 편이 낫다.
  // 되묻기는 되돌릴 수 없는 실행에서만 의미가 있다.
  const system =
    "너는 KB국민은행·KB국민카드·KB증권을 모두 아는 통합 상담원이다.\n" +
    "고객은 메뉴 이름도, 정식 용어도 모른다. 증상만 말하기도 한다. 그걸 탓하지 말고 네가 알아들어라.\n\n" +
    "[대화 원칙]\n" +
    "1) 조회·확인 요청이면 되묻지 말고 즉시 도구를 호출한다. 파라미터가 비어 있어도 기본값이나 빈 값으로 호출한다.\n" +
    "   '돈이 자꾸 새는 것 같아' 처럼 증상만 말해도 짐작되는 조회를 먼저 실행해 보여준다. 물어보고 시작하지 않는다.\n" +
    "2) 되돌릴 수 없는 실행(이체·해지·변경·신청)에 필요한 정보가 빠졌으면, 추측하지 말고 ask_clarification 으로 되묻는다.\n" +
    "   한 번에 하나만 묻는다. 이미 알아들은 부분은 질문 안에서 먼저 확인해 준다.\n" +
    "   예: '아드님 계좌로 보내드릴게요. 얼마를 보낼까요?' (X: '누구에게 얼마를 보낼까요?')\n" +
    "3) 조회 결과를 보여준 뒤에는, 도움이 될 다음 걸음을 한 가지만 짧게 제안한다.\n" +
    "   예: 자동이체 목록을 보여준 뒤 — '안 쓰시는 게 있으면 바로 해지해 드릴게요.'\n" +
    "   제안은 한 문장이면 충분하다. 여러 개를 늘어놓지 않는다.\n" +
    "4) 대화는 이어진다. 앞 턴에서 이미 말한 대상·금액을 다시 묻지 않는다.\n" +
    "   고객이 '거기로', '아까 그거', '방금 말한 사람' 이라고 하면 앞 대화에서 찾아 쓴다.\n" +
    "5) 실행할 도구가 없을 때만 아래 후보 메뉴 위치를 안내한다. 안내로 끝내지 말고 무엇을 더 도울지 덧붙인다.\n" +
    "6) 금액·계좌번호·수수료를 지어내지 않는다. 도구 결과에 있는 값만 말한다. 모르면 모른다고 한다.\n\n" +
    "[도구 사용]\n" +
    "도구를 부르려면 반드시 실제 도구 호출로 부른다. '(함수를 호출하겠습니다)' 처럼 문장으로 흉내내지 마라.\n" +
    "실행에 필요 없는 도구를 곁들이지 마라. 이체하는데 계좌 목록을 먼저 보여줄 이유는 없다.\n\n" +
    "[이체 대화 예시]\n" +
    "고객: 아들한테 이체해줘\n" +
    "  → ask_clarification({question: '아드님 계좌로 보내드릴게요. 얼마를 보낼까요?'})\n" +
    "    (list_accounts 를 부르지 않는다. 출금 계좌는 자동으로 정해진다.)\n" +
    "고객: 30만원\n" +
    "  → transfer_money({recipient_hint: '아들', amount: 300000})\n" +
    "    (누구에게 보낼지 다시 묻지 않는다. 앞 대화에 이미 있다.)\n\n" +
    "[말투]\n" +
    "존댓말. 한두 문장으로 짧게. 전문용어 대신 고객이 쓴 말로 답한다.\n" +
    "'~하시겠어요?', '~해 드릴까요?' 처럼 사람이 응대하듯 말한다. 목록만 던지지 않는다.\n\n" +
    `후보 메뉴:\n${menuCandidates.map((m) => `- [${m.affiliate}] ${[...m.path, m.name].join(" > ")}`).join("\n")}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, ...history, { role: "user", content: utterance }],
      tools: tools.length ? tools : undefined,
      max_tokens: 800,
    }),
  });
  if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });

  const json = await r.json();
  const msg = json.choices?.[0]?.message ?? {};

  let toolCalls;
  try {
    toolCalls = (msg.tool_calls ?? []).map((t) => ({
      name: t.function.name,
      args: JSON.parse(t.function.arguments || "{}"),
    }));
  } catch {
    // 모델(업스트림)이 깨진 인자 문자열을 돌려준 경우. 클라이언트 잘못은 아니지만
    // 500으로 죽이지 않고 짧은 메시지로 정리해 돌려준다.
    return res.status(400).json({ error: "모델의 도구 호출 인자를 해석할 수 없습니다" });
  }

  return res.status(200).json({ message: msg.content ?? "", toolCalls });
}
