// 256차원 float 임베딩을 int8로 줄여 배포 크기를 1/4로 만든다.
// 2,655개 × 256 × 4바이트 = 2.7MB → int8로 680KB.

export function quantizeVector(vec) {
  let max = 0;
  for (const x of vec) {
    const a = Math.abs(x);
    if (a > max) max = a;
  }
  const scale = max === 0 ? 1 : max / 127;
  const q = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) q[i] = Math.round(vec[i] / scale);
  return { q, scale };
}

export function dequantizeVector({ q, scale }) {
  const v = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) v[i] = q[i] * scale;
  return v;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
