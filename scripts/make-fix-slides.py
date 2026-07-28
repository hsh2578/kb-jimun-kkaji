# 텍스트 치환으로 계속 깨지던 나머지 장을 그림으로 다시 그린다.
#
# 원본 도형에 문단을 순서대로 밀어넣는 방식은 도형이 조금만 복잡해지면 어긋난다.
# 실측으로 확인한 증상:
#   · 4쪽  제목이 "1. 서류가 필요합니 / 다" 로 잘림
#   · 10쪽 말풍선이 겹쳐 대화가 안 읽힘 — 되묻기를 보여주는 유일한 장인데
#   · 12쪽 표의 L3 행이 아래 상자에 잘림
#   · 20쪽 '3사 통합 처리율'이 세로로 쌓여 화면 밖으로 나가고, 목업이 iM뱅크 화면
#   · 21·28·30쪽 라벨과 본문이 한 칸씩 밀려 짝이 어긋남
#
# 내용은 build-kb-deck.py 의 DECK 원문을 그대로 옮겼다. 목업은 배포본에서
# 직접 찍은 KB 화면으로 바꿨다(iM 화면이 남아 있으면 안 된다).
#
# 실행: python scripts/make-fix-slides.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _pages():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk3", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _pages()

from PIL import Image

from slide_kit import (FIG, INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       center, f, new_slide, para, right, save)

SHOTS = os.path.join(FIG, "screenshots")


def phone(im, name, xy, height):
    """폰 캡처를 높이에 맞춰 붙이고 실제 크기를 돌려준다."""
    p = Image.open(os.path.join(SHOTS, name)).convert("RGB")
    w = int(p.width * height / p.height)
    im.paste(p.resize((w, height), Image.LANCZOS), xy)
    return w, height


# ── 4쪽 · 서류 한 장 떼는 데 ────────────────────────────────
def s_journey():
    im, d = new_slide(
        "서류 한 장 떼는 데, 이렇게 됩니다",
        "예) 연말정산 소득공제용 서류가 필요한 상황입니다.",
        page=PAGE[4], nav_on=0)

    box(d, (1360, 92, 1820, 168), RED, RED, 12)
    center(d, "서류 한 장에 30분 이상", 1590, 112, f(30, True), PAPER)

    steps = [
        ("1. 서류가 필요합니다", ["“무슨 서류가 필요하지,", "어디서 떼지?”"]),
        ("2. 앱을 뒤집니다", ["메뉴 2,656개 중", "어디 있는지 모릅니다"]),
        ("3. 챗봇에 묻습니다", ["“메뉴로 가세요”", "(안내에서 멈춤)"]),
        ("4. 전화를 겁니다", ["ARS 여러 단계 + 긴 대기", "은행·카드·증권 각각"]),
        ("5. 결국 창구로 갑니다", ["대기 후 상담.", "고령층은 더 심합니다."]),
    ]
    x0, w, gap = 100, 316, 25
    for i, (title, body) in enumerate(steps):
        x = x0 + i * (w + gap)
        box(d, (x, 268, x + w, 560), PAPER, RULE, 14)
        d.rounded_rectangle((x, 268, x + w, 344), radius=14, fill=RED)
        d.rectangle((x, 330, x + w, 344), fill=RED)
        d.text((x + 20, 292), title, font=f(24, True), fill=PAPER)
        y = 376
        for line in body:
            y = para(d, line, x + 20, y, f(23), w - 40, INK_SOFT)
        if i < 4:
            d.polygon([(x + w + 4, 402), (x + w + 4, 424), (x + w + 21, 413)], fill=INK_FAINT)

    box(d, (100, 600, 1820, 748), PAPER_DIM, RULE, 14)
    d.text((132, 620), "왜 3번에서 끝나지 않나", font=f(27, True), fill=INK)
    para(d, "챗봇은 사전에 학습된 의도만 분류합니다. 학습되지 않은 말에는 "
            "“문의한 내용을 찾을 수 없어요”를 반복하고, 결국 상담사 연결로 넘깁니다. "
            "— 요즘IT, 카드사 AI 콜센터 운영자 기고",
         132, 662, f(24), 1660, INK_SOFT)

    band(d, 786, "앱에 있는 기능인데 못 찾아서 결국 사람을 찾게 되고, 그 사람마저 만나기 어렵습니다.",
         "이 일이 매일 반복됩니다.")
    d.text((100, 906), "출처: 요즘IT(카드사 AI 콜센터 운영자 기고) · 소비자가만드는신문 · 금융감독원 점포 현황",
           font=f(21), fill=INK_FAINT)
    return save(im, "fix-04-journey.png")


