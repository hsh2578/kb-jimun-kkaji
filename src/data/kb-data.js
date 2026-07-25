// 전부 가상의 데모 데이터. 실제 KB 고객 정보가 아니다.
export const KB_DATA = {
  disclaimer: "본 데이터는 전부 가상이며 실제 KB 고객 정보가 아닙니다.",
  today: "2026-07-27",

  user: { name: "홍길동", ageGroup: "20대", pin: "0000" },

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
      { id: "i1", cardId: "c1", merchant: "노트북", amount: 1_800_000, months: 3, remaining: 2, feeRate: "연 15.9%" },
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
