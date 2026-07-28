# 문제 정의 4장을 다시 쓴다.
#
# 앞선 판은 '누가 겪나 / 얼마나 큰가'로 나눠 놓아, 정작 이 제품이 왜 생겼는지가
# 흐려졌다. 제출자의 말이 뼈대다 —
#   "20대인 나도 상담을 받고 싶은데, 받고 싶어도 받기가 힘들다."
# 그래서 다섯 고리로 잇는다.
#
#   ① 무엇을 물어야 할지 몰랐다      (20대인 나도)
#   ② 검색도 챗봇도 '질문'을 전제한다
#   ③ 그래서 상담을 받고 싶었다
#   ④ 그런데 상담이 가장 멀었다
#   ⑤ 그래서 대화형 에이전트를 만들었다
#
# 수치는 전부 1차 출처를 확인한 것만 쓴다. 검증을 통과하지 못한 수치
# (콜센터 인력 증감, 지식iN 게시글 수)는 넣지 않는다.
#
# 실행: python scripts/make-problem-slides.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _pages():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk4", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _pages()

from slide_kit import (INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       center, f, new_slide, para, right, save)


# ── 4쪽 · 1인칭 ─────────────────────────────────────────────
def p1_me():
    im, d = new_slide(
        "저는 20대입니다. 그런데도 막혔습니다.",
        "앱을 못 쓰는 사람의 이야기가 아닙니다. 앱을 매일 쓰는 사람이 겪은 일입니다.",
        page=PAGE[4], nav_on=0)

    steps = [
        ("①", "연말정산 서류가 필요했습니다",
         "그런데 무슨 서류를 떼야 하는지 몰랐습니다."),
        ("②", "검색창에 무엇을 칠지 몰랐습니다",
         "메뉴 이름을 알아야 검색이 됩니다. 저는 그 이름을 몰랐습니다."),
        ("③", "챗봇은 “메뉴로 가세요”라고 했습니다",
         "그 메뉴가 어디 있는지가 문제였는데, 위치를 다시 알려줄 뿐이었습니다."),
        ("④", "그래서 상담원과 이야기하고 싶었습니다",
         "사람에게 상황을 설명하면 알아서 정리해 줄 것 같았습니다."),
        ("⑤", "그런데 상담원에게 닿는 길이 가장 멀었습니다",
         "연결하는 방법조차 인터넷을 뒤져 겨우 찾았고, ARS 단계를 지나 대기까지 해야 했습니다."),
    ]
    y = 246
    for num, title, note in steps:
        col = RED if num == "⑤" else YELLOW
        box(d, (100, y, 1820, y + 118), PAPER, RULE, 14)
        d.rounded_rectangle((100, y, 196, y + 118), radius=14, fill=col)
        d.rectangle((182, y, 196, y + 118), fill=col)
        center(d, num, 148, y + 34, f(44, True), PAPER)
        d.text((228, y + 20), title, font=f(30, True), fill=INK)
        d.text((228, y + 66), note, font=f(24), fill=INK_SOFT)
        if num != "⑤":
            d.polygon([(950, y + 120), (974, y + 120), (962, y + 130)], fill=INK_FAINT)
        y += 130

    # 이 두 줄이 이 장의 결론이다. 띠를 짧게 잡았더니 둘째 줄이 밖으로 나가
    # 푸터에 걸려 잘렸다(실측). 아래 여유를 반드시 남긴다.
    band(d, 902, "저는 앱을 못 쓰는 사람이 아닙니다. 무엇을 물어야 할지 몰랐을 뿐입니다.",
         "그리고 그것을 물어볼 사람에게 닿는 길이, 가장 멀었습니다.",
         x0=100, x1=1820, h=104)
    return save(im, "prob-1-me.png")