# ── 10쪽 · 우리 해법 (대화가 읽혀야 한다) ───────────────────
def s_solution():
    im, d = new_slide(
        "우리 해법 — 같은 일을, 이렇게",
        "앱을 뒤지지도, 전화하지도 않습니다. 사람에게 말하듯 하시면 AI가 알아듣고 대신 처리합니다.",
        page=PAGE[9], nav_on=1)

    # 대화 — 사용자는 오른쪽 노랑, AI는 왼쪽 회색. 이 구분이 살아야 상담으로 읽힌다.
    turns = [
        ("user", "돈 좀 보내야 하는데"),
        ("bot", "어느 분께 보내드릴까요?"),
        ("user", "아들"),
        ("bot", "아드님 계좌로 보내드릴게요. 얼마를 보낼까요?"),
        ("user", "30만원"),
        ("plan", "아들(홍*동 · KB국민은행 ***-77123)  300,000원"),
        ("done", "지문 인증 → 이체 완료"),
    ]
    x0, x1 = 100, 1000
    y = 262
    for who, text in turns:
        tw = d.textlength(text, font=f(24)) + 48
        tw = min(tw, 860)
        if who == "user":
            bx1 = x1
            bx0 = bx1 - tw
            d.rounded_rectangle((bx0, y, bx1, y + 62), radius=14, fill=YELLOW)
            d.text((bx0 + 24, y + 17), text, font=f(24, True), fill=INK)
        elif who == "bot":
            d.rounded_rectangle((x0, y, x0 + tw, y + 62), radius=14, fill=PAPER_DIM,
                                outline=RULE, width=2)
            d.text((x0 + 24, y + 17), text, font=f(24), fill=INK)
        elif who == "plan":
            d.rounded_rectangle((x0, y, x1, y + 76), radius=14, fill=PAPER,
                                outline=YELLOW, width=3)
            d.text((x0 + 20, y + 12), "실행 계획 — 확인하세요", font=f(20, True), fill=YELLOW)
            d.text((x0 + 20, y + 40), text, font=f(23, True), fill=INK)
            y += 14
        else:
            d.rounded_rectangle((x0, y, x1, y + 62), radius=14, fill=MACHINE)
            d.text((x0 + 24, y + 17), text, font=f(24, True), fill=YELLOW_LT)
        y += 78

    # 그 사이 AI가 하는 일
    d.text((1060, 250), "그 사이 AI가 하는 일", font=f(30, True), fill=INK)
    stages = [
        ("① 이해 (LLM)", "막연한 말에서 '이체' 의도를 파악"),
        ("② 되묻기", "빠진 조각을 한 번에 하나씩만 확인"),
        ("③ 준비 (검색+도구)", "계좌번호는 기기 안에서 해석 — LLM에 가지 않음"),
        ("④ 실행", "최종 실행만 본인 확인 — 지문·PIN 등 기존 인증 그대로"),
    ]
    yy = 306
    for title, note in stages:
        box(d, (1060, yy, 1820, yy + 128), PAPER, RULE, 14)
        d.rectangle((1060, yy, 1072, yy + 128), fill=YELLOW)
        d.text((1096, yy + 20), title, font=f(26, True), fill=INK)
        para(d, note, 1096, yy + 60, f(23), 690, INK_SOFT)
        yy += 142

    band(d, 890, "고객은 계좌번호를 말하지 않았습니다. '아들'이라는 관계만으로 처리됩니다.",
         "되묻기(②)는 별도 도구입니다 — 문장 끝의 '?'로 추측하지 않고 구조로 드러냅니다.")
    return save(im, "fix-10-solution.png")


