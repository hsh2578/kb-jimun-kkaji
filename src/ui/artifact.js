// 실행의 결과물을 실제 파일로 만든다.
//
// 왜 필요한가 — 챗봇은 "명세서를 만들었습니다 (파일명.xlsx)" 라고 말할 수 있다.
// 말만 하는 것은 챗봇도 한다. 다른 점은 손에 쥐어주는 것이다.
// 파일명만 보여주고 끝내면 "만들었다"는 말을 믿어달라는 것이지, 만든 게 아니다.
//
// 브라우저만으로 만든다 — 서버로 나가는 것이 없으므로 명세서 내용도 밖으로
// 새지 않는다. 이 제품이 지키겠다고 한 경계와 같은 원칙이다.
import { KB_DATA } from "../data/kb-data.js";

const won = (n) => Number(n).toLocaleString("ko-KR");

// CSV 한 칸. 쉼표·따옴표·줄바꿈이 들어가면 규칙대로 감싼다.
function cell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 카드 이용명세서 → 엑셀에서 바로 열리는 CSV.
// BOM 을 붙이지 않으면 엑셀이 한글을 깨뜨린다.
export function buildStatementCsv({ cardId, month } = {}) {
  const card = KB_DATA.card.cards.find((c) => c.id === cardId) ?? KB_DATA.card.cards[0];
  const rows = KB_DATA.card.transactions.filter((t) => t.cardId === card.id);
  const period = month ?? KB_DATA.card.statements.find((s) => s.cardId === card.id)?.month ?? KB_DATA.today.slice(0, 7);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const lines = [
    [`KB국민카드 이용명세서`],
    [`카드`, `${card.name} (****${card.last4})`],
    [`청구월`, period],
    [`발급일시`, KB_DATA.today],
    [],
    ["거래일", "가맹점", "분류", "금액(원)", "할부"],
    ...rows.map((r) => [r.date, r.merchant, r.category, r.amount, r.installment]),
    [],
    ["합계", "", "", total, ""],
    [],
    [KB_DATA.disclaimer],
  ];

  return {
    name: `KB국민카드_이용명세서_${period}.csv`,
    type: "text/csv;charset=utf-8",
    // ﻿ = BOM. 엑셀은 이게 없으면 UTF-8 한글을 깨뜨린다.
    body: "﻿" + lines.map((r) => r.map(cell).join(",")).join("\r\n"),
    summary: `${rows.length}건 · 합계 ${won(total)}원`,
  };
}

// 제증명 → 인쇄하면 그대로 PDF 가 되는 문서.
//
// 왜 PDF 를 직접 만들지 않는가: 한글이 든 PDF 는 글꼴을 파일에 심어야 한다.
// 외부 라이브러리 없이(이 저장소의 규칙) 그걸 하려면 수 MB 짜리 글꼴을 번들해야
// 하고, 그러고도 깨질 위험이 남는다. 실제 서비스에서는 KB 전자문서 시스템이
// 이미 PDF 를 발급하므로 그 자리를 대신할 뿐이다 — 여기서는 브라우저 인쇄로
// PDF 가 되는 문서를 내주고, 화면에 그 사실을 그대로 밝힌다.
export function buildCertificateDoc({ name, affiliate = "bank" } = {}) {
  const issuer = affiliate === "sec" ? "KB증권" : "KB국민은행";
  const rows =
    affiliate === "sec"
      ? [["증명서명", name], ["발급기관", issuer], ["발급일", KB_DATA.today], ["용도", "제출용"]]
      : [
          ["증명서명", name],
          ["발급기관", issuer],
          ["발급일", KB_DATA.today],
          ["계좌", KB_DATA.bank.accounts[0].number],
          ["잔액", `${won(KB_DATA.bank.accounts[0].balance)}원`],
        ];

  const body = `<!doctype html><html lang="ko"><meta charset="utf-8">
<title>${issuer} ${name}</title>
<style>
  body{font-family:"Malgun Gothic",sans-serif;margin:48px;color:#191512}
  h1{font-size:20px;letter-spacing:-.02em;border-bottom:2px solid #ffbc00;padding-bottom:12px}
  table{border-collapse:collapse;margin-top:24px;width:100%;max-width:520px}
  th,td{border:1px solid #ddd;padding:10px 12px;font-size:14px;text-align:left}
  th{background:#faf7f0;width:120px;color:#5c534a;font-weight:600}
  .note{margin-top:28px;font-size:12px;color:#a89d8f;line-height:1.7}
</style>
<h1>${issuer} ${name}</h1>
<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
<p class="note">${KB_DATA.disclaimer}<br>
브라우저에서 인쇄(Ctrl+P) → 대상을 "PDF로 저장"으로 고르면 PDF 파일이 됩니다.<br>
실제 서비스에서는 KB 전자문서 시스템이 서명된 PDF 를 직접 발급합니다.</p>
</html>`;

  return {
    name: `${issuer}_${name}_${KB_DATA.today}.html`,
    type: "text/html;charset=utf-8",
    body,
    summary: "인쇄하면 PDF로 저장됩니다",
  };
}

// 실행 결과에서 내려받을 파일을 만든다. 없으면 null.
export function buildArtifact(tool, out) {
  const val = out && typeof out === "object" ? Object.values(out)[0] : null;
  if (!val) return null;

  if (tool === "export_card_statement") {
    const card = KB_DATA.card.cards.find((c) => c.name === val.card);
    return buildStatementCsv({ cardId: card?.id, month: val.month });
  }
  if (tool === "issue_certificate") return buildCertificateDoc({ name: val.name, affiliate: "bank" });
  if (tool === "issue_sec_tax_document") return buildCertificateDoc({ name: val.name, affiliate: "sec" });
  return null;
}
