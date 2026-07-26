# 기술설명서에 넣을 그림을 만든다.
#
# PPT 도형으로 그리면 글자 길이에 따라 레이아웃이 깨진다(실측: 텍스트만 갈아끼웠더니
# 여러 장이 넘쳤다). 그림으로 만들어 넣으면 어디서 열어도 같은 모양이 나온다.
#
# 실행: python scripts/make-figures.py
import os

from PIL import Image, ImageDraw, ImageFont

OUT = r"C:\Users\hsh\Desktop\공모전\figures"
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_B = r"C:\Windows\Fonts\malgunbd.ttf"

# KB 색 — 웹 프로토타입과 같은 값을 쓴다(css/style.css).
YELLOW = "#FFBC00"
YELLOW_DEEP = "#F0A500"
INK = "#191512"
INK_SOFT = "#5C534A"
INK_FAINT = "#A89D8F"
PAPER = "#FFFDF8"
PAPER_DIM = "#F7F3EC"
RULE = "#E3DBCD"
MACHINE = "#12100E"
RED = "#C05A48"


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def new(w, h, bg=PAPER):
    im = Image.new("RGB", (w, h), bg)
    return im, ImageDraw.Draw(im)


def box(d, xy, fill=PAPER, outline=RULE, r=14, width=2):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def center(d, text, cx, y, font, fill=INK):
    w = d.textlength(text, font=font)
    d.text((cx - w / 2, y), text, font=font, fill=fill)


# ── ① 검색·챗봇은 '질문'을 전제한다 ─────────────────────────
# 문서 전체에서 가장 설명이 필요한 통찰이다. 도구가 요구하는 입력과
# 사용자가 가진 것이 어긋나 있다는 걸 한 장으로 보인다.
def fig_question_gap():
    W, H = 1600, 760
    im, d = new(W, H)

    center(d, "도구가 요구하는 것과, 사용자가 가진 것", W / 2, 40, f(40, True))
    center(d, "도움이 절실한 사람일수록 '정확한 질문'을 만들지 못한다", W / 2, 96, f(26), INK_SOFT)

    # 왼쪽 — 사용자가 가진 것
    box(d, (70, 170, 720, 660), PAPER_DIM, RULE, 18)
    d.text((110, 205), "사용자가 가진 것", font=f(28, True), fill=INK_SOFT)
    lines = [
        "\u201c세금 신고해야 하는데…\u201d",
        "\u201c돈이 자꾸 새는 것 같은데…\u201d",
        "\u201c해외 나가는데 뭐 준비하지?\u201d",
    ]
    y = 275
    for t in lines:
        d.text((110, y), t, font=f(30), fill=INK)
        y += 62
    d.line((110, y + 12, 680, y + 12), fill=RULE, width=2)
    d.text((110, y + 40), "상황은 있는데", font=f(26), fill=INK_SOFT)
    d.text((110, y + 82), "질문이 없다", font=f(38, True), fill=RED)

    # 오른쪽 — 도구가 요구하는 것
    box(d, (880, 170, 1530, 660), PAPER_DIM, RULE, 18)
    d.text((920, 205), "도구가 요구하는 것", font=f(28, True), fill=INK_SOFT)
    tools = [
        ("검색창", "정확한 메뉴 이름"),
        ("챗봇", "정확한 의도 한 문장"),
        ("ARS", "번호로 분류된 선택지"),
    ]
    y = 275
    for name, need in tools:
        d.text((920, y), name, font=f(28, True), fill=INK)
        d.text((1060, y + 4), need, font=f(26), fill=INK_SOFT)
        y += 62
    d.line((920, y + 12, 1490, y + 12), fill=RULE, width=2)
    d.text((920, y + 40), "전부", font=f(26), fill=INK_SOFT)
    d.text((920, y + 82), "질문을 전제한다", font=f(38, True), fill=INK)

    # 가운데 어긋남
    cx = 800
    d.line((730, 415, 870, 415), fill=RED, width=6)
    for x in (760, 840):
        d.line((x, 385, x - 30, 445), fill=RED, width=6)
    center(d, "어긋남", cx, 460, f(26, True), RED)

    im.save(os.path.join(OUT, "fig-question-gap.png"))
    print("  fig-question-gap.png")