# ── 12쪽 · 3계층 라우팅 (표가 잘리면 안 된다) ───────────────
def s_layers():
    im, d = new_slide(
        "핵심 알고리즘 ① — 3계층 라우팅",
        "무엇을 할 수 있느냐에 따라 답의 종류를 나눕니다. 못 하는 일이 있어도 대화가 끊기지 않습니다.",
        page=PAGE[11], nav_on=2)

    cols = ["계층", "무엇을", "안전장치"]
    widths = [300, 900, 520]
    rows = [
        ("L1 · 라우팅", "실행도 조회도 못 해도 '어디 있는지'는 반드시 답하고,\n그 화면을 여는 버튼까지 준다",
         "LLM이 죽어도 동작\n(오프라인 최소 약속)"),
        ("L2 · 조회", "3사 데이터를 조합해 바로 답한다\n(연금·카드값·할부·지원금·환율 등 19종)",
         "부수효과 없음\n— 인증 불필요"),
        ("L3 · 실행", "부수효과를 경고하고 '계획'만 만든다.\n실행은 사람이 지문으로 승인 (10종)",
         "AuthGate 통과 없이는\n도구 호출 불가"),
    ]

    x0, y = 100, 258
    head_h, row_h = 70, 132
    d.rounded_rectangle((x0, y, x0 + sum(widths), y + head_h), radius=10, fill=MACHINE)
    d.rectangle((x0, y + head_h - 10, x0 + sum(widths), y + head_h), fill=MACHINE)
    cx = x0
    for i, c in enumerate(cols):
        center(d, c, cx + widths[i] / 2, y + 20, f(25, True), PAPER)
        cx += widths[i]
    y += head_h

    for r, (layer, what, guard) in enumerate(rows):
        bg = PAPER if r % 2 == 0 else PAPER_DIM
        d.rectangle((x0, y, x0 + sum(widths), y + row_h), fill=bg)
        d.line((x0, y, x0 + sum(widths), y), fill=RULE, width=1)
        d.text((x0 + 28, y + 48), layer, font=f(27, True), fill=INK)
        yy = y + 26
        for line in what.split("\n"):
            d.text((x0 + widths[0] + 28, yy), line, font=f(24), fill=INK_SOFT)
            yy += 38
        yy = y + 32
        for line in guard.split("\n"):
            d.text((x0 + widths[0] + widths[1] + 28, yy), line, font=f(23, True), fill=YELLOW)
            yy += 36
        y += row_h
    d.rectangle((x0, 258, x0 + sum(widths), y), outline=RULE, width=2)
    cx = x0
    for w_ in widths[:-1]:
        cx += w_
        d.line((cx, 258, cx, y), fill=RULE, width=1)

    box(d, (100, y + 34, 1820, y + 196), PAPER_DIM, YELLOW, 14)
    d.text((132, y + 54), "되묻기는 별도 도구입니다", font=f(28, True), fill=INK)
    para(d, "문장 끝의 '?'로 추측하지 않고 ask_clarification 이라는 도구로 드러냈습니다. "
            "그래서 되물었다는 사실이 감사 로그에 남고, 테스트로 고정할 수 있습니다. "
            "확신이 없으면 실행하지 않습니다 — 수취인·금액·잔액 중 하나라도 확인되지 않으면 "
            "계획 자체를 만들지 않습니다.",
         132, y + 96, f(24), 1660, INK_SOFT)

    band(d, 946, "할 수 있는 만큼만 하되, 반드시 답합니다 — 못 하는 일에서도 대화가 끊기지 않습니다.",
         x0=100, x1=1820, h=58)
    return save(im, "fix-12-layers.png")


