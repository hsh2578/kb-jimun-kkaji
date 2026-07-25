export const AFFILIATE_NAME = {
  bank: "KB국민은행",
  card: "KB국민카드",
  sec: "KB증권",
};

// 학습용과 시험용을 겹치지 않게 반으로 가른다.
// 인덱싱한 발화로 시험을 보면 항상 100%가 나오고, 그 숫자는 아무것도 증명하지 못한다.
export function splitVariants(variants) {
  const train = [];
  const test = [];
  variants.forEach((v, i) => (i % 2 === 0 ? train : test).push(v));
  return { train, test };
}

// 임베딩 문서 = 계열사 + 경로 + 메뉴명 + 학습 발화
export function buildIndexText(node, trainVariants) {
  const parts = [
    AFFILIATE_NAME[node.affiliate] ?? node.affiliate,
    ...node.path,
    node.name,
    ...trainVariants,
  ];
  return parts.join(" | ");
}
