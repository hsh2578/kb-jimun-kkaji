# 기술 상세 4장.
#
# 앞선 판은 "무엇을 만들었나"는 있는데 "어떻게 도는가"가 없었다. 프로토타입
# 설명만 가득하고, 알고리즘과 실제 KB 배치는 한 줄씩만 스쳤다.
#
# 여기 적는 값은 전부 이 저장소의 코드에서 가져온 것이다 — 지어낸 사양이 아니다.
#   src/router/menu-router.js  하이브리드 가중치 0.9 / 0.1, 메뉴별 최고점 dedup
#   src/menu/quantize.js       int8 양자화 2.7MB → 680KB
#   api/embed.js               text-embedding-3-small, dimensions=256
#   src/menu/utterance.js      색인 문서 구성, 학습/시험 반반 분리
#   src/exec/auth-gate.js      fail-closed, 계획 결속 1회용 토큰, 재실행 차단
#   src/llm/pii.js             패턴 4종, 허용 필드 5개, 값 재검사
#   src/exec/impact.js         2단 이름 매칭 (토큰 커버리지 → 최장 공통 부분열)
#
# 실행: python scripts/make-tech-slides.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _pages():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk5", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _pages()

from slide_kit import (INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       center, f, new_slide, para, right, save)

NAV_TECH = 2
MONO = INK  # 코드처럼 보여야 하는 글자


def chip(d, x, y, text, fill, tc=PAPER, size=20, pad=14):
    w = d.textlength(text, font=f(size, True)) + pad * 2
    d.rounded_rectangle((x, y, x + w, y + size + 16), radius=8, fill=fill)
    d.text((x + pad, y + 7), text, font=f(size, True), fill=tc)
    return w


# ── 31 · 요청 하나가 지나가는 길 ────────────────────────────
def t1_flow():
    im, d = new_slide(
        "요청 하나가 지나가는 길 — 어디서 무엇이 도는가",
        "“아들한테 30만원 보내줘” 한 마디가 실행까지 가는 전 구간입니다. 색은 실행 위치를 뜻합니다.",
        page=PAGE[31], nav_on=NAV_TECH)

    # 범례
    legend = [("기기 안", YELLOW_PALE, INK), ("사내 서버", YELLOW, INK), ("LLM", MACHINE, PAPER)]
    x = 100
    for name, col, tc in legend:
        x += chip(d, x, 246, name, col, tc) + 14

    steps = [
        ("①", "정규화 · 키워드 분해", "기기 안", YELLOW_PALE, INK,
         "조사·공백 제거 후 2글자 이상 토큰만 남깁니다. splitKeywords()"),
        ("②", "질의 임베딩", "사내 서버", YELLOW, INK,
         "text-embedding-3-small · dimensions=256 (호출 1회, 개인정보 없음)"),
        ("③", "하이브리드 검색", "기기 안", YELLOW_PALE, INK,
         "score = 0.9·cos(q,v) + 0.1·lex — 색인 2,714벡터는 기기에 내장, 네트워크 왕복 없음"),
        ("④", "도구 선택 (Function Calling)", "LLM", MACHINE, PAPER,
         "후보 메뉴 5건 + 도구 스키마 30종만 실어 보냅니다. 잔액·계좌번호는 보내지 않습니다"),
        ("⑤", "슬롯 검사 · 되묻기 판정", "기기 안", YELLOW_PALE, INK,
         "필수 인자가 비면 ask_clarification, 다 찼으면 prepare() — 한 번에 하나만 묻습니다"),
        ("⑥", "엔티티 해석", "기기 안", YELLOW_PALE, INK,
         "“아들” → 수취인 레코드. 계좌번호는 기기를 떠나지 않습니다"),
        ("⑦", "계획 생성 · 부수효과 경고", "기기 안", YELLOW_PALE, INK,
         "prepare()는 계획만 만듭니다. 이 시점에 실행 함수는 호출되지 않습니다"),
        ("⑧", "생체인증 → AuthGate", "기기 안", YELLOW_PALE, INK,
         "WebAuthn 증명 → issue(planId, proof). 검증기 미주입 시 전량 거부(fail-closed)"),
        ("⑨", "도구 실행 · 결과 표시", "사내 서버", YELLOW, INK,
         "consume(token, planId) 통과 후 1회만. 결과는 화면으로만 가고 LLM에 돌아가지 않습니다"),
    ]
    y = 300
    for num, name, where, col, tc, note in steps:
        box(d, (100, y, 1820, y + 62), PAPER, RULE, 10)
        d.rectangle((100, y, 112, y + 62), fill=col)
        d.text((132, y + 16), num, font=f(24, True), fill=INK_FAINT)
        d.text((176, y + 14), name, font=f(24, True), fill=INK)
        cw = d.textlength(where, font=f(17, True)) + 22
        d.rounded_rectangle((620, y + 16, 620 + cw, y + 46), radius=7, fill=col)
        d.text((631, y + 21), where, font=f(17, True), fill=tc)
        d.text((790, y + 18), note, font=f(20), fill=INK_SOFT)
        y += 70

    band(d, 946, "LLM이 관여하는 구간은 ④ 하나입니다 — 나머지 여덟은 기기 또는 사내 서버에서 돕니다.",
         x0=100, x1=1820, h=58)
    return save(im, "tech-1-flow.png")