# ── 15쪽 · LLM 경계 ─────────────────────────────────────────
def s_boundary():
    im, d = new_slide(
        "외부 LLM을 써도 되는 이유 — 경계를 코드로 그었습니다",
        "“공개 API에 고객정보를?”라는 질문에, 정책이 아니라 구조로 답합니다.",
        page=PAGE[14], nav_on=2)

    box(d, (100, 258, 940, 620), PAPER, RULE, 14)
    d.rounded_rectangle((100, 258, 940, 330), radius=14, fill=YELLOW)
    d.rectangle((100, 316, 940, 330), fill=YELLOW)
    d.text((132, 278), "LLM에 나가는 것", font=f(28, True), fill=INK)
    out = [
        ("고객의 말", "주민번호·계좌·카드·전화번호 패턴은 전송 전 마스킹"),
        ("후보 메뉴 이름", "공개 정보"),
        ("도구 목록", "함수 이름과 인자 형식"),
    ]
    y = 360
    for t, note in out:
        d.text((132, y), f"· {t}", font=f(26, True), fill=INK)
        para(d, note, 132, y + 34, f(22), 780, INK_SOFT)
        y += 84

    box(d, (980, 258, 1820, 620), MACHINE, RED, 14)
    d.rounded_rectangle((980, 258, 1820, 330), radius=14, fill=RED)
    d.rectangle((980, 316, 1820, 330), fill=RED)
    d.text((1012, 278), "LLM에 나가지 않는 것", font=f(28, True), fill=PAPER)
    # 마지막 항목(y=558)과 아래 캡션(y=566)이 포개져 글자가 뭉갰다 —
    # 하필 이 문서의 핵심 주장을 담은 박스였다. 간격을 줄이고 캡션을 내린다.
    never = ["잔액", "계좌번호", "예금주", "카드번호", "거래내역"]
    y = 354
    for t in never:
        # ✕(U+2715)는 맑은고딕에 없어 네모(.notdef)로 나온다 — ×(U+00D7)를 쓴다.
        d.text((1012, y), f"×  {t}", font=f(27, True), fill=PAPER)
        y += 44
    d.text((1012, 578), "도구 실행 결과는 화면으로만 갑니다.", font=f(22), fill=YELLOW_LT)

    guards = [
        ("전송 전 지웁니다 (scrubPII)", "주민번호·계좌·카드·전화번호 패턴을 마스킹합니다."),
        ("나가기 전 막습니다 (assertNoPII)",
         "허용된 필드 이름이 아니면 네트워크에 나가기 전 예외를 던집니다. 필드 이름이 맞아도 값 안에 패턴이 남아 있으면 다시 막습니다."),
        ("이력에도 남기지 않습니다",
         "대화 이력의 도구 결과에는 “실행됨. 결과는 사용자 화면에 표시함. 수치는 비공개”만 남습니다."),
        ("문장은 기기 안에서 만듭니다",
         "잔액을 LLM에 되돌려 보내지 않으므로, 결과를 설명하는 문장도 기기 안에서 생성합니다."),
    ]
    y = 654
    for t, note in guards:
        box(d, (100, y, 1820, y + 66), PAPER, RULE, 12)
        d.rectangle((100, y, 112, y + 66), fill=YELLOW)
        d.text((140, y + 18), t, font=f(24, True), fill=INK)
        d.text((640, y + 20), note, font=f(21), fill=INK_SOFT)
        y += 74

    band(d, 952, "이 경계 덕분에 모델 선택이 자유롭습니다 — 폐쇄망이든 외부 API든 같은 코드가 돕니다.",
         x0=100, x1=1820, h=56)
    return save(im, "fix-15-boundary.png")


