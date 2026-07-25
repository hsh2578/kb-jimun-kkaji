// L1 라우터 — 벡터 검색과 키워드 검색을 섞는다.
// 한국어는 형태 변화가 커서 벡터만으로는 놓치는 경우가 있고,
// 키워드만으로는 "통신비 자동으로 나가는 거"를 못 잡는다. 둘 다 쓴다.
import { cosine, dequantizeVector } from "../menu/quantize.js";
import { splitKeywords } from "../menu/normalize.js";

// 기본 가중치. 실측으로 정한 값이며 근거는 docs/tuning.md 참조.
// createRouter({ vectorWeight }) 로 덮어쓸 수 있어 튜닝 실험이 가능하다.
export const DEFAULT_VECTOR_WEIGHT = 0.7;

export function lexicalScore(utterance, node) {
  const words = new Set(splitKeywords(utterance));
  if (words.size === 0) return 0;
  const keys = node.keywords?.length ? node.keywords : splitKeywords(node.name);
  if (keys.length === 0) return 0;
  let hit = 0;
  for (const k of keys) {
    for (const w of words) {
      if (w.includes(k) || k.includes(w)) { hit++; break; }
    }
  }
  return hit / keys.length;
}

export function createRouter({ items, dim, embedFn, vectorWeight = DEFAULT_VECTOR_WEIGHT }) {
  const VECTOR_WEIGHT = vectorWeight;
  const LEXICAL_WEIGHT = 1 - vectorWeight;
  // 양자화된 int8을 미리 복원해 둔다. 검색마다 풀면 느리다.
  const vectors = items.map((it) =>
    dequantizeVector({ q: Int8Array.from(it.q), scale: it.scale })
  );

  async function search(utterance, { topK = 5 } = {}) {
    let queryVec = null;
    try {
      queryVec = await embedFn(utterance);
    } catch {
      queryVec = null; // 임베딩 실패 시 키워드로만 간다
    }

    const scored = items.map((it, i) => {
      const lex = lexicalScore(utterance, it);
      if (!queryVec) return { it, score: lex, why: "keyword" };
      const vec = cosine(queryVec, vectors[i]);
      return { it, score: VECTOR_WEIGHT * vec + LEXICAL_WEIGHT * lex, why: "hybrid" };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(({ it, score, why }) => ({
      id: it.id,
      name: it.name,
      path: it.path,
      affiliate: it.affiliate,
      isAction: it.isAction,
      score,
      why,
    }));
  }

  return { search, size: items.length };
}