# ── 5쪽 · 왜 이런 일이 생기나 ───────────────────────────────
def p2_gap():
    im, d = new_slide(
        "왜 이런 일이 생기나 — 도구는 전부 '질문'을 전제합니다",
        "대부분은 '무엇이 필요한지'가 아니라 '무슨 일이 생겼는지'만 압니다. 그래서 사람을 찾게 됩니다.",
        page=PAGE[5], nav_on=0)

    # 왼쪽 — 사용자가 가진 것
    box(d, (100, 240, 830, 570), PAPER_DIM, RULE, 16)
    d.text((136, 258), "고객이 가진 것", font=f(27, True), fill=INK_SOFT)
    have = ["“세금 신고해야 하는데…”", "“돈이 자꾸 새는 것 같은데…”",
            "“해외 나가는데 뭐 준비하지?”"]
    y = 306
    for t in have:
        d.text((136, y), t, font=f(27), fill=INK)
        y += 54
    d.line((136, y + 10, 794, y + 10), fill=RULE, width=2)
    d.text((136, y + 32), "상황은 있는데", font=f(23), fill=INK_SOFT)
    d.text((136, y + 66), "질문이 없습니다", font=f(34, True), fill=RED)

    # 오른쪽 — 도구가 요구하는 것
    box(d, (1090, 240, 1820, 570), PAPER_DIM, RULE, 16)
    d.text((1126, 258), "도구가 요구하는 것", font=f(27, True), fill=INK_SOFT)
    need = [("검색창", "정확한 메뉴 이름"), ("챗봇", "정확한 의도 한 문장"),
            ("ARS", "번호로 분류된 선택지")]
    y = 306
    for name, what in need:
        d.text((1126, y), name, font=f(26, True), fill=INK)
        d.text((1290, y + 3), what, font=f(24), fill=INK_SOFT)
        y += 54
    d.line((1126, y + 10, 1784, y + 10), fill=RULE, width=2)
    d.text((1126, y + 32), "전부", font=f(23), fill=INK_SOFT)
    d.text((1126, y + 66), "질문을 전제합니다", font=f(34, True), fill=INK)

    # 어긋남
    d.line((850, 396, 1070, 396), fill=RED, width=6)
    for x in (900, 1020):
        d.line((x, 364, x - 40, 430), fill=RED, width=6)
    center(d, "어긋남", 960, 442, f(25, True), RED)

    # ── 저만 그런 게 아니라는 증거 ──────────────────────────
    # 조사에서 '고객이 원하는 바를 모른다'는 직접 통계는 검증을 통과하지 못했다.
    # 대신 그것을 겪는 쪽(운영자)과 당한 쪽(이용자)의 수치를 나란히 둔다.
    box(d, (100, 588, 1820, 660), PAPER, YELLOW, 14)
    d.text((132, 604), "73.6%", font=f(30, True), fill=RED)
    d.text((262, 608), "“AI가 나의 요구사항을 이해하지 못한다” — AI 상담 불만족 사유 1위",
           font=f(24, True), fill=INK)
    d.text((262, 640), "정확히 말하지 못하면 못 알아듣습니다. (아시아경제 의뢰·엠브레인 2024.7)",
           font=f(20), fill=INK_SOFT)

    # ── 왜 하필 '상담'인가 ──────────────────────────────────
    # 이걸 적지 않으면 4쪽 ④(상담을 원했다)가 느낌으로만 남는다.
    # 상담원이 실제로 하는 일 셋을 적어야 '상담을 소프트웨어로 만들었다'가 선다.
    d.text((100, 686), "사람 상담원은 이 어긋남을 어떻게 넘나", font=f(29, True), fill=INK)
    acts = [
        ("되묻는다", "“어떤 서류가 필요하신 건가요?”"),
        ("업무로 번역한다", "막연한 상황 → 「연말정산증명서」"),
        ("대신 처리한다", "발급까지 끝내 준다"),
    ]
    x, w, gap = 100, 560, 30
    for i, (name, note) in enumerate(acts):
        bx = x + i * (w + gap)
        box(d, (bx, 730, bx + w, 830), PAPER, YELLOW, 14)
        d.text((bx + 24, 746), f"{i + 1}. {name}", font=f(26, True), fill=INK)
        d.text((bx + 24, 786), note, font=f(22), fill=INK_SOFT)

    # ── "그럼 챗GPT 쓰면 되지 않나" ─────────────────────────
    # 아주경제 인용이 챗GPT를 잘한 쪽으로 세우므로, 답하지 않으면
    # 이 장이 우리 제품이 아니라 챗GPT를 홍보하게 된다.
    box(d, (100, 862, 1820, 1004), MACHINE, YELLOW, 16)
    d.text((136, 878), "“그럼 챗GPT를 쓰면 되지 않나요?”", font=f(26, True), fill=YELLOW_LT)
    d.text((136, 918), "되묻습니다. 그러나 제 계좌를 모르고, 서류를 떼주지 못하고, 이체하지 못합니다.",
           font=f(26, True), fill=PAPER)
    d.text((136, 960), "같은 질문에 은행 챗봇은 「상담 연결」을 권했고, 챗GPT는 신용점수·재직기간을 "
                       "되물어 범위를 냈습니다. (아주경제 2026.7.15)",
           font=f(21), fill=YELLOW_LT)
    return save(im, "prob-2-gap.png")