# ── ② 상담이 가장 멀다 (숨김 구조) ──────────────────────────
def fig_hidden_counsel():
    W, H = 1600, 720
    im, d = new(W, H)
    center(d, "상담을 원하는데, 상담이 가장 멀다", W / 2, 40, f(40, True))
    center(d, "고객이 상담원에게 닿기까지 — 그 길은 점점 길어지고 있다", W / 2, 96, f(26), INK_SOFT)

    steps = [
        ("앱에서 찾기", "메뉴 2,656개"),
        ("챗봇", "\u201c메뉴로 가세요\u201d"),
        ("ARS 진입", "4단계 통과"),
        ("대기", "10~20분"),
        ("상담원", "인력 -6.7%"),
    ]
    x = 80
    w = 270
    gap = 30
    for i, (name, sub) in enumerate(steps):
        last = i == len(steps) - 1
        fill = MACHINE if last else PAPER_DIM
        tc = PAPER if last else INK
        sc = YELLOW if last else INK_SOFT
        box(d, (x, 190, x + w, 400), fill, YELLOW if last else RULE, 16)
        center(d, name, x + w / 2, 240, f(30, True), tc)
        center(d, sub, x + w / 2, 300, f(26), sc)
        if not last:
            d.polygon([(x + w + 6, 285), (x + w + 6, 305), (x + w + gap - 6, 295)], fill=INK_FAINT)
        x += w + gap

    d.text((80, 460), "단계마다 사람은 줄어든다", font=f(30, True), fill=INK)
    facts = [
        "· 상담원 연결 항목에 닿기까지 ARS 4단계",
        "· 연결까지 평균 10~20분 대기",
        "· 5대 시중은행 콜센터 인력 4,473 → 4,172명 (-6.7%, 2025 상반기)",
        "· 챗봇을 먼저 거치도록 배치 — \u201c준비된 답변이 없으면 찾을 수 없다고 답한다\u201d",
    ]
    y = 512
    for t in facts:
        d.text((80, y), t, font=f(26), fill=INK_SOFT)
        y += 44

    im.save(os.path.join(OUT, "fig-hidden-counsel.png"))
    print("  fig-hidden-counsel.png")


# ── ③ 증거는 리뷰가 아니라 콜센터에 ─────────────────────────
def fig_review_evidence():
    W, H = 1600, 720
    im, d = new(W, H)
    center(d, "증거는 앱 리뷰가 아니라 콜센터에 있다", W / 2, 40, f(40, True))
    center(d, "KB스타뱅킹 저평점 리뷰 88건 분류 (400건 스캔)", W / 2, 96, f(26), INK_SOFT)

    data = [("인증·로그인", 51, RED), ("속도·오류", 9, INK_FAINT),
            ("메뉴·탐색", 6, YELLOW_DEEP), ("UI·디자인", 4, RULE), ("기타", 18, "#D8D0C2")]
    total = sum(v for _, v, _ in data)

    # 가로 누적 막대
    x0, y0, bw, bh = 90, 200, 1420, 90
    x = x0
    for name, v, col in data:
        w = bw * v / total
        d.rectangle((x, y0, x + w, y0 + bh), fill=col)
        if w > 120:
            center(d, f"{v}건", x + w / 2, y0 + 28, f(28, True), PAPER if col in (RED,) else INK)
        x += w
    d.rectangle((x0, y0, x0 + bw, y0 + bh), outline=RULE, width=2)

    # 범례
    x = x0
    for name, v, col in data:
        d.rectangle((x, y0 + bh + 24, x + 22, y0 + bh + 46), fill=col, outline=RULE)
        d.text((x + 32, y0 + bh + 22), f"{name} {round(v/total*100)}%", font=f(24), fill=INK_SOFT)
        x += 290

    box(d, (90, 400, 1510, 660), PAPER_DIM, YELLOW, 18)
    d.text((130, 432), "메뉴를 못 찾는다는 불만은 88건 중 6건 (7%) 뿐이다", font=f(32, True), fill=INK)
    for i, t in enumerate([
        "앱 리뷰는 화가 난 사람이 쓴다. 인증이 실패하면 화가 난다.",
        "그런데 메뉴를 못 찾으면 화가 나기보다 포기하고 전화를 건다.",
        "→ 그래서 이 문제의 증거는 리뷰가 아니라 콜센터에 있다. (지식iN \u201c상담원 연결\u201d 3,695건+)",
    ]):
        d.text((130, 488 + i * 48), t, font=f(27), fill=INK_SOFT if i < 2 else INK)

    im.save(os.path.join(OUT, "fig-review-evidence.png"))
    print("  fig-review-evidence.png")


