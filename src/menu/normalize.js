// 메뉴 노드 정규화. 크롤러와 인덱서가 공유한다.

const ACTION_VERBS =
  /(조회|신청|변경|해지|발급|등록|납부|이체|가입|취소|재발행|재발급|설정|매수|매도|청약|출력|검증|제출)/;

// 화면 표기용 구분자를 낱말로 쪼갠다.
export function splitKeywords(name) {
  return name
    .split(/[/·,()\[\]{}]|\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export function normalizeMenuNode({ affiliate, path, name }) {
  const cleanPath = path.map((p) => p.trim()).filter(Boolean);
  const cleanName = name.replace(/\s+/g, " ").trim();
  const id = `${affiliate}:${[...cleanPath, cleanName].join(">")}`;
  return {
    id,
    affiliate,
    name: cleanName,
    path: cleanPath,
    depth: cleanPath.length + 1,
    isAction: ACTION_VERBS.test(cleanName),
    keywords: splitKeywords(cleanName),
  };
}

// 태그를 벗겨 <h3> 헤딩을 상위 경로로, <a> 텍스트를 잎으로 삼는다.
export function parseMenuHtml(html, affiliate) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");

  const nodes = [];
  const seen = new Set();
  let section = "";

  const token = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>|<a[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = token.exec(stripped)) !== null) {
    const heading = m[1] && text(m[1]);
    const link = m[2] && text(m[2]);
    if (heading) {
      section = heading;
      continue;
    }
    if (!link || link.length < 2 || link.length > 30) continue;
    const node = normalizeMenuNode({
      affiliate,
      path: section ? [section] : [],
      name: link,
    });
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    nodes.push(node);
  }
  return nodes;
}

const NAMED_ENTITIES = {
  nbsp: " ",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  middot: "·",
};

function text(fragment) {
  return fragment
    .replace(/<[^>]+>/g, "")
    // 숫자 문자 참조: 십진(&#39;)과 16진(&#x27;) 모두 처리.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // 알려진 named entity. &amp;는 다른 항목을 모두 처리한 뒤 마지막에 디코딩해
    // 이중 디코딩(예: "&amp;middot;" -> "&middot;" -> "·")을 방지한다.
    .replace(/&(nbsp|lt|gt|quot|apos|middot);/g, (_, name) => NAMED_ENTITIES[name])
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
