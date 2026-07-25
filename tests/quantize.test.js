import { test } from "node:test";
import assert from "node:assert/strict";
import { quantizeVector, dequantizeVector, cosine } from "../src/menu/quantize.js";

test("양자화 후 복원해도 코사인 유사도가 거의 보존된다", () => {
  const a = Float32Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.37));
  const b = Float32Array.from({ length: 256 }, (_, i) => Math.sin(i * 0.37 + 0.05));
  const before = cosine(a, b);
  const after = cosine(dequantizeVector(quantizeVector(a)), dequantizeVector(quantizeVector(b)));
  assert.ok(Math.abs(before - after) < 0.01, `before=${before} after=${after}`);
});

test("양자화 결과는 int8 범위 안에 있다", () => {
  const v = Float32Array.from({ length: 256 }, (_, i) => (i - 128) / 64);
  const { q } = quantizeVector(v);
  assert.equal(q.length, 256);
  for (const x of q) assert.ok(x >= -127 && x <= 127, `범위 밖 ${x}`);
});

test("같은 벡터의 코사인은 1이다", () => {
  const a = Float32Array.from({ length: 256 }, (_, i) => i % 7);
  assert.ok(Math.abs(cosine(a, a) - 1) < 1e-6);
});

test("영벡터는 0을 반환하고 NaN을 내지 않는다", () => {
  const z = new Float32Array(256);
  const a = Float32Array.from({ length: 256 }, () => 1);
  assert.equal(cosine(z, a), 0);
});
