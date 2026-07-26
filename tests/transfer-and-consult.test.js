// 이체·명세서·지원금 도구와 '되묻기' 상담 계층.
// 이 파일이 지키는 명제는 하나다 — 확신이 없으면 실행하지 않고 되묻는다.
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolveRecipient, resolveSubsidy, fromAccount, analyzeImpact } from "../src/exec/impact.js";
import { ACTION_TOOLS } from "../src/tools/action-tools.js";
import { QUERY_TOOLS } from "../src/tools/query-tools.js";
import { CLARIFY, CLARIFY_TOOL } from "../src/tools/clarify.js";
import { createOrchestrator } from "../src/orchestrator.js";
import { createAuthGate } from "../src/exec/auth-gate.js";
import { formatPlanSummary, formatActionResult, formatAuditLog } from "../src/ui/format.js";
import { buildIndexText } from "../src/menu/utterance.js";
import { KB_DATA } from "../src/data/kb-data.js";

// ── 수취인 해석 — 계좌번호는 LLM에 가지 않는다 ───────────────────────────

test("resolveRecipient는 관계 라벨로 수취인을 찾는다", () => {
  assert.equal(resolveRecipient({ recipient_hint: "아들" })?.id, "r1");
  assert.equal(resolveRecipient({ recipient_hint: "어머니" })?.id, "r2");
});

test("resolveRecipient는 마스킹된 예금주명으로도 찾는다", () => {
  assert.equal(resolveRecipient({ recipient_hint: "행복관리사무소" })?.id, "r3");
});

test("resolveRecipient는 '최근에 이체한 곳'을 최신 내역에서 찾는다", () => {
  const to = resolveRecipient({ use_last_recipient: true });
  assert.equal(to?.id, KB_DATA.bank.transfers[0].contactId);
});

test("resolveRecipient는 모르는 상대에게 아무나 배정하지 않는다", () => {
  assert.equal(resolveRecipient({ recipient_hint: "없는사람xyz" }), null);
  assert.equal(resolveRecipient({}), null);
});

test("resolveRecipient는 존재하지 않는 contact_id를 힌트로 폴백하지 않는다", () => {
  assert.equal(resolveRecipient({ contact_id: "없음", recipient_hint: "아들" }), null);
});

// ── 이체 영향 분석 — 모르면 진행하지 않는다 ─────────────────────────────

test("이체: 받는 분을 모르면 차단한다", async () => {
  const r = await analyzeImpact("transfer_money", { amount: 10_000 });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /받는 분/);
});

test("이체: 금액을 모르면 차단한다", async () => {
  const r = await analyzeImpact("transfer_money", { recipient_hint: "아들" });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /금액/);
});

test("이체: 잔액을 넘으면 차단한다", async () => {
  const r = await analyzeImpact("transfer_money", { recipient_hint: "아들", amount: 999_999_999 });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /잔액/);
});

test("이체: 정상 요청은 되돌릴 수 없다는 경고를 반드시 낸다", async () => {
  const r = await analyzeImpact("transfer_money", { recipient_hint: "아들", amount: 300_000 });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /취소·반환이 어렵/.test(w)));
});

test("이체: 타행이면 수수료를, 고액이면 지연이체를 경고한다", async () => {
  const other = await analyzeImpact("transfer_money", { recipient_hint: "관리비", amount: 100_000 });
  assert.ok(other.warnings.some((w) => /하나은행/.test(w)));
  const big = await analyzeImpact("transfer_money", { recipient_hint: "아들", amount: 1_500_000 });
  assert.ok(big.warnings.some((w) => /100만원 이상/.test(w)));
});

test("지원금: 대상이 아니면 차단하고 이유를 밝힌다", async () => {
  const r = await analyzeImpact("apply_subsidy", { name_hint: "청년 대중교통비 환급" });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /신청 대상이 아닙니다/);
});

test("지원금: '고유가 지원금'처럼 일부만 말해도 찾는다", () => {
  assert.equal(resolveSubsidy({ name_hint: "고유가 지원금" })?.id, "sb1");
});