# ── 32 · 되묻기 알고리즘 ────────────────────────────────────
def t2_clarify():
    im, d = new_slide(
        "되묻기 알고리즘 — 언제 묻고, 무엇을 묻고, 언제 그만 묻나",
        "상담처럼 느껴지는 지점입니다. 감이 아니라 규칙으로 정해 두어야 테스트할 수 있습니다.",
        page=PAGE[32], nav_on=NAV_TECH)

    # 슬롯 표
    d.text((100, 246), "① 도구마다 필수 슬롯이 정해져 있습니다", font=f(28, True), fill=INK)
    box(d, (100, 292, 1120, 470), PAPER, RULE, 12)
    d.text((132, 308), "transfer_money", font=f(24, True), fill=YELLOW)
    slots = [("to", "수취인", "“아들”", True),
             ("amount", "금액", "300,000", True),
             ("from", "출금계좌", "주계좌 (기본값)", False)]
    y = 350
    for key, label, got, req in slots:
        d.text((150, y), key, font=f(23, True), fill=INK)
        d.text((330, y), label, font=f(22), fill=INK_SOFT)
        d.text((520, y), "필수" if req else "선택", font=f(20, True),
               fill=RED if req else INK_FAINT)
        d.text((640, y), got, font=f(22), fill=INK)
        y += 38

    # 판정
    box(d, (1160, 292, 1820, 470), MACHINE, YELLOW, 12)
    d.text((1192, 310), "판정", font=f(24, True), fill=YELLOW_LT)
    d.text((1192, 352), "빈 필수 슬롯이 있는가?", font=f(23), fill=PAPER)
    d.text((1192, 396), "있다 → ask_clarification", font=f(22, True), fill=YELLOW_LT)
    d.text((1192, 428), "없다 → prepare() 로 직행", font=f(22, True), fill=PAPER)

    # 규칙
    d.text((100, 502), "② 물을 때의 규칙", font=f(28, True), fill=INK)
    rules = [
        ("한 번에 하나만", "“어느 분께, 얼마를?”처럼 두 개를 묶어 묻지 않습니다.",
         "묶어 물으면 답이 한쪽만 오고, 나머지를 또 물어 대화가 길어집니다."),
        ("이미 들은 것은 다시 묻지 않는다", "슬롯이 찬 항목은 판정에서 제외됩니다.",
         "다 알면서 되묻는 것은 상담이 아니라 취조입니다."),
        ("되묻기도 하나의 도구다", "문장 끝의 '?'로 추측하지 않고 ask_clarification 으로 드러냅니다.",
         "그래서 감사 로그에 남고, 회귀 테스트로 고정됩니다."),
    ]
    y = 548
    for name, what, why in rules:
        box(d, (100, y, 1820, y + 106), PAPER, RULE, 12)
        d.rectangle((100, y, 112, y + 106), fill=YELLOW)
        d.text((140, y + 16), name, font=f(25, True), fill=INK)
        d.text((140, y + 54), what, font=f(22), fill=INK_SOFT)
        d.text((1120, y + 40), why, font=f(21), fill=RED)
        y += 118

    band(d, 916, "이 규칙이 무너진 적이 있습니다 — “아들한테 30만원 보내줘”에 “어느 분께?”를 되물었습니다.",
         "필수 슬롯이 이미 다 찼는데도 물은 것입니다. 판정을 '빠졌을 때만'으로 좁혀 고쳤고, 테스트로 묶었습니다.",
         x0=100, x1=1820, h=92)
    return save(im, "tech-2-clarify.png")


