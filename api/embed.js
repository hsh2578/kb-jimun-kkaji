// Vercel 서버리스 — 임베딩 프록시.
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
  if (raw.length > 10_000) return res.status(413).json({ error: "요청이 너무 큽니다" });
  const { input } = JSON.parse(raw);

  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input, dimensions: 256 }),
  });
  if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` });
  const json = await r.json();
  return res.status(200).json({ embedding: json.data[0].embedding });
}