# ── 6쪽 · 상담이 가장 멀다 ──────────────────────────────────
def p3_counsel():
    im, d = new_slide(
        "상담을 받고 싶어도, 상담이 가장 멉니다",
        "저희 짐작이 아니라, 공표된 조사와 보도로 확인한 것만 적었습니다.",
        page=PAGE[6], nav_on=0)

    # 상담원에 닿기까지
    d.text((100, 246), "고객이 상담원에게 닿기까지", font=f(26, True), fill=INK_SOFT)
    # AI 상담을 ARS 앞에 두었더니 사실과 달랐다 — 실제로는 ARS 안에서 만난다
    # (신한은행: 0번 → AI 상담사 → “상담사 연결” 음성 명령). 한 칸으로 묶는다.
    stages = [("앱에서 찾기", "메뉴 2,656개"), ("챗봇", "“메뉴로 가세요”"),
              ("ARS 안의 AI 상담", "3~4단계를 지나며"), ("상담원", "겨우 도착")]
    x, w, gap = 100, 400, 30
    for i, (name, sub) in enumerate(stages):
        last = i == len(stages) - 1
        box(d, (x, 292, x + w, 420), MACHINE if last else PAPER_DIM,
            YELLOW if last else RULE, 14)
        center(d, name, x + w / 2, 320, f(27, True), PAPER if last else INK)
        center(d, sub, x + w / 2, 362, f(23), YELLOW_LT if last else INK_SOFT)
        if not last:
            d.polygon([(x + w + 4, 344), (x + w + 4, 366), (x + w + 21, 355)], fill=INK_FAINT)
        x += w + gap

    # 수치
    facts = [
        ("21.6% vs 39.4%", "AI 상담 만족 vs 불만족",
         "불만족이 만족의 1.8배 (아시아경제 의뢰·엠브레인 2024.7, 성인 500명)"),
        ("73.6%", "불만족 사유 1위",
         "“AI가 나의 요구사항을 이해하지 못한다”"),
        ("56.9%", "불만족 사유 2위",
         "“인간 상담원 연결 과정이 복잡하고 어려워졌다”"),
        # 지점 감소(-28%)는 '상담에 닿기 어렵다'가 아니라 '오프라인 대안이 사라진다'는
        # 별개 논점이라 7쪽 규모 이야기로 옮겼다. 그 자리에 결이 맞는 수치를 넣는다.
        # '연결까지 약 3분'을 적었다가 뺐다. 대기가 길다는 근거가 아니라
        # "3분이면 짧지 않나"라는 반박 재료가 된다. 문제는 시간이 아니라 경로다.
        ("3~4단계", "상담사에 닿기까지 거치는 ARS 단계",
         "KB국민은행 3단계(ARS 선택 → 민원 항목 → 상담사) · 카드사 최대 4단계 (소비자가만드는신문)"),
    ]
    y = 462
    for big, title, note in facts:
        box(d, (100, y, 1820, y + 104), PAPER, RULE, 14)
        d.rectangle((100, y, 112, y + 104), fill=RED)
        d.text((140, y + 26), big, font=f(34, True), fill=RED)
        d.text((520, y + 18), title, font=f(25, True), fill=INK)
        d.text((520, y + 56), note, font=f(22), fill=INK_SOFT)
        y += 116

    box(d, (100, 930, 1820, 1010), MACHINE, YELLOW, 14)
    d.text((136, 946), "“보이는 ARS나 AI 상담원 도입은 콜센터 직원들의 효율을 높이기 위한 것”",
           font=f(26, True), fill=PAPER)
    d.text((136, 980), "— 업계 관계자 (소비자가만드는신문). 고객을 위한 장치가 아니라고 업계가 말합니다.",
           font=f(21), fill=YELLOW_LT)
    return save(im, "prob-3-counsel.png")