# ── 33 · 엔티티 해석 ────────────────────────────────────────
def t3_entity():
    im, d = new_slide(
        "엔티티 해석 — “아들”을 계좌번호로 바꾸는 일은 기기 안에서",
        "고객은 계좌번호를 말하지 않습니다. 그리고 그 번호는 LLM에 보낼 수 없습니다. 둘 다 만족시켜야 합니다.",
        page=PAGE[33], nav_on=NAV_TECH)

    # 2단 매칭
    d.text((100, 246), "2단 매칭 — 확신이 없으면 진행하지 않습니다", font=f(28, True), fill=INK)

    stages = [
        ("1단 · 토큰 커버리지",
         "고객이 말한 토막(2글자 이상)이 등록명 안에 전부 들어 있는가",
         "“고유가 지원금” → 「고유가 유류비 지원금」\n가운데를 빼먹어도 잡힙니다",
         "정확히 하나만 걸리면 확정"),
        ("2단 · 최장 공통 부분열",
         "1단에서 여럿이 걸리거나 아무것도 안 걸렸을 때",
         "겹치는 글자 수 ≥ 2  그리고\n짧은 쪽 대비 비중 ≥ 0.6",
         "동점이면 중단 — 어느 쪽인지 모르므로"),
    ]
    x, w = 100, 840
    for i, (title, when, how, verdict) in enumerate(stages):
        bx = x + i * (w + 40)
        box(d, (bx, 292, bx + w, 560), PAPER, RULE, 14)
        d.rounded_rectangle((bx, 292, bx + w, 356), radius=14, fill=YELLOW)
        d.rectangle((bx, 342, bx + w, 356), fill=YELLOW)
        d.text((bx + 24, 310), title, font=f(26, True), fill=INK)
        d.text((bx + 24, 378), when, font=f(21), fill=INK_FAINT)
        yy = 416
        for line in how.split("\n"):
            d.text((bx + 24, yy), line, font=f(23), fill=INK)
            yy += 34
        d.text((bx + 24, 508), verdict, font=f(22, True), fill=RED)

    # 걸러낸 실제 사례
    box(d, (100, 596, 1820, 748), PAPER_DIM, RULE, 14)
    d.text((132, 614), "임계값이 있는 이유 — 실제로 잘못 잡았던 것들", font=f(27, True), fill=INK)
    cases = [
        ("“전기요금” → 「KT통신요금」", "끝의 '요금' 두 글자만 우연히 겹침 (비중 0.5) → 비중 기준으로 차단"),
        ("한 글자 겹침", "우연한 일치 → 최소 2글자 기준으로 차단"),
        ("동점 후보 둘", "어느 쪽인지 확신 불가 → 계획을 만들지 않고 되묻습니다"),
    ]
    y = 656
    for bad, fix in cases:
        d.text((132, y), f"· {bad}", font=f(22, True), fill=RED)
        d.text((700, y), fix, font=f(21), fill=INK_SOFT)
        y += 34

    box(d, (100, 784, 1820, 900), MACHINE, YELLOW, 14)
    d.text((132, 802), "왜 이 계산을 기기 안에서 하나", font=f(25, True), fill=YELLOW_LT)
    d.text((132, 844), "이 단계의 입력이 수취인 이름과 계좌번호이기 때문입니다. "
                       "LLM에 보내는 순간 이 제품이 하지 않겠다고 한 일이 됩니다.",
           font=f(23), fill=PAPER)

    band(d, 930, "잘못 짚은 실행보다, 멈추고 되묻는 편이 항상 낫습니다.",
         x0=100, x1=1820, h=58)
    return save(im, "tech-3-entity.png")


