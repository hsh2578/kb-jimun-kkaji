// 서버리스 프록시용 초간단 레이트리밋.
//
// 이 프록시는 심사 기간 내내 공개 URL로 열려 있고, 뒤에는 팀의 OpenAI 키가 있다.
// CORS는 브라우저만 막을 뿐 curl은 못 막는다. 그래서 호출 자체에 상한을 둔다.
//
// 한계를 분명히 해둔다:
//   · 서버리스는 인스턴스가 여러 개일 수 있어 이 카운터는 인스턴스별이다.
//     엄밀한 상한이 아니라 "폭주를 늦추는 브레이크"다.
//   · 실제 서비스라면 게이트웨이나 Redis 같은 공용 저장소에서 세어야 한다.
//     프로토타입에서 그걸 붙이는 건 과하고, 없이 두는 건 무책임하다. 그 사이를 택했다.

const WINDOW_MS = 60_000;
const MAX_PER_IP = 20;      // 분당 IP별
const MAX_GLOBAL = 200;     // 분당 전체 (인스턴스 기준)

const hits = new Map();     // ip -> number[] (타임스탬프)
let globalHits = [];

function prune(list, now) {
  const cutoff = now - WINDOW_MS;
  let i = 0;
  while (i < list.length && list[i] <= cutoff) i++;
  return i === 0 ? list : list.slice(i);
}

export function clientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

// 통과하면 null, 막히면 { status, error } 를 돌려준다.
export function checkRateLimit(req, now = Date.now()) {
  globalHits = prune(globalHits, now);
  if (globalHits.length >= MAX_GLOBAL) {
    return { status: 429, error: "요청이 몰려 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  const ip = clientIp(req);
  const list = prune(hits.get(ip) ?? [], now);
  if (list.length >= MAX_PER_IP) {
    hits.set(ip, list);
    return { status: 429, error: "잠시 후 다시 시도해 주세요." };
  }

  list.push(now);
  hits.set(ip, list);
  globalHits.push(now);

  // 오래된 IP 항목이 무한히 쌓이지 않게 정리한다.
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      const pruned = prune(v, now);
      if (pruned.length === 0) hits.delete(k);
      else hits.set(k, pruned);
    }
  }
  return null;
}

// 테스트용 — 인스턴스 상태를 비운다.
export function _resetRateLimit() {
  hits.clear();
  globalHits = [];
}