# ── 18쪽 · 실측 성능 ────────────────────────────────────────
def s_metrics():
    im, d = new_slide(
        "실측 성능 — 대본이 아님을 어떻게 확인했나",
        "의도 분류가 아니라, LLM이 대화마다 호출할 기능을 스스로 고른다는 점을 측정했습니다.",
        page=PAGE[17], nav_on=2)

    # 값은 전부 data/*-report.json 에서 그대로 가져온다.
    #   relevance-report.json  표본 200 · 판정 160 · Top-1 107 · Top-3 153
    #   tool-eval-report.json  40건 중 36건, L1 4/5 · L2 9/10 · L3 13/15 · L4 10/10
    #   node --test            245 pass / 0 fail
    cards = [
        ("95.6%", "메뉴 검색 Top-3 관련도",
         ["Top-1 은 66.9% (107/160)", "표본 200건 중 답할 수 없는 질문 40건 제외"]),
        ("90.0%", "도구 선택 정확도 (36/40)",
         ["L1 4/5 · L2 9/10 · L3 13/15", "가장 어려운 L4(에두른 표현) 10/10"]),
        ("245개", "회귀 테스트 전부 통과",
         ["node --test · 245 pass / 0 fail", "안전장치는 전부 테스트로 고정"]),
    ]
    x0, w, gap = 100, 560, 30
    for i, (big, title, notes) in enumerate(cards):
        x = x0 + i * (w + gap)
        box(d, (x, 250, x + w, 500), PAPER, RULE, 14)
        d.rectangle((x, 250, x + w, 260), fill=YELLOW)
        d.text((x + 28, 284), big, font=f(64, True), fill=INK)
        d.text((x + 28, 368), title, font=f(24, True), fill=INK)
        y = 410
        for n in notes:
            d.text((x + 28, y), f"· {n}", font=f(21), fill=INK_SOFT)
            y += 34

    # 실패한 4건이 어디였는지 밝힌다. 감추면 90%가 오히려 의심을 산다.
    box(d, (100, 528, 940, 700), PAPER_DIM, RULE, 14)
    d.text((132, 546), "틀린 4건은 어디였나", font=f(25, True), fill=INK)
    para(d, "L1(직접 지시) 1건 · L2(생활 표현) 1건 · L3(막연한 상황) 2건. "
            "가장 어려운 L4(에두른 표현)에서는 틀리지 않았습니다. "
            "실행 도구를 잘못 고른 경우에도 계획 카드가 먼저 뜨므로, 지문 인증 전에 "
            "무엇을 하려는지 화면에서 확인할 수 있습니다.",
         132, 584, f(21), 780, INK_SOFT)

    # 측정의 한계를 먼저 말한다.
    box(d, (980, 528, 1820, 706), MACHINE, YELLOW, 14)
    d.text((1012, 544), "이 수치의 한계", font=f(24, True), fill=YELLOW_LT)
    for i, t in enumerate([
        "심판도 gpt-4o-mini 입니다 — 사람 검수는 파일럿에서",
        "도구 선택 표본이 40건이라 구간이 넓습니다",
        "가상 데이터 기반 · 실제 고객정보 미사용",
        "과제 완수율(끝까지 도달)은 아직 재지 않았습니다",
    ]):
        d.text((1012, 582 + i * 29), f"· {t}", font=f(19), fill=PAPER)

    # 띠의 둘째 줄이 오른쪽 끝에서 잘렸다 — 폭(1720px, 24pt)에 맞춰 줄인다.
    band(d, 734, "숫자를 좋게 만들려고 지표를 바꾸지 않았습니다.",
         "처음 잰 27.6%는 '한 발화에 정답이 여럿'이라는 측정 설계 결함이었고, 고쳐 다시 재 95.6%를 얻었습니다.",
         x0=100, x1=1820, h=92)
    d.text((100, 846), "출처: data/relevance-report.json · data/tool-eval-report.json · node --test 실행 결과",
           font=f(20), fill=INK_FAINT)
    return save(im, "fix-18-metrics.png")


# ── 20쪽 · 목표 지표 (iM 목업 → KB 실제 화면) ───────────────
def s_targets():
    im, d = new_slide(
        "무엇을, 얼마나 좋아지게 하나 — 목표 지표",
        "도입 1년 시점 목표치 · 대상: 서류·명세서·자동이체·지원금 등 '묻힌 업무'",
        page=PAGE[20], nav_on=3)

    # 앞선 판은 '-30%', '80%', '98%+' 를 근거 없이 적었다. 문서 전체가
    # "숫자는 실측했다"를 내세우는데 정작 목표에서 무너진다. 잴 수 있는 것만
    # 목표로 남기고, 못 재는 것은 '파일럿에서 정한다'고 밝힌다.
    targets = [
        ("메뉴 검색 정확도", "Top-3 95.6% (실측)", "Top-1 80%+",
         "지금 Top-1 은 66.9% — 첫 후보가 맞아야 되묻기 없이 끝납니다"),
        ("처리 단계", "메뉴 2,656개 또는 전화·창구", "대화 1회",
         "찾는 과정 자체를 없앱니다 — 단계 수는 설계로 정해지는 값입니다"),
        ("3사 통합 처리율", "0% (앱이 따로)", "도구 30종 전부",
         "지금 3사를 한 대화에서 처리하는 수단이 없습니다. 분모는 우리가 만든 30종입니다"),
        ("과제 완수율", "미측정", "파일럿에서 기준 확정",
         "사람 개입 없이 실행까지 도달한 비율. 파일럿 1단계의 통과 조건으로 잡습니다"),
    ]
    y = 258
    for name, now, goal, note in targets:
        box(d, (100, y, 1280, y + 140), PAPER, RULE, 14)
        d.rectangle((100, y, 112, y + 140), fill=YELLOW)
        d.text((140, y + 20), name, font=f(28, True), fill=INK)
        d.text((140, y + 66), now, font=f(24), fill=INK_SOFT)
        arrow_x = 140 + d.textlength(now, font=f(24)) + 24
        d.text((arrow_x, y + 64), "→", font=f(26, True), fill=INK_FAINT)
        d.text((arrow_x + 44, y + 60), goal, font=f(30, True), fill=RED)
        d.text((140, y + 104), note, font=f(21), fill=INK_FAINT)
        y += 152

    # 목업은 배포본에서 직접 찍은 KB 화면이다.
    pw, ph = phone(im, "kb-phone-1.png", (1360, 258), 560)
    d.rectangle((1360, 258, 1360 + pw, 258 + ph), outline=RULE, width=2)
    d.text((1360, 832), "실제 작동 화면 — 지원금 신청 실행과", font=f(21), fill=INK_SOFT)
    d.text((1360, 862), "대상이 아닌 지원금의 자동 차단", font=f(21), fill=INK_SOFT)

    band(d, 906, "근거를 댈 수 없는 목표치는 적지 않았습니다 — 콜센터 인입 감소율은 파일럿 측정 뒤에 정합니다.",
         x0=100, x1=1820, h=58)
    return save(im, "fix-20-targets.png")


