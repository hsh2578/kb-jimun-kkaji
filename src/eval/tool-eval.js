// L2·L3 도구 선택 정확도. 막연함의 층(L1~L4)별로 나눠 잰다.
// L3·L4에서 벌어지는 격차가 이 서비스의 존재 이유다.

export async function evaluateToolSelection({ cases, orchestrator }) {
  let toolOk = 0;
  const byLevel = {};

  for (const c of cases) {
    const r = await orchestrator.handle(c.utterance, []);
    const called = [...(r.audit?.toolCalls ?? []), ...(r.audit?.blockedCalls ?? [])];
    const ok = c.expectTool === null ? called.length === 0 : called.includes(c.expectTool);
    if (ok) toolOk++;
    byLevel[c.level] ??= { total: 0, ok: 0 };
    byLevel[c.level].total++;
    if (ok) byLevel[c.level].ok++;
  }

  return { total: cases.length, toolOk, byLevel };
}
