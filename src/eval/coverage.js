// 본 적 없는 발화로 라우팅 커버리지를 잰다.
// 인덱싱한 발화로 시험을 보면 100%가 나오고, 그 숫자는 아무것도 증명하지 못한다.

export async function evaluateCoverage({ router, heldOut, onProgress }) {
  let total = 0, top1 = 0, top3 = 0, affiliateError = 0;
  const misses = [];
  const ids = Object.keys(heldOut);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    for (const utterance of heldOut[id]) {
      total++;
      const results = await router.search(utterance, { topK: 3 });
      const got = results.map((r) => r.id);
      if (got[0] === id) top1++;
      if (got.includes(id)) top3++;
      else {
        misses.push({ id, utterance, got });
        const want = id.split(":")[0];
        if (results[0] && results[0].affiliate !== want) affiliateError++;
      }
    }
    if (onProgress) onProgress(i + 1, ids.length);
  }

  return { total, top1, top3, affiliateError, misses };
}