# ── 21쪽 · 무엇이 좋아지나 ──────────────────────────────────
def s_benefit():
    im, d = new_slide(
        "무엇이 좋아지나요? — 고객 · 직원 · 사회(포용)",
        "고객 + 직원 + 사회를 동시에 — 역대 수상작이 공통으로 갖춘 구조입니다.",
        page=PAGE[21], nav_on=3)

    groups = [
        ("고객", YELLOW, [
            "3사에 흩어진 일을 「대화 한 번」으로",
            "ARS 미로 → 즉시 처리",
            "메뉴 2,656개 → 한 문장",
        ]),
        ("직원", YELLOW_LT, [
            "단순·반복 문의를 AI가 흡수",
            "상담사는 복잡한 상담에 집중",
            "창구 혼잡·콜센터 인입 감소",
        ]),
        ("사회 (포용)", MACHINE, [
            "고령층을 앱 안으로 (음성 지원)",
            "몰라서 못 받던 지원금을 먼저 찾아줌",
            "점포가 줄어도 닿을 수 있는 창구",
        ]),
    ]
    x0, w, gap = 100, 560, 30
    for i, (name, col, items) in enumerate(groups):
        x = x0 + i * (w + gap)
        box(d, (x, 262, x + w, 700), PAPER, RULE, 14)
        d.rounded_rectangle((x, 262, x + w, 346), radius=14, fill=col)
        d.rectangle((x, 332, x + w, 346), fill=col)
        d.text((x + 28, 288), name, font=f(32, True), fill=PAPER if col == MACHINE else INK)
        y = 384
        for t in items:
            d.ellipse((x + 30, y + 11, x + 44, y + 25), fill=col if col != MACHINE else YELLOW)
            y = para(d, t, x + 64, y, f(24), w - 96, INK) + 22

    box(d, (100, 736, 1820, 892), PAPER_DIM, RULE, 14)
    d.text((132, 756), "왜 셋을 함께 적었나", font=f(27, True), fill=INK)
    para(d, "고객 편의만 좋아지고 운영 부담이 커지면 도입되지 않습니다. 반대로 비용만 줄이면 "
            "고객이 떠납니다. 이 제품은 같은 장치 하나로 셋이 함께 움직입니다 — "
            "고객이 스스로 끝내면, 콜센터 인입이 줄고, 창구에 가기 어려운 분이 앱 안에서 끝냅니다.",
         132, 798, f(24), 1660, INK_SOFT)

    band(d, 926, "누구 하나의 편의가 아니라, 세 방향이 같은 장치로 움직입니다.",
         x0=100, x1=1820, h=58)
    return save(im, "fix-21-benefit.png")


