export const AFFILIATE_NAME = {
  bank: "KB국민은행",
  card: "KB국민카드",
  sec: "KB증권",
  // 크롤링 대상은 아니지만 연금 통합 조회가 보험 계열사 자산을 함께 돌려준다.
  insurance: "KB라이프",
};

// 학습용과 시험용을 겹치지 않게 반으로 가른다.
// 인덱싱한 발화로 시험을 보면 항상 100%가 나오고, 그 숫자는 아무것도 증명하지 못한다.
export function splitVariants(variants) {
  const train = [];
  const test = [];
  variants.forEach((v, i) => (i % 2 === 0 ? train : test).push(v));
  return { train, test };
}

// 임베딩 문서 = 계열사 + 경로 + 메뉴명 + 학습 발화 + 생활사건 발화
//
// lifeEvents 는 학습/시험으로 쪼개지 않고 전량 들어간다. 생성 발화(trainVariants)는
// 커버리지를 '측정'하려고 반씩 갈랐지만, 생활사건 발화는 측정 대상이 아니라
// 손으로 메운 구멍이다 — 절반을 빼면 메우려던 구멍이 그대로 남는다.
export function buildIndexText(node, trainVariants, lifeEvents = []) {
  const parts = [
    AFFILIATE_NAME[node.affiliate] ?? node.affiliate,
    ...node.path,
    node.name,
    ...trainVariants,
    ...lifeEvents,
  ];
  return parts.join(" | ");
}