# ── ④ 3계층 라우팅 ──────────────────────────────────────────
def fig_layers():
    W, H = 1600, 780
    im, d = new(W, H)
    center(d, "3계층 라우팅 — 할 수 있는 만큼만, 그러나 반드시 답한다", W / 2, 40, f(40, True))
    center(d, "못 하는 일이 있어도 대화가 끊기지 않는다", W / 2, 96, f(26), INK_SOFT)

    rows = [
        ("L1", "라우팅", "어디 있는지 답하고 그 화면을 여는 버튼까지 준다",
         "LLM이 죽어도 동작", INK_FAINT),
        ("L2", "조회", "3사 데이터를 조합해 바로 답한다 · 도구 19종",
         "부수효과 없음 — 인증 불필요", YELLOW_DEEP),
        ("L3", "실행", "부수효과를 경고하고 '계획'만 만든다 · 도구 10종",
         "AuthGate 통과 없이는 호출 불가", MACHINE),
    ]
    y = 180
    for tag, name, what, guard, col in rows:
        box(d, (80, y, 1520, y + 165), PAPER_DIM, RULE, 16)
        d.rounded_rectangle((104, y + 26, 260, y + 139), radius=12, fill=col)
        center(d, tag, 182, y + 46, f(44, True), PAPER)
        center(d, name, 182, y + 100, f(24), PAPER)
        d.text((300, y + 38), what, font=f(30), fill=INK)
        d.text((300, y + 90), guard, font=f(25), fill=INK_SOFT)
        y += 190

    box(d, (80, 730, 1520, 730), PAPER, PAPER, 0, 0)
    d.text((80, 712), "되묻기는 별도 도구다 — 문장 끝의 '?'로 추측하지 않고 구조로 드러내, 감사 로그에 남고 테스트할 수 있다.",
           font=f(25), fill=INK_SOFT)

    im.save(os.path.join(OUT, "fig-layers.png"))
    print("  fig-layers.png")


# ── ⑤ 검색 파이프라인 ───────────────────────────────────────
def fig_search():
    W, H = 1600, 740
    im, d = new(W, H)
    center(d, "메뉴 2,656개를 찾는 법 — LLM 호출 0회", W / 2, 36, f(40, True))
    center(d, "고객의 말과 메뉴 이름은 겹치지 않는다. \u201c돈이 새는 것 같은데\u201d에 '자동이체'는 없다.",
           W / 2, 92, f(25), INK_SOFT)

    steps = [
        ("① 발화 생성", "메뉴당 8개", "21,052개"),
        ("② 생활사건", "손으로 추가", "58개"),
        ("③ 임베딩", "256차원", "2,714 벡터"),
        ("④ int8 양자화", "8비트 압축", "앱 탑재 가능"),
        ("⑤ 하이브리드", "벡터 0.9 + 키워드 0.1", "후보 5건"),
    ]
    x, w, gap = 60, 280, 15
    for i, (a, b, c) in enumerate(steps):
        box(d, (x, 175, x + w, 375), PAPER_DIM, RULE, 16)
        center(d, a, x + w / 2, 200, f(27, True), INK)
        center(d, b, x + w / 2, 252, f(23), INK_SOFT)
        center(d, c, x + w / 2, 305, f(28, True), YELLOW_DEEP)
        if i < len(steps) - 1:
            d.polygon([(x + w + 2, 265), (x + w + 2, 285), (x + w + gap - 1, 275)], fill=INK_FAINT)
        x += w + gap

    box(d, (60, 420, 1540, 700), PAPER_DIM, YELLOW, 18)
    d.text((100, 450), "왜 생활사건 계층을 따로 뒀나", font=f(30, True), fill=INK)
    for i, t in enumerate([
        "생성 발화 21,052개는 전부 '금융 용어를 이미 아는 사람'의 말투였다.",
        "실측: \u201c해외 나가는데 뭐 준비해야 돼?\u201d → 「해외IP차단 서비스」로 갔다.",
        "메뉴당 벡터 하나로 뭉치면 평균이 흐려진다 → 생활사건 발화에 자기 벡터를 따로 줬다.",
        "→ 재측정 8/8 정확. \u201c해외 나간다\u201d가 「환전신청」으로 간다.",
    ]):
        d.text((100, 500 + i * 46), t, font=f(26), fill=INK if i == 3 else INK_SOFT)

    im.save(os.path.join(OUT, "fig-search.png"))
    print("  fig-search.png")


