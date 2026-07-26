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
  const [turn] = o.historyTurns(r);
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

// ── 모델이 자기 도구 호출을 '글'로 적어 보내는 사고 ─────────────────────

test("looksLikeToolCall은 호출 문법을 잡고 평범한 한국어는 놓아준다", async () => {
  const { looksLikeToolCall } = await import("../src/orchestrator.js");
  assert.equal(looksLikeToolCall("ask_clarification({question: '얼마를 보낼까요?'})"), true);
  assert.equal(looksLikeToolCall("transfer_money({recipient_hint: '아들'})"), true);
  assert.equal(looksLikeToolCall("아드님 계좌로 보내드릴게요. 얼마를 보낼까요?"), false);
  assert.equal(looksLikeToolCall("KB국민은행 > 개인뱅킹 서비스 메뉴 > 이체 에 있습니다."), false);
  assert.equal(looksLikeToolCall("이번 달 420,000원(전월 대비) 사용하셨습니다."), false);
});

test("모델이 도구 호출을 글로 적어 보내면 화면에 내보내지 않는다", async () => {
  const leaking = {
    chat: async () => ({ message: "ask_clarification({question: '얼마를 보낼까요?'})", toolCalls: [] }),
  };
  const o = createOrchestrator({
    router: stubRouter,
    llm: leaking,
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.doesNotMatch(r.message, /ask_clarification/, "화면에 코드가 나가면 안 된다");
  assert.ok(r.message.length > 0, "대신 위치 안내라도 나와야 한다");
  // 조용히 숨기지 않는다 — 걸렸다는 사실은 감사 로그에 남는다.
  assert.match(r.audit.suppressedToolText, /ask_clarification/);
});

// ── 대화 이력에 넣는 문장은 '모델이 볼 본보기'다 ────────────────────────

test("이력에 답변처럼 생긴 문장을 넣지 않는다 — 모델이 그걸 베낀다", async () => {
  const o = createOrchestrator({
    router: stubRouter,
    llm: { chat: async () => ({ message: "", toolCalls: [{ id: "c1", name: "list_pensions", args: {} }] }) },
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("내 연금 어디 들어가 있지?");
  const turns = o.historyTurns(r);
  // 도구를 부른 턴의 content 는 비어 있어야 한다. 호출 사실은 tool_calls 로 남는다.
  // 문장으로 남기면 모델이 그 말투를 베껴 도구 대신 문장을 뱉는다(실측 2회).
  assert.equal(turns[0].content, null);
  assert.equal(turns[0].tool_calls[0].function.name, "list_pensions");
  assert.equal(turns[1].role, "tool");
  assert.equal(turns[1].tool_call_id, "c1");
});

// ── 모델이 되묻기 도구를 안 쓰고 그냥 물을 때 ───────────────────────────

test("isQuestion은 물음표로 끝나는 문장만 물음으로 본다", async () => {
  const { isQuestion } = await import("../src/orchestrator.js");
  assert.equal(isQuestion("얼마를 보낼까요?"), true);
  assert.equal(isQuestion("아드님 계좌로 보내드릴게요. 얼마를 보낼까요?  "), true);
  assert.equal(isQuestion("KB국민은행 > 개인뱅킹 > 이체 에 있습니다."), false);
  assert.equal(isQuestion(""), false);
  assert.equal(isQuestion(undefined), false);
});

test("도구 없이 질문만 와도 안내를 덧붙이지 않는다", async () => {
  const asking = {
    chat: async () => ({ message: "아드님 계좌로 보내드릴게요. 얼마를 보낼까요?", toolCalls: [] }),
  };
  const o = createOrchestrator({
    router: stubRouter,
    llm: asking,
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("아들한테 이체해줘");
  assert.equal(r.layer, "ASK");
  assert.doesNotMatch(r.message, /있습니다/, "질문 뒤에 메뉴 위치가 붙으면 질문도 안내도 아니게 된다");
  assert.equal(r.menus.length, 0);
  assert.match(formatAuditLog(r.audit).join("\n"), /되묻기/);
});

test("질문이 아닌 안내에는 메뉴 위치가 그대로 붙는다", async () => {
  const guiding = {
    chat: async () => ({ message: "환율 우대는 외환 메뉴에서 받으실 수 있습니다.", toolCalls: [] }),
  };
  const o = createOrchestrator({
    router: stubRouter,
    llm: guiding,
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("환율 우대 어디서 받아?");
  assert.equal(r.layer, "L1");
  assert.match(r.message, /있습니다/);
});

// ── 상담 느낌: 숫자를 내놓기 전에 사람처럼 한마디 한다 ──────────────────

test("조회 도구마다 상담원의 한마디가 있다", async () => {
  const { speakForQuery } = await import("../src/ui/format.js");
  for (const name of ["list_autopays", "list_pensions", "get_card_bill_total",
                      "get_monthly_installment", "list_subsidies", "find_tax_documents"]) {
    assert.ok(speakForQuery(name).length > 0, `${name}에 할 말이 없다 — 목록만 던지면 상담이 아니다`);
  }
  assert.equal(speakForQuery("없는도구"), "");
  assert.equal(speakForQuery(undefined), "");
});

test("상담원의 한마디에는 금액이 박혀 있지 않다 — 숫자는 도구 결과에서만 온다", async () => {
  const { speakForQuery } = await import("../src/ui/format.js");
  for (const name of ["list_autopays", "get_card_bill_total", "list_subsidies"]) {
    assert.doesNotMatch(speakForQuery(name), /\d/, `${name}의 문구에 숫자가 박혀 있다`);
  }
});

test("관찰과 제안이 같은 말을 하지 않는다 — 같으면 화면에 두 번 나온다", async () => {
  const { speakForQuery, followUpForQuery } = await import("../src/ui/format.js");
  for (const name of ["list_autopays", "list_subsidies", "find_tax_documents", "get_card_bill_total"]) {
    const said = speakForQuery(name);
    const next = followUpForQuery(name);
    assert.ok(said && next, `${name}: 관찰과 제안이 둘 다 있어야 한다`);
    assert.notEqual(said, next);
    // 뒷문장이 앞문장을 통째로 되풀이하는 경우도 막는다.
    assert.ok(!said.includes(next) && !next.includes(said), `${name}: 한쪽이 다른 쪽을 그대로 품고 있다`);
  }
});

// ── 서류 발급: 대상이 없으면 계획을 만들지 않는다 ───────────────────────

test("서류 이름이 없으면 발급 계획을 만들지 않는다", async () => {
  const r = await analyzeImpact("issue_certificate", {});
  assert.equal(r.blocked, true);
  assert.match(r.reason, /어떤 서류/);
});

test("다른 계열사 서류면 어디서 발급하는지 알려주고 멈춘다", async () => {
  // 잔고증명서는 KB증권 서류다. 은행 도구로 부르면 막되, 어디인지 알려준다.
  const r = await analyzeImpact("issue_certificate", { name: "잔고증명서" });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /KB증권/);
});

test("목록에 없는 서류는 지어내지 않고 되묻는다", async () => {
  const r = await analyzeImpact("issue_certificate", { name: "없는증명서xyz" });
  assert.equal(r.blocked, true);
  assert.match(r.reason, /찾지 못했/);
});

test("제 계열사 서류는 그대로 통과한다", async () => {
  assert.equal((await analyzeImpact("issue_certificate", { name: "예금잔액증명서" })).blocked, false);
  assert.equal((await analyzeImpact("issue_sec_tax_document", { name: "잔고증명서" })).blocked, false);
});

// ── 아무 말에나 메뉴를 들이밀지 않는다 ──────────────────────────────────

test("wantsLocation: 위치를 묻는 말과 뜻을 묻는 말을 가른다", async () => {
  const { wantsLocation } = await import("../src/orchestrator.js");
  // 무엇을 하려는 말 — 안내가 필요하다. 표현은 끝이 없으므로 기본이 '안내'다.
  for (const q of ["환율 우대는 어디서 받아?", "해외 나가는데 뭐 준비해야 돼?",
                   "공인인증서 어떻게 발급해?", "통신비 그만 나가게 해줘", "적금 하나 들고 싶은데"]) {
    assert.equal(wantsLocation(q), true, `${q} 에는 위치 안내가 필요하다`);
  }
  // 뜻을 묻거나 그냥 대꾸한 말 — 메뉴를 붙이면 AI가 멍청해 보인다
  for (const q of ["운용지시가 없다는 게 무슨 말이야?", "알겠어 고마워", "그건 놔둬", "안녕"]) {
    assert.equal(wantsLocation(q), false, `${q} 에 메뉴를 붙이면 안 된다`);
  }
});

test("뜻을 묻는 말에는 답만 하고 메뉴를 붙이지 않는다", async () => {
  const explaining = {
    chat: async () => ({ message: "운용지시가 없다는 것은 투자 방향을 정해두지 않았다는 뜻입니다.", toolCalls: [] }),
  };
  const o = createOrchestrator({
    router: stubRouter,
    llm: explaining,
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("운용지시가 없다는 게 무슨 말이야?");
  assert.doesNotMatch(r.message, /있습니다\.$/, "설명 뒤에 메뉴 위치가 붙으면 안 된다");
  assert.equal(r.menus.length, 0, "후보 메뉴 목록도 그리지 않는다");
});

test("어디서 하는지 묻는 말에는 위치를 반드시 붙인다 — L1의 약속이다", async () => {
  const guiding = {
    chat: async () => ({ message: "환율 우대는 외환 거래 시 적용됩니다.", toolCalls: [] }),
  };
  const o = createOrchestrator({
    router: stubRouter,
    llm: guiding,
    tools,
    authGate: createAuthGate({ verifyProof: () => true }),
  });
  const r = await o.handle("환율 우대는 어디서 받아?");
  assert.match(r.message, /있습니다/);
  assert.ok(r.menus.length > 0);
});
