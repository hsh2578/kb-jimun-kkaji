# 원본 도형으로는 못 담는 장을 슬라이드 그림으로 그린다.
#
# 12·13·15·19·22쪽은 세로 라벨 칸·표·다단 카드가 있어 텍스트 치환으로는
# 매번 깨졌다(내용이 엉뚱한 칸에 들어가거나, 글자가 칸을 넘쳐 겹치거나,
# 좁은 칸에서 한 글자씩 쌓임). 그 장들만 여기서 직접 그려 overlay-figure.py 로
# 덮는다. 내용은 build-kb-deck.py 의 원문을 옮긴 것이다.
#
# 실행: python scripts/make-slide-figures.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _order():
    """쪽번호를 build-kb-deck.py 의 ORDER 에서 가져온다.

    그림 안에 번호를 그려 넣으므로, 순서를 바꿀 때 여기만 손대지 않으면
    본문 쪽번호와 그림 쪽번호가 어긋난다. 한 곳에서만 정하도록 불러 쓴다.
    """
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _order()

from slide_kit import (INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       card, center, f, new_slide, para, right, save, wrap)


# ── 12쪽 · 메뉴 2,656개를 찾는 법 ───────────────────────────
def slide12():
    im, d = new_slide(
        "핵심 알고리즘 ② — 메뉴 2,656개를 찾는 법",
        "고객의 말과 메뉴 이름은 겹치지 않습니다. “돈이 자꾸 새는 것 같은데”에 '자동이체'라는 단어는 없습니다.",
        page=PAGE[12], nav_on=2)

    steps = [
        ("①", "발화 생성", "메뉴 하나당 8개씩 총 21,052개의\n'고객이 할 법한 말'을 만들어 색인"),
        ("②", "생활사건 계층", "“해외 나간다” “애 낳았다” 같은\n생활 사건 58개를 손으로 추가"),
        ("③", "하이브리드 검색", "벡터 0.9 + 키워드 0.1\n뜻으로 찾되 정확한 이름도 놓치지 않음"),
        ("④", "int8 양자화", "256차원 벡터를 8비트로 압축 —\n앱에 실을 수 있는 크기로"),
    ]
    x0, w, gap = 100, 400, 40
    for i, (num, name, body) in enumerate(steps):
        x = x0 + i * (w + gap)
        box(d, (x, 268, x + w, 560), PAPER, RULE, 14)
        d.rounded_rectangle((x, 268, x + w, 336), radius=14, fill=YELLOW)
        d.rectangle((x, 322, x + w, 336), fill=YELLOW)
        d.text((x + 22, 285), f"{num}  {name}", font=f(28, True), fill=PAPER)
        y = 362
        for line in body.split("\n"):
            y = para(d, line, x + 22, y, f(24), w - 44, INK_SOFT)
        if i < 3:
            d.polygon([(x + w + 8, 405), (x + w + 8, 429), (x + w + 30, 417)], fill=INK_FAINT)

    # 실패에서 배운 것 — 이 장의 진짜 내용이다.
    box(d, (100, 600, 1180, 812), PAPER_DIM, RULE, 14)
    d.text((132, 622), "왜 ②가 따로 필요했나", font=f(28, True), fill=INK)
    y = para(d, "생성한 발화 21,052개는 전부 '금융 용어를 이미 아는 사람'의 말투였습니다. "
                "메뉴당 벡터 하나로 발화를 뭉치면 평균이 흐려져 “해외 나가는데”가 "
                "「해외IP차단」으로 갔습니다.",
             132, 666, f(25), 1010, INK_SOFT)
    d.text((132, y + 10), "→ 생활사건 발화에 자기 벡터를 따로 줬습니다. 재측정 8/8 정확.",
           font=f(26, True), fill=RED)

    box(d, (1220, 600, 1820, 812), MACHINE, YELLOW, 14)
    d.text((1252, 624), "실측", font=f(26, True), fill=YELLOW_LT)
    d.text((1252, 672), "95.6%", font=f(64, True), fill=PAPER)
    para(d, "메뉴 검색 Top-3 관련도 · 독립 LLM 심판 160건",
         1252, 754, f(22), 540, YELLOW_LT)

    band(d, 852, "고객은 메뉴 이름을 모릅니다. 그래서 이름이 아니라 '하려는 일'로 찾게 했습니다.",
         "벡터 2,714개 = 메뉴 2,656 + 생활사건 58. 색인은 기기 안에 있고 LLM을 부르지 않습니다.")
    return save(im, "slide-12-search.png")