test("명세서 내보내기는 파일에 개인정보가 담긴다고 경고한다", async () => {
  const r = await analyzeImpact("export_card_statement", { card_id: "c1" });
  assert.equal(r.blocked, false);
  assert.ok(r.warnings.some((w) => /가맹점명/.test(w)));
});

// ── 실행 도구 ────────────────────────────────────────────────────────────

test("transfer_money는 실행 후 잔액까지 돌려준다", async () => {
  const from = fromAccount();
  const out = await ACTION_TOOLS.transfer_money.run({ recipient_hint: "아들", amount: 300_000 });
  assert.equal(out.transferred.to, "아들");
  assert.equal(out.transferred.amount, 300_000);
  assert.equal(out.transferred.balanceAfter, from.balance - 300_000);
});

test("transfer_money는 잔액을 넘으면 실행 자체가 실패한다", async () => {
  await assert.rejects(
    () => ACTION_TOOLS.transfer_money.run({ recipient_hint: "아들", amount: 999_999_999 }),
    /잔액이 부족/
  );
});

test("export_card_statement는 요청한 확장자로 파일명을 만든다", async () => {
  const xlsx = await ACTION_TOOLS.export_card_statement.run({ card_id: "c1", format: "xlsx" });
  assert.match(xlsx.exported.fileName, /\.xlsx$/);
  const pdf = await ACTION_TOOLS.export_card_statement.run({ card_id: "c1", format: "pdf" });
  assert.match(pdf.exported.fileName, /\.pdf$/);
});

test("apply_subsidy는 대상이 아닌 지원금을 실행하지 않는다", async () => {
  await assert.rejects(() => ACTION_TOOLS.apply_subsidy.run({ subsidy_id: "sb3" }), /신청 대상이 아닙니다/);
});

test("신규 실행 도구는 전부 인증을 요구한다", () => {
  for (const name of ["transfer_money", "export_card_statement", "apply_subsidy"]) {
    assert.equal(ACTION_TOOLS[name].requiresAuth, true, `${name}은 인증이 필요해야 한다`);
  }
});

// ── 조회 도구 ────────────────────────────────────────────────────────────

test("get_card_bill_total은 카드 한 장이 아니라 전체 합계를 낸다", async () => {
  const out = await QUERY_TOOLS.get_card_bill_total.run({});
  assert.equal(out.items.length, KB_DATA.card.statements.length);
  assert.equal(out.total, KB_DATA.card.statements.reduce((s, x) => s + x.amount, 0));
});

test("get_monthly_installment은 총 할부원금이 아니라 이번 달 청구액을 낸다", async () => {
  const out = await QUERY_TOOLS.get_monthly_installment.run({});
  const monthly = KB_DATA.card.installments.reduce((s, i) => s + i.monthlyAmount, 0);
  assert.equal(out.total, monthly);
  const principal = KB_DATA.card.installments.reduce((s, i) => s + i.amount, 0);
  assert.notEqual(out.total, principal);
});

test("list_transfer_contacts는 관계 라벨을 이름으로 보여준다", async () => {
  const out = await QUERY_TOOLS.list_transfer_contacts.run({});
  assert.ok(out.items.some((i) => i.name === "아들"));
});

test("list_subsidies는 대상이 아닌 항목도 이유와 함께 보여준다", async () => {
  const out = await QUERY_TOOLS.list_subsidies.run({});
  assert.ok(out.items.some((i) => /신청 대상 아님/.test(i.note ?? "")));
});

// ── 되묻기(상담) 계층 ────────────────────────────────────────────────────

const askingLLM = (question) => ({
  chat: async () => ({ message: "", toolCalls: [{ name: CLARIFY, args: { question } }] }),
});
const stubRouter = {
  search: async () => [{ id: "bank:x", affiliate: "bank", path: ["전체서비스"], name: "이체", keywords: [] }],
};
const tools = { ...QUERY_TOOLS, ...ACTION_TOOLS, [CLARIFY]: CLARIFY_TOOL };