# ── 34 · KB 배치 구조 ───────────────────────────────────────
def t4_deploy():
    im, d = new_slide(
        "KB에 놓았을 때의 배치 구조 — 망분리를 지키면서",
        "프로토타입은 외부 API로 돌지만, 경계가 코드에 있어 폐쇄망으로 그대로 옮겨집니다.",
        page=PAGE[34], nav_on=NAV_TECH)

    zones = [
        ("고객 단말 (KB스타뱅킹)", YELLOW_PALE, INK, [
            "대화 화면 · 계획 카드 (웹뷰)",
            "메뉴 색인 2,714벡터 (int8, 680KB)",
            "하이브리드 검색 · 슬롯 판정",
            "엔티티 해석 (계좌번호가 여기서 나오지 않음)",
            "생체인증 모듈 호출 (네이티브 브릿지)",
        ]),
        ("KB 내부망", YELLOW, INK, [
            "API 게이트웨이 — 도구 함수 30종의 실제 호출부",
            "계정계 · 카드 · 증권 원장 조회/실행",
            "AuthGate 검증 · 감사 로그 적재",
            "색인 빌드 파이프라인 (메뉴 수집 → 발화 생성 → 임베딩 → 배포)",
        ]),
        ("모델 (폐쇄망 우선)", MACHINE, PAPER, [
            "KB 자체 GenAI 플랫폼 또는 온프레미스 sLLM",
            "받는 것: 고객 발화(마스킹 후) · 후보 메뉴명 · 도구 스키마",
            "받지 않는 것: 잔액 · 계좌번호 · 예금주 · 카드번호 · 거래내역",
            "도구 실행 결과가 모델로 되돌아가지 않음",
        ]),
    ]
    x, w, gap = 100, 560, 30
    for i, (name, col, tc, items) in enumerate(zones):
        bx = x + i * (w + gap)
        box(d, (bx, 250, bx + w, 640), PAPER, RULE, 14)
        d.rounded_rectangle((bx, 250, bx + w, 322), radius=14, fill=col)
        d.rectangle((bx, 308, bx + w, 322), fill=col)
        d.text((bx + 22, 270), name, font=f(25, True), fill=tc)
        y = 346
        for t in items:
            d.ellipse((bx + 24, y + 9, bx + 36, y + 21), fill=col if col != MACHINE else YELLOW)
            y = para(d, t, bx + 52, y, f(21), w - 78, INK_SOFT) + 12

    # 경계선
    for bx in (688, 1278):
        d.line((bx, 250, bx, 640), fill=RED, width=3)
    center(d, "경계", 688, 654, f(20, True), RED)
    center(d, "경계", 1278, 654, f(20, True), RED)

    # 무엇을 새로 만들고 무엇을 안 만드나
    box(d, (100, 700, 940, 900), PAPER_DIM, RULE, 14)
    d.text((132, 718), "새로 만들지 않는 것", font=f(26, True), fill=INK)
    for i, t in enumerate(["인증 방식 (지문·PIN 그대로)", "계정계·카드·증권 원장",
                           "KB스타뱅킹 앱 구조", "메뉴 체계 자체"]):
        d.text((132, 762 + i * 34), f"· {t}", font=f(22), fill=INK_SOFT)

    box(d, (980, 700, 1820, 900), PAPER, YELLOW, 14)
    d.text((1012, 718), "새로 붙이는 것", font=f(26, True), fill=INK)
    for i, t in enumerate(["웹뷰 한 장 + 네이티브 브릿지", "색인 빌드 파이프라인 (주 1회)",
                           "도구 함수 30종의 내부 API 연결", "AuthGate · 감사 로그"]):
        d.text((1012, 762 + i * 34), f"· {t}", font=f(22), fill=INK_SOFT)

    band(d, 930, "고객정보가 지나는 구간과 모델이 보는 구간이 코드로 갈라져 있습니다.",
         x0=100, x1=1820, h=58)
    return save(im, "tech-4-deploy.png")


