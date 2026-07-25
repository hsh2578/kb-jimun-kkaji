// KB 3사 메뉴 트리를 수집해 data/menus.json 으로 저장한다.
//   실행: node scripts/crawl-menus.js
//   네트워크가 막히면 data/raw/*.html 을 읽어 오프라인으로 동작한다.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { parseMenuHtml } from "../src/menu/normalize.js";

const SOURCES = [
  { affiliate: "bank", url: "https://obank.kbstar.com/quics?page=C030037&QSL=F", raw: "data/raw/bank.html" },
  { affiliate: "bank", url: "https://obank.kbstar.com/quics?page=C016535&QSL=F", raw: "data/raw/bank-mgmt.html" },
  { affiliate: "card", url: "https://card.kbcard.com/", raw: "data/raw/card.html" },
  { affiliate: "sec",  url: "https://www.kbsec.com/",  raw: "data/raw/sec.html" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140";

async function fetchOrCache({ url, raw }) {
  if (existsSync(raw)) return readFileSync(raw, "utf8");
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const html = await res.text();
  mkdirSync("data/raw", { recursive: true });
  writeFileSync(raw, html, "utf8");
  return html;
}

const all = new Map();
for (const src of SOURCES) {
  try {
    const html = await fetchOrCache(src);
    for (const node of parseMenuHtml(html, src.affiliate)) all.set(node.id, node);
    console.log(`${src.affiliate} ${src.url} -> 누적 ${all.size}`);
  } catch (e) {
    console.error(`실패 ${src.url}: ${e.message}`);
  }
}

const nodes = [...all.values()];
mkdirSync("data", { recursive: true });
writeFileSync("data/menus.json", JSON.stringify(nodes, null, 0), "utf8");
console.log(`저장 data/menus.json — ${nodes.length}건`);
console.log(
  "계열사별:",
  ["bank", "card", "sec"].map((a) => `${a}=${nodes.filter((n) => n.affiliate === a).length}`).join(" ")
);
