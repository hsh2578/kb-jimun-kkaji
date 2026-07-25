// Vercel 서버리스 — LLM 프록시. 키는 환경변수에만 존재한다.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > 100_000) return res.status(413).json({ error: "요청이 너무 큽니다" });

  const { utterance, history = [], tools = [], menuCandidates = [] } = JSON.parse(raw);

  const system =
    "너는 KB 금융 앱의 실행형 에이전트다. 고객은 메뉴 용어를 모른다.\n" +
    "1) 무엇을 하려는지 파악하고, 모호하면 한 번에 하나씩 되묻는다.\n" +
    "2) 실행 가능한 도구가 있으면 호출한다. 없으면 아래 후보 메뉴 위치를 안내한다.\n" +
    "3) 금액·계좌번호를 지어내지 않는다. 도구 결과에 있는 값만 말한다.\n\n" +
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
  return res.status(200).json({
    message: msg.content ?? "",
    toolCalls: (msg.tool_calls ?? []).map((t) => ({
      name: t.function.name,
      args: JSON.parse(t.function.arguments || "{}"),
    })),
  });
}
