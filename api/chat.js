// Vercel 서버리스 — LLM 프록시. 키는 환경변수에만 존재한다.
// (M2) ALLOW_ORIGIN 미설정 시 "*"로 열어두면 누구나 이 URL을 알아내 팀의 OpenAI 키로
// 요청을 태울 수 있다. 그래서 기본값을 닫힌 쪽("")으로 두고, 설정된 경우에만 CORS 헤더를
// 내보낸다 — 브라우저는 이 헤더가 없으면 교차 출처 응답을 거부한다(fail closed).
// 배포 시 Vercel 프로젝트 환경변수에 ALLOW_ORIGIN=https://<프론트엔드 도메인> 을 반드시 설정할 것.
// (README.md "LLM을 붙여서 실행하기" 절 참고)
import { checkRateLimit } from "./_rate-limit.js";
import { buildSystemPrompt } from "../src/llm/system-prompt.js";

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

  const system = buildSystemPrompt(menuCandidates);

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
    // id 를 함께 넘긴다. 대화 이력을 OpenAI 도구 프로토콜대로(assistant.tool_calls +
    // tool 결과) 복원하려면 tool_call_id 가 있어야 한다. 이력을 사람 말투 문장으로
    // 흉내 내면 모델이 그 문장을 답변으로 베껴 쓴다 — 실측으로 두 번 당했다.
    toolCalls = (msg.tool_calls ?? []).map((t) => ({
      id: t.id,
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