test("되묻기는 ASK 계층으로 나오고 질문을 그대로 전한다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: askingLLM("아드님 계좌로 보내드릴게요. 얼마를 보낼까요?"),
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.equal(r.layer, "ASK");
  assert.equal(r.message, "아드님 계좌로 보내드릴게요. 얼마를 보낼까요?");
});

test("되묻기에는 메뉴 위치를 덧붙이지 않는다 — 질문이 안내로 읽히면 대화가 끊긴다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: askingLLM("얼마를 보낼까요?"),
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.doesNotMatch(r.message, /있습니다/);
  assert.equal(r.menus.length, 0, "되묻는 중에는 후보 메뉴를 그리지 않는다");
});

test("되묻기는 감사 로그에 남는다 — 추측하지 않고 멈췄다는 기록이다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: askingLLM("얼마를 보낼까요?"),
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.match(formatAuditLog(r.audit).join("\n"), /되묻기/);
});

test("질문 없이 되묻기를 부르면 대화를 끊지 않고 위치라도 안내한다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: askingLLM(undefined),
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.equal(r.layer, "L1");
  assert.ok(r.message.length > 0);
});

test("되묻기 응답도 대화 이력에 assistant 턴으로 남는다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: askingLLM("얼마를 보낼까요?"),
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  const turn = o.historyTurn(r);
  assert.equal(turn.role, "assistant");
  assert.equal(turn.content, "얼마를 보낼까요?");
});

// ── 화면 문구 — 지문을 누르기 전에 누구에게 얼마를 보내는지 보여야 한다 ──

test("이체 계획 요약에 받는 분·계좌·금액·출금계좌가 모두 나온다", () => {
  const s = formatPlanSummary({ tool: "transfer_money", args: { recipient_hint: "아들", amount: 300_000 } });
  const to = resolveRecipient({ recipient_hint: "아들" });
  assert.match(s, /아들/);
  assert.ok(s.includes(to.number), "마스킹된 계좌번호가 보여야 한다");
  assert.ok(s.includes(to.holder), "예금주가 보여야 한다");
  assert.match(s, /300,000원/);
  assert.match(s, /출금/);
});

test("이체 완료 문구에 남은 잔액이 나온다", () => {
  const s = formatActionResult(
    { tool: "transfer_money" },
    { transferred: { to: "아들", holder: "홍*동", bank: "KB국민은행", number: "***-**-*77123", amount: 300_000, from: "KB My通장", balanceAfter: 2_940_500 } }
  );
  assert.match(s, /2,940,500원/);
});

// ── 생활사건 계층 ────────────────────────────────────────────────────────

test("life-events.json의 메뉴 ID는 전부 실제 메뉴에 존재한다", () => {
  const menus = JSON.parse(readFileSync("data/menus.json", "utf8"));
  const ids = new Set(menus.map((m) => m.id));
  const events = JSON.parse(readFileSync("data/life-events.json", "utf8"));
  const bad = Object.keys(events).filter((k) => !k.startsWith("_") && !ids.has(k));
  assert.deepEqual(bad, [], `존재하지 않는 메뉴 ID: ${bad.join(", ")}`);
});

test("buildIndexText는 생활사건 발화를 전량 문서에 넣는다", () => {
  const node = { id: "x", affiliate: "bank", name: "환전신청", path: ["개인뱅킹 서비스 메뉴"] };
  const text = buildIndexText(node, ["환전 어떻게 해요"], ["해외 나가는데 뭐 준비해야 돼?"]);
  assert.match(text, /해외 나가는데 뭐 준비해야 돼\?/);
  assert.match(text, /환전 어떻게 해요/);
});

test("router.size는 벡터 수가 아니라 아는 메뉴 수를 센다", async () => {
  const { createRouter } = await import("../src/router/menu-router.js");
  const one = { id: "bank:x", affiliate: "bank", name: "환전신청", path: [], keywords: [], q: [1], scale: 1 };
  const r = createRouter({ items: [one, { ...one }, { ...one, id: "bank:y" }], dim: 1, embedFn: async () => null });
  assert.equal(r.size, 2, "같은 메뉴가 벡터를 여러 개 가져도 메뉴는 하나로 센다");
});