# ── 27쪽 · 그들은 안내한다, 우리는 실행한다 ─────────────────
def s_versus():
    im, d = new_slide(
        "그들은 「안내」한다. 우리는 「실행」한다.",
        "KB가 지금 운영 중인 챗봇에 직접 물어보고, 같은 질문을 우리 프로토타입에도 던졌습니다.",
        page=PAGE[23], nav_on=3)

    # 앞선 판은 언론 기사 캡처를 근거로 삼았다. KB 심사에 자사 서비스를
    # 기사 하나로 부정하는 구성이었고, 기사 이미지 사용 문제도 있었다.
    # KB 챗봇에 직접 물어 우리가 찍은 화면으로 바꾼다 — 같은 질문, 같은 날.
    d.text((100, 244), "같은 질문을 KB 챗봇과 「지문까지」에 각각 던졌습니다 (2026.7 직접 캡처)",
           font=f(25, True), fill=INK_SOFT)

    ask = "“연말정산 해야 하는데 뭘 떼야 할지 모르겠어요”"
    box(d, (100, 284, 1820, 344), PAPER, YELLOW, 12)
    center(d, ask, 960, 300, f(28, True), INK)

    # 폭을 기준으로 맞췄더니 세로가 띠를 뚫고 슬라이드 밖으로 나갔다.
    # 두 캡처 모두 '높이'를 먼저 고정하고 폭을 따라가게 한다.
    SHOT_TOP, SHOT_H = 400, 516

    def place(name, x, crop=None):
        p = Image.open(os.path.join(SHOTS, name)).convert("RGB")
        if crop:
            p = p.crop(crop)
        w = int(p.width * SHOT_H / p.height)
        im.paste(p.resize((w, SHOT_H), Image.LANCZOS), (x, SHOT_TOP))
        d.rectangle((x, SHOT_TOP, x + w, SHOT_TOP + SHOT_H), outline=RULE, width=2)
        return w

    # 챗봇 화면은 폭이 넓고 내용은 왼쪽에 몰려 있다 — 답변 카드만 잘라 쓴다.
    cw = place("kb-chatbot-2.png", 100, crop=(10, 425, 400, 900))
    d.text((100, 372), "KB 챗봇", font=f(24, True), fill=RED)

    ox = 100 + cw + 40
    ow = place("kb-phone-2.png", ox)
    d.text((ox, 372), "지문까지", font=f(24, True), fill=INK)

    bx = ox + ow + 40
    notes = [
        ("KB 챗봇의 답", "“연말정산 관련 궁금한 내용을 선택해 주세요”", RED),
        ("", "모르겠다고 말한 사람에게 다시 고르라고 합니다.", INK_SOFT),
        ("", "카드 서류는 “KB국민카드(1588-1688)로 문의해 주세요”", RED),
        ("", "— 계열사로 전화하라고 합니다.", INK_SOFT),
        ("우리 쪽", "되물어 좁히고, 계획을 보여주고, 부수효과를 경고한 뒤", INK),
        ("", "지문 확인을 받아 실제로 실행합니다.", INK),
    ]
    y = 404
    for label, text, col in notes:
        if label:
            d.text((bx, y), label, font=f(23, True), fill=INK)
            y += 34
        y = para(d, text, bx, y, f(21), 1790 - bx, col) + 10

    band(d, 946, "KB 챗봇은 “선택해 주세요”라고 답했습니다. 고를 줄 알았다면 묻지 않았을 것입니다.",
         x0=100, x1=1820, h=58)
    return save(im, "fix-27-versus.png")