# ── 40 · 상담 데이터로 실제 해본 것 ───────────────────────
# 앞선 판은 "상담 이력을 넣으면 좋아집니다"라는 계획이었다. 그래서 실제로
# 공개 데이터를 받아 넣어 봤고, 실패했다. 그 실패를 적는다 —
# "넣으면 좋아진다"보다 "넣어 봤고 왜 안 되는지 안다"가 방어된다.
def t5_learn():
    im, d = new_slide(
        "상담 데이터로 실제 해봤습니다 — 그리고 실패했습니다",
        "공개된 실제 콜센터 데이터를 받아 넣어 봤습니다. 결과와 원인을 그대로 적습니다.",
        page=PAGE[40], nav_on=NAV_TECH)

    # ① 무엇을 했나 — 파이프라인
    d.text((100, 236), "① 무엇을 했나", font=f(26, True), fill=INK)
    steps = [
        ("AI Hub 「금융분야 고객상담 데이터」", "하나은행 30,315 · 하나증권 13,331 = 63,000건"),
        ("되묻기 추출", "TX(상담사)/RX(고객) 화자 구분 파싱 → 29,583건 → 중복 제거 19,566종"),
        ("앱 맥락 선별", "본인확인·계좌번호 구술·지점 방문·마무리 인사를 제외 → 300건"),
        ("주입 후 A/B 측정", "주입한 것은 시험에서 빼고, 같은 40건으로 비교"),
    ]
    y = 276
    for i, (t, note) in enumerate(steps):
        box(d, (100, y, 1820, y + 54), PAPER, RULE, 10)
        d.rectangle((100, y, 112, y + 54), fill=YELLOW)
        d.text((132, y + 14), f"{i + 1}.", font=f(20, True), fill=INK_FAINT)
        d.text((180, y + 13), t, font=f(22, True), fill=INK)
        d.text((700, y + 15), note, font=f(20), fill=INK_SOFT)
        y += 60

    # ② 결과 — 실패
    d.text((100, 518), "② 결과 — 실제 데이터가 오히려 나빴습니다", font=f(26, True), fill=RED)
    cols = ["주입한 것", "되물어야 할 때 물음", "물었을 때 슬롯", ""]
    widths = [420, 320, 260, 720]
    rows = [
        ("① 없음 (규칙만)", "0 / 13", "—", "", INK_SOFT),
        ("② 합성 사례 64건", "5 / 13  (38.5%)", "4 / 5", "가장 나았습니다", INK),
        ("③ 실제 문장 300건", "0 / 13  (0.0%)", "—", "되묻기를 아예 하지 않았습니다", RED),
        ("④ 합성 + 실제 순서통계", "4 / 13  (30.8%)", "4 / 4", "②보다 낮았습니다", RED),
    ]
    x0, y = 100, 552
    d.rounded_rectangle((x0, y, x0 + sum(widths), y + 36), radius=8, fill=MACHINE)
    cx = x0
    for i, c in enumerate(cols):
        if c:
            d.text((cx + 20, y + 8), c, font=f(18, True), fill=PAPER)
        cx += widths[i]
    y += 36
    for r, (a, b, c, note, col) in enumerate(rows):
        d.rectangle((x0, y, x0 + sum(widths), y + 34), fill=PAPER if r % 2 == 0 else PAPER_DIM)
        d.text((x0 + 20, y + 8), a, font=f(18, True), fill=col)
        d.text((x0 + widths[0] + 20, y + 8), b, font=f(18, True), fill=col)
        d.text((x0 + widths[0] + widths[1] + 20, y + 8), c, font=f(18), fill=INK_SOFT)
        d.text((x0 + widths[0] + widths[1] + widths[2] + 20, y + 8), note, font=f(18), fill=col)
        y += 34
    d.rectangle((x0, 552, x0 + sum(widths), y), outline=RULE, width=2)

    # ③ 왜 실패했나
    box(d, (100, 740, 940, 906), MACHINE, YELLOW, 14)
    d.text((132, 756), "③ 왜 실패했나", font=f(24, True), fill=YELLOW_LT)
    d.text((132, 792), "“입금이 언제 어떤 금액으로 들어왔는지", font=f(20), fill=PAPER)
    d.text((132, 816), "  알려주시면 확인에 도움이 됩니다”", font=f(20), fill=PAPER)
    para(d, "되묻기와 안내가 한 문장에 붙어 있습니다. "
            "모델이 '도구를 부르라'가 아니라 '이렇게 글로 답하라'로 배웠습니다.",
         132, 846, f(18), 790, YELLOW_LT)

    # ④ 그래서 무엇이 필요한가
    box(d, (980, 740, 1820, 906), PAPER, YELLOW, 14)
    d.text((1012, 756), "④ 그래서 무엇이 필요한가", font=f(24, True), fill=INK)
    for i, t in enumerate([
        "데이터를 넣는 것만으로는 안 됩니다.",
        "전화 상담의 되묻기를 앱 대화 형태로",
        "다시 쓰는 단계가 반드시 필요합니다.",
        "그 작업은 KB 상담 이력으로 해야 의미가 있습니다.",
    ]):
        d.text((1012, 798 + i * 27), t, font=f(20, i == 0), fill=INK if i == 0 else INK_SOFT)

    band(d, 926, "실패도 결과입니다 — 파이프라인은 남았고, KB 이력이 들어오면 같은 자리에 꽂힙니다.",
         x0=100, x1=1820, h=56)
    return save(im, "tech-5-learn.png")


def main():
    print("기술 상세 슬라이드:")
    t5_learn()
    t1_flow()
    t2_clarify()
    t3_entity()
    t4_deploy()


if __name__ == "__main__":
    main()