# ── ⑥ LLM 경계 ─────────────────────────────────────────────
def fig_boundary():
    W, H = 1600, 760
    im, d = new(W, H)
    center(d, "LLM 경계 — 무엇이 나가고, 무엇이 나가지 않는가", W / 2, 36, f(40, True))
    center(d, "\u201c공개 API에 고객정보를?\u201d 라는 질문에 정책이 아니라 구조로 답한다", W / 2, 92, f(25), INK_SOFT)

    # 기기 안
    box(d, (60, 165, 780, 690), PAPER_DIM, RULE, 18)
    d.text((100, 195), "기기 / 은행 내부에 머무는 것", font=f(30, True), fill=INK)
    inside = ["잔액 · 계좌번호 · 예금주", "카드번호 · 거래내역",
              "도구 실행 결과 (화면으로만)", "결과 설명 문장 (규칙 기반 생성)",
              "메뉴 검색 (임베딩 · 기기 안)"]
    for i, t in enumerate(inside):
        d.ellipse((104, 258 + i * 62, 122, 276 + i * 62), fill=MACHINE)
        d.text((140, 250 + i * 62), t, font=f(28), fill=INK)

    # LLM 으로
    box(d, (820, 165, 1540, 690), MACHINE, YELLOW, 18)
    d.text((860, 195), "LLM 으로 나가는 것", font=f(30, True), fill=YELLOW)
    outside = ["고객의 말 (패턴 마스킹 후)", "후보 메뉴 이름 (공개 정보)",
               "도구 목록 (함수 이름 · 인자 형식)"]
    for i, t in enumerate(outside):
        d.ellipse((864, 258 + i * 62, 882, 276 + i * 62), fill=YELLOW)
        d.text((900, 250 + i * 62), t, font=f(28), fill=PAPER)
    d.line((860, 470, 1500, 470), fill="#3A332B", width=2)
    for i, t in enumerate([
        "허용 필드가 아니면 네트워크 전에 예외를 던진다",
        "(assertNoPII) — 정책이 아니라 코드로 강제",
        "이력의 도구 결과는 \u201c실행됨. 수치는 비공개\u201d 뿐",
    ]):
        d.text((860, 500 + i * 44), t, font=f(24), fill="#B9AE9D")

    im.save(os.path.join(OUT, "fig-boundary.png"))
    print("  fig-boundary.png")