# ── 13쪽 · 안전장치 3중 ─────────────────────────────────────
def slide13():
    im, d = new_slide(
        "핵심 알고리즘 ③ — 안전장치 3중",
        "실행 사고보다 위험한 건 잘못 알아듣고 그럴듯하게 준비하는 일입니다. 여기에 답하겠습니다.",
        page=PAGE[13], nav_on=2)

    cards = [
        ("① AuthGate — 증명 없이는 토큰이 없다", [
            "검증기를 주입하지 않으면 모든 실행을 거부합니다(fail-closed).",
            ("토큰은 계획 하나에만 묶이고, 한 번 쓰면 소멸합니다.", INK),
            ("→ 계획 A의 인증으로 계획 B를 실행할 수 없습니다.", RED),
            ("이미 실행된 계획은 다시 실행되지 않습니다.", INK_SOFT),
        ]),
        ("② 실행 직전에 무엇을 하는지 보여준다", [
            "받는 분·계좌·금액·출금계좌를 항목별 카드로 보여주고,",
            ("부수효과(자동이체가 끊기는 등)를 먼저 말한 뒤에만 인증으로 넘어갑니다.", INK),
            ("→ 모르고 승인하는 상황을 막습니다.", RED),
        ]),
        ("③ 모르면 멈춘다", [
            "수취인·금액·잔액·대상 중 하나라도 확인되지 않으면",
            ("계획 자체를 만들지 않습니다.", INK),
            ("→ 잔액을 넘는 이체나 대상이 아닌 지원금 신청은", RED),
            ("지문 버튼조차 뜨지 않습니다.", RED),
        ]),
    ]
    x0, w, gap = 100, 560, 30
    for i, (title, lines) in enumerate(cards):
        x = x0 + i * (w + gap)
        card(d, (x, 268, x + w, 700), title, lines)

    box(d, (100, 736, 1820, 862), PAPER_DIM, RED, 14)
    d.text((132, 756), "실측 — 막히는 것을 직접 확인했습니다", font=f(26, True), fill=INK)
    d.text((132, 800), "“아들한테 1억 보내줘”  →  “잔액이 부족합니다. 진행하지 않습니다” (계획 미생성)",
           font=f(27), fill=RED)

    band(d, 894, "“잘못 실행”보다 “그럴듯한 오안내”를 먼저 막습니다.",
         "안전장치는 전부 테스트로 고정돼 있습니다 — 245개 회귀 테스트 전부 통과.")
    return save(im, "slide-13-safety.png")