# ── 28쪽 · 저희가 다르게 본 지점 ────────────────────────────
def s_different():
    im, d = new_slide(
        "저희가 다르게 본 지점",
        "같은 'AI 상담'이라는 말 안에서, 무엇을 다르게 잡았는지 넷으로 적었습니다.",
        page=PAGE[24], nav_on=3)

    items = [
        ("①", "명령하는 AI가 아니라, 명령하지 못하는 분을 위한 AI입니다",
         "카카오뱅크나 Erica(뱅크오브아메리카 AI)는 “엄마한테 5만원”처럼 정확한 명령을 "
         "전제합니다. 저희는 “돈이 자꾸 새는 것 같은데” 같은 막연한 이야기에서 시작해, "
         "되물어 좁혀 갑니다."),
        ("②", "메뉴를 찾아주는 게 아니라, 메뉴를 없앱니다",
         "지금 챗봇은 “카드관리 메뉴로 가세요”라고 링크만 줍니다. 저희는 AI가 그 깊이를 "
         "대신 들어가고, 고객은 말하고 확인만 하시면 됩니다. 안내가 필요한 자리에도 "
         "「열기」 버튼을 함께 드립니다."),
        ("③", "은행 하나가 아니라 KB 3사를 한 대화에서",
         "고객은 'KB'라고 생각하지 '은행/카드/증권'이라고 생각하지 않습니다. "
         "“잔액증명서 떼줘”에 은행 것인지 증권 것인지 가려주는 일은, 3사를 모두 가진 "
         "KB에서만 의미가 있습니다."),
        ("④", "인증은 그대로 두고, 거기까지 가는 길만 없앱니다",
         "새로운 인증을 만들지 않습니다. 지금처럼 지문·PIN·추가 확인을 씁니다. "
         "그래서 안전하고, 보안·규제 검토도 통과하기 쉽습니다."),
    ]
    y = 250
    for num, title, body in items:
        box(d, (100, y, 1820, y + 168), PAPER, RULE, 14)
        d.rounded_rectangle((100, y, 190, y + 168), radius=14, fill=YELLOW)
        d.rectangle((176, y, 190, y + 168), fill=YELLOW)
        center(d, num, 145, y + 58, f(44, True), PAPER)
        d.text((222, y + 22), title, font=f(28, True), fill=INK)
        para(d, body, 222, y + 68, f(23), 1560, INK_SOFT)
        y += 180

    band(d, 976, "'말이 통하는 챗봇'이 아니라 '말로 끝나는 창구'를 만들었습니다.",
         x0=100, x1=1820, h=54)
    return save(im, "fix-28-different.png")


# ── 30쪽 · 부록 (도구 30개) ─────────────────────────────────
def s_appendix():
    im, d = new_slide(
        "부록 — 업무를 도구로 나눈 예시 (프로토타입 30개)",
        "이 방식이 성립하는지 30개로 확인한 것입니다. 실제로는 KB 3사 비대면 업무 전체로 넓혀 갑니다.",
        page=PAGE[26], nav_on=3)

    groups = [
        ("카드", ["카드 목록 조회", "이번 달 카드값 합계", "이번 달 할부 청구액",
                  "카드 혜택 실적", "이용명세서 파일 생성", "분실신고 · 사용정지",
                  "할부 기간 변경"]),
        ("조회", ["계좌 목록 · 잔액", "대출 현황", "만기 도래 상품",
                  "이번 달 총 출금액", "자주 보내는 곳", "최근 이체 내역"]),
        ("이체", ["이체 실행 (관계로 수취인 해석)", "최근 이체처로 재이체", "이체한도 변경"]),
        ("자동이체", ["자동이체 목록", "자동이체 해지", "출금계좌 변경"]),
        ("서류 · 증명", ["세금 신고 서류 찾기 (계열사별)", "은행 제증명 발급", "증권 서류 발급"]),
        ("증권 · 연금", ["3사 통합 연금 조회", "보유 종목 조회"]),
        ("외환", ["환율 · 우대율 조회"]),
        ("지원금", ["신청 가능 지원금 조회", "지원금 신청"]),
        ("대화", ["되묻기 (정보가 빠졌을 때)"]),
    ]

    x0, w, gap = 100, 553, 30
    col_y = [258, 258, 258]
    for i, (name, tools) in enumerate(groups):
        c = i % 3
        x = x0 + c * (w + gap)
        y = col_y[c]
        h = 60 + len(tools) * 34 + 14
        box(d, (x, y, x + w, y + h), PAPER, RULE, 12)
        d.rectangle((x, y, x + 10, y + h), fill=YELLOW)
        d.text((x + 28, y + 14), name, font=f(25, True), fill=INK)
        yy = y + 58
        for t in tools:
            d.text((x + 28, yy), f"· {t}", font=f(21), fill=INK_SOFT)
            yy += 34
        col_y[c] = y + h + 20

    band(d, 946, "도구를 늘리는 만큼 처리 범위도 늘어납니다. 30개는 시작이고, 끝은 전 업무입니다.",
         x0=100, x1=1820, h=58)
    return save(im, "fix-30-appendix.png")


def main():
    print("깨진 장 다시 그리기:")
    s_journey()
    s_solution()
    s_layers()
    s_boundary()
    s_metrics()
    s_targets()
    s_benefit()
    s_versus()
    s_different()
    s_appendix()


if __name__ == "__main__":
    main()