# ── ⑦ 실측 성능 ────────────────────────────────────────────
def fig_metrics():
    W, H = 1600, 700
    im, d = new(W, H)
    center(d, "실측 성능 — 대본이 아님을 어떻게 확인했나", W / 2, 36, f(40, True))
    center(d, "가상 데이터 기반 프로토타입 · 실제 고객정보 미사용", W / 2, 92, f(25), INK_SOFT)

    bars = [
        ("메뉴 검색\nTop-3 관련도", 95.6, "독립 LLM 심판 160건"),
        ("도구 선택\n정확도", 90.0, "40건 · 최난이도 L4 10/10"),
        ("회귀 테스트\n통과율", 100.0, "245개 전부"),
    ]
    x0, base, bw, gap = 180, 560, 260, 200
    for i, (name, v, sub) in enumerate(bars):
        x = x0 + i * (bw + gap)
        h = int((base - 220) * v / 100)
        d.rectangle((x, base - h, x + bw, base), fill=YELLOW)
        d.rectangle((x, base - h, x + bw, base), outline=YELLOW_DEEP, width=3)
        center(d, f"{v:.1f}%".replace(".0%", "%"), x + bw / 2, base - h - 58, f(46, True), INK)
        for j, ln in enumerate(name.split("\n")):
            center(d, ln, x + bw / 2, base + 20 + j * 36, f(28, True), INK)
        center(d, sub, x + bw / 2, base + 96, f(23), INK_SOFT)
    d.line((120, base, 1480, base), fill=INK_FAINT, width=3)

    d.text((120, 640), "숫자를 좋게 만들려고 지표를 바꾸지 않았다 — 처음 잰 메뉴 커버리지 22.8%는 '한 발화에 정답이 여럿'이라는 측정 설계 결함이었고, 두 수치를 모두 남긴다.",
           font=f(23), fill=INK_SOFT)

    im.save(os.path.join(OUT, "fig-metrics.png"))
    print("  fig-metrics.png")


# ── ⑧ KB 적용 아키텍처 ──────────────────────────────────────
def fig_apply():
    W, H = 1600, 780
    im, d = new(W, H)
    center(d, "KB 적용 — 바꾸는 것은 도구 함수의 '본문'뿐", W / 2, 36, f(40, True))
    center(d, "새 앱을 만들지 않는다. KB스타뱅킹 안의 메뉴 하나로 들어간다.", W / 2, 92, f(25), INK_SOFT)

    # 그대로 쓰는 층
    box(d, (60, 165, 1540, 400), PAPER_DIM, RULE, 18)
    d.text((100, 190), "그대로 들어가는 것 — 프로토타입 코드", font=f(28, True), fill=INK_SOFT)
    keep = ["메뉴 색인 2,714 벡터", "3계층 라우팅", "되묻기 · 대화 이력",
            "영향 분석 · 안전장치", "화면 (웹뷰)"]
    x = 100
    for t in keep:
        w = int(d.textlength(t, font=f(25))) + 50
        d.rounded_rectangle((x, 250, x + w, 330), radius=12, fill=PAPER, outline=YELLOW, width=2)
        center(d, t, x + w / 2, 275, f(25), INK)
        x += w + 20

    # 바꾸는 층
    box(d, (60, 430, 1540, 700), MACHINE, YELLOW, 18)
    d.text((100, 456), "바꾸는 것 — 도구 함수 30개의 본문", font=f(28, True), fill=YELLOW)
    d.text((100, 520), "지금 (프로토타입)", font=f(24), fill="#9C927F")
    d.text((100, 562), "return { items: KB_DATA.bank.accounts }", font=f(26), fill=PAPER)
    d.polygon([(760, 552), (760, 578), (800, 565)], fill=YELLOW)
    d.text((830, 520), "실제 (KB 적용)", font=f(24), fill="#9C927F")
    d.text((830, 562), "return await kbCore.getAccounts(userId)", font=f(26), fill=YELLOW)
    d.text((100, 630), "함수 이름 · 인자 · 반환 형식은 그대로다. 라우팅 · 되묻기 · 안전장치 · 화면은 손대지 않는다.",
           font=f(25), fill="#B9AE9D")

    im.save(os.path.join(OUT, "fig-apply.png"))
    print("  fig-apply.png")


def main():
    os.makedirs(OUT, exist_ok=True)
    print("그림 생성:")
    fig_question_gap()
    fig_hidden_counsel()
    fig_review_evidence()
    fig_layers()
    fig_search()
    fig_boundary()
    fig_metrics()
    fig_apply()
    print(f"→ {OUT}")


if __name__ == "__main__":
    main()