# ── 7쪽 · 저만의 문제가 아니다 ──────────────────────────────
def p4_scale():
    im, d = new_slide(
        "저만의 문제가 아닙니다",
        "앱을 쓰느냐의 문제가 아니라, 절차가 붙은 일을 스스로 끝낼 수 있느냐의 문제입니다.",
        page=PAGE[7], nav_on=0)

    # ① 연령별 절벽 — 조사에서 가장 선명한 그림이다.
    # 20~40대는 70~80%가 모바일을 주로 쓰는데 60대 이상만 18.7%로 떨어진다.
    # 4쪽의 '20대인 저도'와 맞물린다 — 저는 74%에 속하는데도 막혔습니다.
    box(d, (100, 258, 940, 620), PAPER, RULE, 16)
    d.rounded_rectangle((100, 258, 940, 330), radius=16, fill=YELLOW)
    d.rectangle((100, 316, 940, 330), fill=YELLOW)
    d.text((132, 278), "금융서비스를 '주로' 모바일로 보는 비중", font=f(26, True), fill=INK)
    ages = [("20대", 74.0), ("30대", 79.5), ("40대", 70.1), ("50대", 53.2), ("60대+", 18.7)]
    x0, slot = 150, 150
    base, top = 520, 356
    for i, (name, v) in enumerate(ages):
        cx = x0 + slot * i
        h = (base - top) * v / 80
        col = RED if name == "60대+" else YELLOW
        d.rectangle((cx - 44, base - h, cx + 44, base), fill=col)
        center(d, f"{v}", cx, base - h - 32, f(24, True), INK)
        center(d, name, cx, base + 12, f(23), INK)
    d.line((110, base, 930, base), fill=RULE, width=2)
    d.text((132, 556), "60대 이상도 '써본 적'은 53.8% — 주로 쓰는 수단만 18.7%입니다.",
           font=f(22, True), fill=RED)
    d.text((132, 588), "한국은행 2024년 이용행태 조사 (2025.3, n=3,551)", font=f(19), fill=INK_FAINT)

    # ② 절차가 붙으면 무너진다
    box(d, (980, 258, 1820, 620), PAPER, RULE, 16)
    d.rounded_rectangle((980, 258, 1820, 330), radius=16, fill=RED)
    d.rectangle((980, 316, 1820, 330), fill=RED)
    d.text((1012, 278), "65세 이상, 업무별 온라인 처리 비중", font=f(27, True), fill=PAPER)
    bars = [("이체 · 출금", 69.9, YELLOW), ("신용대출", 12.4, RED), ("예금 가입", 7.0, RED)]
    y = 366
    for name, v, col in bars:
        d.text((1012, y), name, font=f(24, True), fill=INK)
        bw = int(600 * v / 80)
        d.rectangle((1012, y + 34, 1012 + bw, y + 62), fill=col)
        d.text((1012 + bw + 16, y + 32), f"{v}%", font=f(26, True), fill=INK)
        y += 76
    d.text((1012, 584), "금융위원회 「고령친화 금융환경 조성방안」 (2020.8)", font=f(20), fill=INK_FAINT)

    # ③ 앱 자체에 대한 불만 — 전 연령
    box(d, (100, 656, 940, 856), PAPER_DIM, RULE, 16)
    d.text((136, 676), "고령층만의 이야기도 아닙니다", font=f(26, True), fill=INK)
    d.text((136, 722), "44%", font=f(48, True), fill=RED)
    para(d, "금융앱 25개의 구글플레이 리뷰 134,560건 중 부정 비율. 부정이 절반을 넘는 앱이 "
            "25개 중 15개. 부정 토픽에 '비직관적 메뉴'가 포함됩니다.",
         300, 720, f(21), 610, INK_SOFT)
    d.text((136, 820), "대한산업공학회지 51(6), 2025.12", font=f(19), fill=INK_FAINT)

    # ④ 오프라인 대안도 줄었다 — 6쪽에서 옮겨 온 논점
    box(d, (980, 656, 1820, 856), PAPER_DIM, RULE, 16)
    d.text((1016, 676), "물어볼 창구 자체가 줄었습니다", font=f(26, True), fill=INK)
    d.text((1016, 722), "-28%", font=f(48, True), fill=RED)
    para(d, "국내은행 지점 7,689개(2013.6) → 5,523개(2025 3분기). 앱에서 못 끝내면 갈 곳이 "
            "있었는데, 그 곳이 사라지는 중입니다.",
         1200, 720, f(21), 590, INK_SOFT)
    d.text((1016, 820), "금융감독원 은행 점포 현황", font=f(19), fill=INK_FAINT)

    # 앞선 판에는 "20~40대도 절차 업무에서는 전화를 겁니다"라고 적었는데,
    # 그 세대에 대한 근거가 우리에게 없다(금융위 자료는 65세 이상 것이다).
    # 데이터가 받쳐 주는 만큼만 말한다.
    band(d, 888, "쓸 줄 몰라서가 아닙니다 — 65세 이상도 이체·출금은 69.9%가 온라인으로 합니다.",
         "절차가 붙은 순간 무너지고, 그때 갈 수 있던 창구는 사라지는 중입니다.",
         x0=100, x1=1820, h=100)
    return save(im, "prob-4-scale.png")


