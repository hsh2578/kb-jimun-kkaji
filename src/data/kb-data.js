// 전부 가상의 데모 데이터. 실제 KB 고객 정보가 아니다.
export const KB_DATA = {
  disclaimer: "본 데이터는 전부 가상이며 실제 KB 고객 정보가 아닙니다.",
  today: "2026-07-27",

  bank: {
    accounts: [
      { id: "b1", name: "KB My通장", number: "***-**-*23456", balance: 3_240_500, type: "입출금" },
      { id: "b2", name: "KB Star 정기예금", number: "***-**-*98877", balance: 12_000_000, type: "예금", maturity: "2026-11-30", rate: "연 3.1%" },
      { id: "b3", name: "KB 퇴직연금 DC", number: "***-**-*33445", balance: 48_200_000, type: "퇴직연금", instruction: "없음" },
    ],
    autopays: [
      { id: "ap1", name: "KT 통신요금", amount: 52_000, day: 17, kind: "자동납부", from: "b1",
        impactIfCancelled: "다음 청구분부터 직접 납부해야 하며, 미납 시 통신 서비스가 정지될 수 있습니다." },
      { id: "ap2", name: "케이블 방송", amount: 15_000, day: 20, kind: "자동납부", from: "b1",
        impactIfCancelled: "다음 달부터 방송 시청이 중단될 수 있습니다." },
      { id: "ap3", name: "실손의료보험료", amount: 87_000, day: 25, kind: "자동이체", from: "b1",
        impactIfCancelled: "보험료 미납이 2회 누적되면 보장이 실효될 수 있습니다." },
      { id: "ap4", name: "KB 적금 납입", amount: 300_000, day: 28, kind: "자동송금", from: "b1",
        impactIfCancelled: "적금 만기 시 우대금리 조건을 놓칠 수 있습니다." },
    ],
    loans: [
      { id: "l1", name: "KB 직장인 신용대출", balance: 18_400_000, rate: "연 4.6%", nextDue: "2026-08-15" },
    ],
    // 자주 쓰는 이체 상대. 고객은 "아들한테 보내줘"라고 부르지 계좌번호를 말하지 않는다.
    // label(관계)만 LLM 힌트로 쓰이고, 예금주·계좌번호 해석은 resolveRecipient()가
    // LLM 경계 밖에서 한다. holder는 실제 은행 확인 화면과 같이 마스킹된 가상 이름이다.
    contacts: [
      { id: "r1", label: "아들", holder: "홍*동", bank: "KB국민은행", number: "***-**-*77123" },
      { id: "r2", label: "어머니", holder: "김*자", bank: "KB국민은행", number: "***-**-*40912" },
      { id: "r3", label: "관리비", holder: "행복관리사무소", bank: "하나은행", number: "***-**-*22087" },
    ],
    // 최근 이체 내역 — 최신순. "최근에 이체한 계좌에 보내줘"를 풀기 위한 근거다.
    transfers: [
      { id: "t1", contactId: "r3", amount: 187_000, at: "2026-07-25" },
      { id: "t2", contactId: "r1", amount: 300_000, at: "2026-07-05" },
      { id: "t3", contactId: "r2", amount: 500_000, at: "2026-07-01" },
    ],
    certificates: [
      { name: "예금잔액증명서", purpose: "비자·재산 증명", english: true },
      { name: "부채증명서", purpose: "대출 잔액 증명", english: false },
      { name: "금융거래확인서", purpose: "거래 사실 증명", english: false },
      { name: "연말정산증명서", purpose: "연말정산", english: false },
      { name: "원천징수영수증", purpose: "소득 증빙", english: false },
    ],
  },

  card: {
    cards: [
      { id: "c1", name: "KB국민 톡톡카드", last4: "4821", type: "신용" },
      { id: "c2", name: "KB국민 노리체크", last4: "7739", type: "체크" },
    ],
    statements: [
      { cardId: "c1", month: "2026-07", amount: 842_000, dueDate: "2026-08-14" },
      { cardId: "c2", month: "2026-07", amount: 213_500, dueDate: "즉시출금" },
    ],
    benefits: [
      { cardId: "c1", spentThisMonth: 420_000, nextTier: 500_000,
        rewards: ["커피 10% 할인", "주유 리터당 60원 할인"] },
    ],
    installments: [
      { id: "i1", cardId: "c1", merchant: "노트북", amount: 1_800_000, months: 3, remaining: 2, feeRate: "연 15.9%",
        monthlyAmount: 600_000 },
      { id: "i2", cardId: "c1", merchant: "가전 렌탈", amount: 960_000, months: 6, remaining: 4, feeRate: "연 12.9%",
        monthlyAmount: 160_000 },
    ],
    // 신청 가능한 지원금·환급. 고객은 이런 게 있는지도 모르고 넘어간다 —
    // 실제로 "몰라서 못 받는 돈"이 이 서비스가 겨냥하는 문제의 한 축이다.
    subsidies: [
      { id: "sb1", name: "고유가 유류비 지원금", eligible: true, amount: 120_000, deadline: "2026-08-31",
        basis: "최근 6개월 주유 실적 32만원", requires: "차량등록증 사본" },
      { id: "sb2", name: "에너지 캐시백", eligible: true, amount: 45_000, deadline: "2026-09-30",
        basis: "전기·도시가스 자동납부 6개월 유지" },
      { id: "sb3", name: "청년 대중교통비 환급", eligible: false, amount: 0,
        basis: "만 19~34세 대상 — 연령 조건 미충족" },
    ],
  },

  sec: {
    accounts: [{ id: "s1", name: "KB증권 종합계좌", number: "***-**-*55667", balance: 6_430_000 }],
    holdings: [
      { symbol: "AAPL", name: "Apple", qty: 12, currency: "USD", soldLastYear: true },
      { symbol: "005930", name: "삼성전자", qty: 40, currency: "KRW", soldLastYear: false },
    ],
    pensions: [{ id: "p1", name: "KB증권 IRP", balance: 11_500_000, instruction: "없음", allocation: "원리금보장 100%" }],
    taxDocs: [
      { name: "잔고증명서", purpose: "잔액 증명" },
      { name: "금융소득증명서", purpose: "금융소득 종합과세 신고" },
      { name: "해외주식양도소득내역", purpose: "해외주식 양도소득세 신고", deadline: "5월 31일" },
    ],
  },

  insurance: {
    pensions: [{ id: "ip1", name: "KB라이프 연금보험", monthly: 300_000, startedAt: "2024-03" }],
  },
};
