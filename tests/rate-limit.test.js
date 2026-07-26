import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientIp, _resetRateLimit } from "../api/_rate-limit.js";

const reqFrom = (ip) => ({ headers: { "x-forwarded-for": ip }, socket: {} });

test("clientIp는 x-forwarded-for의 첫 주소를 쓴다", () => {
  assert.equal(clientIp(reqFrom("1.2.3.4, 5.6.7.8")), "1.2.3.4");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "9.9.9.9" } }), "9.9.9.9");
  assert.equal(clientIp({ headers: {}, socket: {} }), "unknown");
});

test("IP별 상한을 넘으면 429를 돌려준다", () => {
  _resetRateLimit();
  const now = 1_000_000;
  for (let i = 0; i < 20; i++) {
    assert.equal(checkRateLimit(reqFrom("1.1.1.1"), now + i), null, `${i}번째는 통과해야 한다`);
  }
  const blocked = checkRateLimit(reqFrom("1.1.1.1"), now + 20);
  assert.equal(blocked.status, 429);
});

test("다른 IP는 서로의 한도에 영향받지 않는다", () => {
  _resetRateLimit();
  const now = 2_000_000;
  for (let i = 0; i < 20; i++) checkRateLimit(reqFrom("2.2.2.2"), now + i);
  assert.equal(checkRateLimit(reqFrom("3.3.3.3"), now + 21), null);
});

test("창이 지나면 다시 통과한다", () => {
  _resetRateLimit();
  const now = 3_000_000;
  for (let i = 0; i < 20; i++) checkRateLimit(reqFrom("4.4.4.4"), now + i);
  assert.equal(checkRateLimit(reqFrom("4.4.4.4"), now + 20).status, 429);
  assert.equal(checkRateLimit(reqFrom("4.4.4.4"), now + 61_000), null, "60초 뒤에는 풀려야 한다");
});

test("전체 상한은 여러 IP를 합쳐서 센다", () => {
  _resetRateLimit();
  const now = 4_000_000;
  let n = 0;
  for (let ip = 0; ip < 30; ip++) {
    for (let i = 0; i < 10; i++) {
      if (checkRateLimit(reqFrom(`10.0.0.${ip}`), now + n++) === null) continue;
      return; // 200건 근처에서 막히면 정상
    }
  }
  assert.fail("전체 상한이 걸리지 않았다");
});