# ── 39 · 문제와 해법을 잇는 다리 ────────────────────────────
# 앞선 판은 문제(4~8쪽)에서 해법(9쪽)으로 그냥 넘어갔다. "왜 사람이 아니라
# AI여야 하는가"에 답이 없으면, 심사는 "상담원을 늘리면 되지 않나"라고 묻는다.
#
# 답의 재료는 이미 6쪽에 있다 — 업계 관계자가 "AI 상담원 도입은 콜센터 직원들의
# 효율을 높이기 위한 것"이라고 말했다. 업계도 이미 사람을 늘리는 대신 AI를 넣고
# 있다는 뜻이다. 다만 그 AI가 불만족 39.4%일 뿐이다.
# 방향은 이미 정해졌고, 물건이 틀렸다 — 그 자리가 우리 자리다.
def p5_bridge():
    im, d = new_slide(
        "그래서 상담을 대체합니다 — 사람을 늘리는 대신",
        "“상담원을 늘리면 되지 않나”에 먼저 답하겠습니다.",
        page=PAGE[39], nav_on=0)

    # 앞선 판은 "사람을 늘리는 선택은 이미 버려졌다"고 단정했다. 그 근거로 든
    # 업계 관계자 발언은 '늘릴 수 없다'가 아니라 '이미 AI를 넣고 있다'는 관찰이다.
    # 증명할 수 없는 강한 말을 고르면 스스로 표적이 된다 — 관찰만 주장한다.
    steps = [
        ("앱에서 끝내지 못한 일은 사람에게 갑니다",
         "앞의 네 장이 보여준 그대로입니다. 그리고 갈 수 있던 창구는 "
         "7,689개(2013.6) → 5,523개(2025 3Q)로 줄었습니다.", INK),
        ("업계는 이미 사람 대신 AI를 넣고 있습니다",
         "“보이는 ARS나 AI 상담원 도입은 콜센터 직원들의 효율을 높이기 위한 것” "
         "— 업계 관계자 (소비자가만드는신문). 방향은 이미 정해졌습니다.", INK),
        ("문제는 그 AI가 상담을 대체하지 못한다는 것입니다",
         "겪어 본 사람의 불만이 만족의 1.8배입니다. 1위 사유는 “AI가 나의 요구사항을 이해하지 못한다”.", RED),
    ]
    y = 238
    for title, note, col in steps:
        box(d, (100, y, 1820, y + 104), PAPER, RULE, 14)
        d.rectangle((100, y, 112, y + 104), fill=YELLOW if col == INK else RED)
        d.text((140, y + 14), title, font=f(27, True), fill=col)
        para(d, note, 140, y + 56, f(21), 1640, INK_SOFT)
        y += 116

    d.text((100, 606), "방향은 이미 정해졌습니다. 틀린 것은 물건입니다.",
           font=f(29, True), fill=INK)

    # 상담원이 하는 일 셋(5쪽) ↔ 지금 챗봇 ↔ 우리
    cols = ["상담원이 하는 일", "지금의 챗봇", "지문까지"]
    rows = [
        ("되묻는다", "사전 학습된 의도만 분류", "ask_clarification — 빠진 것만, 한 번에 하나"),
        ("업무로 번역한다", "“메뉴로 가세요”", "메뉴 2,656개 색인에서 하려는 일로 찾는다"),
        ("대신 처리한다", "실행하지 못한다", "도구 30종 호출 · 지문 확인 뒤 실제 실행"),
    ]
    widths = [420, 560, 740]
    x0, y = 100, 656
    head_h, row_h = 54, 70
    table_top = y
    d.rounded_rectangle((x0, y, x0 + sum(widths), y + head_h), radius=10, fill=MACHINE)
    d.rectangle((x0, y + head_h - 10, x0 + sum(widths), y + head_h), fill=MACHINE)
    cx = x0
    for i, c in enumerate(cols):
        d.text((cx + 24, y + 14), c, font=f(22, True),
               fill=YELLOW_LT if i == 2 else PAPER)
        cx += widths[i]
    y += head_h
    for r, row in enumerate(rows):
        d.rectangle((x0, y, x0 + sum(widths), y + row_h),
                    fill=PAPER if r % 2 == 0 else PAPER_DIM)
        d.line((x0, y, x0 + sum(widths), y), fill=RULE, width=1)
        cx = x0
        for i, cell in enumerate(row):
            col = INK if i == 0 else (RED if i == 1 else INK)
            d.text((cx + 24, y + 22), cell, font=f(21, i != 1), fill=col)
            cx += widths[i]
        y += row_h
    d.rectangle((x0, table_top, x0 + sum(widths), y), outline=RULE, width=2)
    cx = x0
    for w_ in widths[:-1]:
        cx += w_
        d.line((cx, table_top, cx, y), fill=RULE, width=1)

    # "상담을 할 줄 아는 것"이라고 쓰면 분쟁·이의제기·상품 협의까지 약속하게 된다.
    # 이 제품이 하는 일은 '절차가 붙은 실행 업무'다. 범위를 말로 좁혀 둔다.
    band(d, 946, "절차가 붙은 일은, 상담까지 가지 않고 끝나게 만들어야 합니다.",
         x0=100, x1=1820, h=56)
    return save(im, "prob-5-bridge.png")


def main():
    print("문제 정의 다시 쓰기:")
    p1_me()
    p5_bridge()
    p2_gap()
    p3_counsel()
    p4_scale()


if __name__ == "__main__":
    main()
