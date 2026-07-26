// Vercel 서버리스 — 임베딩 프록시.
// (M2) chat.js와 동일한 이유로 ALLOW_ORIGIN 기본값을 닫힌 쪽("")으로 둔다 — 미설정 시
// CORS 헤더를 내지 않아 브라우저의 교차 출처 호출을 막는다(fail closed).
// 배포 시 Vercel 프로젝트 환경변수에 ALLOW_ORIGIN=https://<프론트엔드 도메인> 을 반드시 설정할 것.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? "";

export default async function handler(req, res) {
  if (ALLOW_ORIGIN) res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: "OPENAI_KEY 미설정" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (raw.length > 10_000) return res.status(413).json({ error: "요청이 너무 큽니다" });

  let input;
  try {
    ({ input } = JSON.parse(raw));
  } catch {
    return res.status(400).json({ error: "요청 본문이 올바른 JSON이 아닙니다" });
  }

  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input, dimensions: 256 }),
  });
  if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });
  const json = await r.json();
  return res.status(200).json({ embedding: json.data[0].embedding });
}