# ── 15쪽 · 어떤 LLM을 쓸 것인가 ─────────────────────────────
def slide15():
    im, d = new_slide(
        "어떤 LLM을 쓸 것인가 — 3단 구성",
        "모델을 새로 만들지 않습니다. 경계를 그어놨으므로 업무 성격에 따라 가장 적합한 모델을 고르면 됩니다.",
        page=PAGE[15], nav_on=2)

    tiers = [
        ("① 라우팅 — 모델 없이", "임베딩 + 키워드",
         "메뉴 2,656개 검색은 LLM 없이 기기 안에서 끝납니다.\n호출 비용도 지연도 없습니다.", YELLOW_PALE, INK),
        ("② 도구 선택 — 경량 모델", "gpt-4o-mini 급 / KB 자체 모델",
         "대화마다 어떤 기능을 부를지 고르는 일만 맡깁니다.\n실측 정확도 90.0%.", YELLOW_LT, INK),
        ("③ 설명·요약 — 기기 안", "규칙 기반 문장 생성",
         "금액이 든 문장은 LLM을 거치지 않습니다.\n숫자가 밖으로 나가지 않는 이유입니다.", MACHINE, PAPER),
    ]
    x0, w, gap = 100, 560, 30
    for i, (title, sub, body, fill, tc) in enumerate(tiers):
        x = x0 + i * (w + gap)
        box(d, (x, 262, x + w, 520), PAPER, RULE, 14)
        d.rounded_rectangle((x, 262, x + w, 356), radius=14, fill=fill)
        d.rectangle((x, 342, x + w, 356), fill=fill)
        d.text((x + 22, 280), title, font=f(25, True), fill=tc)
        d.text((x + 22, 314), sub, font=f(26, True), fill=tc)
        y = 382
        for line in body.split("\n"):
            y = para(d, line, x + 22, y, f(24), w - 44, INK_SOFT)

    d.text((100, 556), "실제 KB 적용 시 모델 선택 — 순서대로 검토합니다", font=f(30, True), fill=INK)
    picks = [
        ("1순위", "KB 자체 GenAI 플랫폼 (폐쇄망)", "이미 구축된 자산을 씁니다.", YELLOW),
        ("2순위", "금융 특화 sLLM 온프레미스", "GPU 비용을 통제하면서 폐쇄망을 유지합니다.", YELLOW_LT),
        ("3순위", "외부 API (Azure OpenAI 등 데이터 미학습 계약)",
         "위 경계 덕분에 개인정보가 나가지 않으므로 선택지로 남습니다. 프로토타입이 이 경로입니다.", RULE),
    ]
    y = 606
    for tag, name, note, col in picks:
        box(d, (100, y, 1820, y + 84), PAPER, RULE, 12)
        d.rectangle((100, y, 112, y + 84), fill=col)
        d.text((140, y + 14), tag, font=f(25, True), fill=INK_SOFT)
        d.text((248, y + 12), name, font=f(27, True), fill=INK)
        d.text((248, y + 48), note, font=f(23), fill=INK_SOFT)
        y += 96

    band(d, 906, "핵심은 '어떤 모델이냐'가 아니라 '무엇을 보내느냐'입니다.",
         "경계를 코드로 그었으므로 폐쇄망이든 외부 API든 같은 코드가 돕니다.")
    return save(im, "slide-15-llm.png")


# ── 19쪽 · KB만의 문제 ──────────────────────────────────────
def slide19():
    im, d = new_slide(
        "KB만의 문제 — 같은 일인데 이름이 셋입니다",
        "3사 메뉴 2,656개를 실제로 수집해 확인했습니다. 같은 목적의 서류가 계열사마다 다른 이름으로 존재합니다.",
        page=PAGE[19], nav_on=0)

    cols = ["고객이 하려는 일", "KB국민은행 (633)", "KB국민카드 (1,219)", "KB증권 (804)"]
    rows = [
        ("세금 신고 서류가 필요하다", "연말정산증명서\n이자납입증명서", "신용카드소득공제\n이용명세서", "금융소득증명서\n거래내역조회"),
        ("잔액을 증명하고 싶다", "예금잔액증명서", "—", "잔고증명서"),
        ("쓴 내역을 파일로 받고 싶다", "거래내역조회", "이용명세서", "거래내역조회"),
        ("연금이 어디 있는지 모르겠다", "IRP · 연금자산현황", "—", "퇴직연금 · My연금"),
        ("혜택을 얼마나 받았나", "—", "나의카드할인한도조회", "—"),
    ]

    x0, x1 = 100, 1820
    widths = [430, 430, 430, 430]
    head_h, row_h = 74, 96
    y = 262

    # 머리글
    d.rounded_rectangle((x0, y, x1, y + head_h), radius=10, fill=MACHINE)
    d.rectangle((x0, y + head_h - 10, x1, y + head_h), fill=MACHINE)
    cx = x0
    for i, c in enumerate(cols):
        center(d, c, cx + widths[i] / 2, y + 22, f(25, True), PAPER)
        cx += widths[i]
    y += head_h

    for r, row in enumerate(rows):
        bg = PAPER if r % 2 == 0 else PAPER_DIM
        d.rectangle((x0, y, x1, y + row_h), fill=bg)
        d.line((x0, y, x1, y), fill=RULE, width=1)
        cx = x0
        for i, cell in enumerate(row):
            lines = cell.split("\n")
            col = INK if i == 0 else (INK_FAINT if cell == "—" else YELLOW)
            fnt = f(24, i == 0) if i == 0 else f(24, True)
            top = y + (row_h - len(lines) * 32) / 2
            for j, ln in enumerate(lines):
                center(d, ln, cx + widths[i] / 2, top + j * 32, fnt, col)
            cx += widths[i]
        y += row_h
    d.rectangle((x0, 262, x1, y), outline=RULE, width=2)

    cx = x0
    for w_ in widths[:-1]:
        cx += w_
        d.line((cx, 262, cx, y), fill=RULE, width=1)

    band(d, y + 34, "고객은 'KB' 하나로 생각하지만, 앱도 이름도 셋입니다.",
         "은행 챗봇은 은행만 압니다. “잔액증명서 떼줘”에 답하려면 어느 계열사인지 고객이 먼저 알아야 합니다.")
    d.text((100, y + 156),
           "→ 저희는 3사 메뉴를 한 색인에 넣었습니다. 고객은 계열사를 고르지 않습니다.",
           font=f(28, True), fill=RED)
    return save(im, "slide-19-kb.png")


