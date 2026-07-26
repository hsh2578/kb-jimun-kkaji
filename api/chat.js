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

  // 되묻기 규칙을 좁힌 이유:
  // "모호하면 되묻는다"를 넓게 두면 모델이 도구를 부르기 전에 먼저 질문한다.
  // "내 연금 어디 있지?"에도 "어떤 연금인가요?"라고 되물어 조회가 시작되지 않았다.
  // 조회(읽기)는 되물을 이유가 없다 — 먼저 보여주고 좁히는 편이 낫다.
  // 되묻기는 되돌릴 수 없는 실행에서만 의미가 있다.
  const system =
    "너는 KB 금융 앱의 실행형 에이전트다. 고객은 메뉴 용어를 모른다.\n" +
    "1) 조회·확인 요청이면 되묻지 말고 즉시 도구를 호출한다. 파라미터가 비어 있어도 기본값이나 빈 값으로 호출한다.\n" +
    "2) 되돌릴 수 없는 실행(해지·변경)에서 대상이 특정되지 않을 때만 한 번에 하나씩 되묻는다.\n" +
    "3) 도구가 없을 때만 아래 후보 메뉴 위치를 안내한다.\n" +
    "4) 금액·계좌번호를 지어내지 않는다. 도구 결과에 있는 값만 말한다.\n\n" +
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