# ── 22쪽 · KB 적용 경로와 일정 ──────────────────────────────
def slide22():
    im, d = new_slide(
        "실제 KB 적용 경로와 일정",
        "새 앱을 만들지 않습니다. KB스타뱅킹 안의 메뉴 하나로 들어갑니다.",
        page=PAGE[22], nav_on=3)

    steps = [
        ("1단계", "웹뷰 삽입", "KB스타뱅킹 메뉴에 웹뷰 한 장 추가.\n프로토타입 코드가 그대로 들어갑니다."),
        ("2단계", "네이티브 브릿지", "지문 인증은 앱의 생체인증 모듈을 호출.\n프로토타입의 WebAuthn 자리가 그대로 대체됩니다."),
        ("3단계", "코어 API 연결", "도구 함수 30개의 본문만 KB 내부 API 호출로.\n함수 이름·인자·반환 형식은 그대로입니다."),
        ("4단계", "딥링크", "「열기」 버튼이 KB스타뱅킹 내부 메뉴를 엽니다.\n프로토타입에 주소 형식까지 구현했습니다."),
    ]
    x0, w, gap = 100, 400, 40
    for i, (tag, name, body) in enumerate(steps):
        x = x0 + i * (w + gap)
        box(d, (x, 262, x + w, 512), PAPER, RULE, 14)
        d.rounded_rectangle((x, 262, x + w, 336), radius=14, fill=MACHINE)
        d.rectangle((x, 322, x + w, 336), fill=MACHINE)
        d.text((x + 22, 276), tag, font=f(22, True), fill=YELLOW_LT)
        d.text((x + 108, 276), name, font=f(27, True), fill=PAPER)
        y = 358
        for line in body.split("\n"):
            y = para(d, line, x + 22, y, f(23), w - 44, INK_SOFT)
        if i < 3:
            d.polygon([(x + w + 8, 375), (x + w + 8, 399), (x + w + 30, 387)], fill=INK_FAINT)

    # 일정 — 막대로 보여야 '계획'으로 읽힌다.
    d.text((100, 552), "일정", font=f(30, True), fill=INK)
    tl_x0, tl_x1, tl_y = 100, 1360, 606
    phases = [
        ("파일럿 3개월", 0.0, 0.25, YELLOW,
         "묻힌 업무 30종 도구화 + 3사 색인 구축 → 사내 임직원 검증"),
        ("제한 오픈 6개월", 0.25, 0.5, YELLOW_LT,
         "고객 일부 대상 · 음성 입력 제공 → 정확도·안전성 측정"),
        ("확대 12개월~", 0.5, 1.0, YELLOW_PALE,
         "업무 범위 확장 · FDS 연동 → 최종 목표 비대면 100%"),
    ]
    for name, a, b, col, note in phases:
        xa = tl_x0 + (tl_x1 - tl_x0) * a
        xb = tl_x0 + (tl_x1 - tl_x0) * b
        d.rounded_rectangle((xa, tl_y, xb - 6, tl_y + 62), radius=8, fill=col)
        d.text((xa + 16, tl_y + 16), name, font=f(24, True), fill=INK)
        d.text((xa + 16, tl_y + 74), note, font=f(21), fill=INK_SOFT)
        tl_y += 106

    box(d, (1400, 596, 1820, 900), PAPER_DIM, RULE, 14)
    d.text((1432, 616), "인력 (개략)", font=f(27, True), fill=INK)
    for i, (role, n) in enumerate([("기획", 1), ("개발", 2), ("현업(창구·콜센터)", 1)]):
        d.text((1432, 664 + i * 50), f"· {role}", font=f(25), fill=INK_SOFT)
        right(d, f"{n}명", 1788, 664 + i * 50, f(25, True), INK)
    para(d, "바꾸는 건 도구 함수의 '본문'뿐입니다. 라우팅·되묻기·안전장치는 그대로입니다.",
         1432, 816, f(21), 360, INK_SOFT)

    band(d, 926, "기획이 아니라 이식 계획입니다 — 무엇을 그대로 쓰고 무엇만 바꾸는지 적었습니다.",
         x0=100, x1=1820, h=70)
    return save(im, "slide-22-apply.png")


# ── 16쪽 · 프로토타입 (실제 화면 캡처) ──────────────────────
# 배포본(kb-jimun-kkaji.vercel.app)에서 자동 시연을 돌리고 직접 캡처한 것이다.
# 목업이 아니라 실제로 돈 화면이라는 점이 이 장의 전부다.
SHOT = r"C:\Users\hsh\Desktop\공모전\figures\screenshots\demo-b.png"
SHOT_CROP = (195, 30, 1240, 715)  # 폰 + 판단 로그만 남기고 브라우저 여백을 자른다


def slide16():
    from PIL import Image

    im, d = new_slide(
        "무엇을 만들었나 — 프로토타입",
        "개념만으로는 확신이 서지 않아 직접 만들었습니다. 아래는 배포본에서 자동 시연을 돌린 실제 화면입니다.",
        page=PAGE[16], nav_on=2)

    shot = Image.open(SHOT).convert("RGB").crop(SHOT_CROP)
    tw = 980
    shot = shot.resize((tw, int(shot.height * tw / shot.width)), Image.LANCZOS)
    im.paste(shot, (100, 258))
    d.rectangle((100, 258, 100 + shot.width, 258 + shot.height), outline=RULE, width=2)
    d.text((100, 258 + shot.height + 14),
           "왼쪽 = 고객 화면 · 오른쪽 = AI 판단 로그(어떤 기능을 불렀고 무엇을 전송했는지)",
           font=f(22), fill=INK_SOFT)

    facts = [
        ("2,656개", "KB 3사 메뉴를 실제로 수집해 학습",
         "KB국민은행 633 · KB국민카드 1,219 · KB증권 804"),
        ("30종", "업무를 AI가 부르는 함수로 구현",
         "조회 19종 · 실행 10종 · 되묻기 1종"),
        ("3,551줄", "외부 라이브러리 없는 바닐라 JS",
         "테스트 245개 전부 통과 · 빌드 단계 없음"),
        ("실제 파일", "브라우저 안에서 만들어 내려받음",
         "이용명세서 CSV · 증명서 문서 (서버 전송 없음)"),
    ]
    x, y = 1160, 258
    for big, title, note in facts:
        box(d, (x, y, 1820, y + 156), PAPER, RULE, 14)
        d.rectangle((x, y, x + 10, y + 156), fill=YELLOW)
        d.text((x + 32, y + 16), big, font=f(38, True), fill=INK)
        d.text((x + 32, y + 70), title, font=f(24, True), fill=INK)
        para(d, note, x + 32, y + 106, f(21), 610, INK_SOFT)
        y += 170

    band(d, 950, "기획이 아니라 돌아가는 것을 제출합니다 — kb-jimun-kkaji.vercel.app",
         x0=100, x1=1820, h=66)
    return save(im, "slide-16-proto.png")


def main():
    print("슬라이드 그림 생성:")
    slide12()
    slide16()
    slide13()
    slide15()
    slide19()
    slide22()


if __name__ == "__main__":
    main()
