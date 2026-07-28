# 프로토타입 사양 → 실서비스 사양, 그리고 그 다음.
#
# 기술 상세 4장(tech-*)은 지금 돌아가는 것을 설명한다. 그런데 그것만 있으면
# "개인이 만든 데모의 내부 구현"으로 읽힌다. 심사가 알고 싶은 것은
#   · KB에 놓으면 이 사양이 어떻게 바뀌나
#   · 이 구조가 앞으로 무엇을 더 받아들일 수 있나
# 이 둘이다.
#
# 바꾸는 항목마다 '왜'를 적는다. 이유 없는 대비표는 계획이 아니라 목록이다.
#
# 실행: python scripts/make-future-slides.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _pages():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk6", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _pages()

from slide_kit import (INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       center, f, new_slide, para, right, save)

NAV_TECH = 2


# ── 35 · 프로토타입 사양 → 실서비스 사양 ────────────────────
def f1_spec():
    im, d = new_slide(
        "프로토타입 사양 → 실서비스 사양",
        "지금 돌아가는 값과, KB에 놓았을 때 바뀌는 값을 항목마다 적었습니다. 바꾸는 이유도 함께.",
        page=PAGE[35], nav_on=NAV_TECH)

    cols = ["항목", "지금 (돌아가는 프로토타입)", "KB 실서비스", "바꾸는 이유"]
    widths = [230, 520, 520, 450]
    rows = [
        ("임베딩", "OpenAI text-embedding-3-small\n256차원 · API 호출",
         "폐쇄망 임베딩 모델\n(한국어 금융 어휘 적응)", "망분리 · 도메인 용어"),
        ("색인 저장", "정적 파일 · int8 2,714벡터\n680KB, 앱에 내장",
         "형식 동일 + 버전·서명\n델타 배포", "갱신 주기와 롤백"),
        ("유사도 검색", "전수 코사인\n(2,714개는 이 편이 더 빠름)",
         "10만 벡터를 넘으면 ANN(HNSW)\n인터페이스는 동일", "3사 전 상품으로 확장 시"),
        ("도구 함수", "30종 · 가상 데이터",
         "내부 API 게이트웨이 호출\n이름·인자·반환형 그대로", "함수 껍데기 불변 = 이식"),
        ("인증", "WebAuthn (브라우저)",
         "앱 생체인증 모듈\n(네이티브 브릿지)", "기존 인증을 그대로 씀"),
        ("대화 상태", "메모리 (탭 단위)",
         "세션 저장소 + 감사 로그", "재접속 · 상담사 이관 · 사후 추적"),
        ("모델 호출", "외부 API 1회/턴",
         "폐쇄망 sLLM · 프롬프트 캐싱", "비용 · 지연 · 규제"),
        ("평가", "독립 LLM 심판 160건\n회귀 테스트 245개",
         "동일 체계 + 실사용 로그 기반\n오프라인 재평가", "출시 후에도 계속 잰다"),
    ]

    x0 = 100
    total = sum(widths)
    # 8행이 아래로 넘쳐 띠가 푸터를 덮었다(실측). 행 높이를 줄여 940 안에서 끝낸다.
    head_h, row_h = 58, 74
    y = 238
    d.rounded_rectangle((x0, y, x0 + total, y + head_h), radius=10, fill=MACHINE)
    d.rectangle((x0, y + head_h - 10, x0 + total, y + head_h), fill=MACHINE)
    cx = x0
    for i, c in enumerate(cols):
        d.text((cx + 24, y + 16), c, font=f(22, True), fill=PAPER)
        cx += widths[i]
    y += head_h
    top_y = 238 + head_h

    for r, row in enumerate(rows):
        bg = PAPER if r % 2 == 0 else PAPER_DIM
        d.rectangle((x0, y, x0 + total, y + row_h), fill=bg)
        d.line((x0, y, x0 + total, y), fill=RULE, width=1)
        cx = x0
        for i, cell in enumerate(row):
            lines = cell.split("\n")
            if i == 0:
                d.text((cx + 24, y + 24), cell, font=f(22, True), fill=INK)
            else:
                col = INK_SOFT if i == 1 else (INK if i == 2 else RED)
                fnt = f(19, i == 2)
                top = y + (row_h - len(lines) * 27) / 2
                for j, ln in enumerate(lines):
                    d.text((cx + 24, top + j * 27), ln, font=fnt, fill=col)
            cx += widths[i]
        y += row_h
    d.rectangle((x0, 238, x0 + total, y), outline=RULE, width=2)
    cx = x0
    for w_ in widths[:-1]:
        cx += w_
        d.line((cx, 238, cx, y), fill=RULE, width=1)

    band(d, 908, "바뀌는 것은 '무엇을 부르느냐'뿐입니다 — 라우팅·되묻기·안전장치·화면은 그대로입니다.",
         x0=100, x1=1820, h=56)
    return save(im, "future-1-spec.png")


# ── 36 · 기술 로드맵 ────────────────────────────────────────
def f2_roadmap():
    im, d = new_slide(
        "이 구조가 다음에 받아들이는 것",
        "확장할 자리를 미리 뚫어 두었습니다. 각 항목이 어디에 붙는지까지 적었습니다.",
        page=PAGE[36], nav_on=NAV_TECH)

    tiers = [
        ("1단계 · 지금 구조 그대로", YELLOW, [
            ("새 업무 추가", "도구 스키마 1개 + 본문. 라우팅·되묻기·안전장치는 손대지 않음"),
            ("메뉴 개편 대응", "색인 재빌드로 자동 반영. 사람이 의도를 등록하지 않음"),
            ("계열사 확대", "색인에 계열사 축을 하나 더 — 보험·캐피탈까지"),
        ]),
        ("2단계 · 모듈 추가", YELLOW_LT, [
            ("개인화 랭킹", "검색 점수에 이용 이력 가중치를 더함 — score 식에 항 하나 추가"),
            ("능동 제안", "만기·지원금 마감을 감지해 먼저 말을 걺 — 조회 도구를 배치로 돌림"),
            ("음성 우선 모드", "고령 고객 대상. 입력은 이미 음성을 받고, 출력에 TTS를 붙임"),
        ]),
        ("3단계 · 연동", YELLOW_PALE, [
            ("FDS 연동", "prepare()와 execute() 사이에 이상거래 검사 1개 추가 — 계획 단계에서 차단"),
            ("상담사 이관", "대화 맥락과 판단 로그를 그대로 넘김 — 고객이 처음부터 다시 말하지 않음"),
            ("서류 판독", "촬영한 서류에서 필요한 항목을 읽어 슬롯을 자동으로 채움"),
        ]),
    ]
    # 세 덩이가 넘쳐 아래 상자가 슬라이드 밖으로 나갔다(실측). 높이를 줄인다.
    y = 236
    for title, col, items in tiers:
        h = 50 + len(items) * 50
        box(d, (100, y, 1820, y + h), PAPER, RULE, 14)
        d.rounded_rectangle((100, y, 480, y + 46), radius=12, fill=col)
        d.text((124, y + 9), title, font=f(23, True), fill=INK)
        yy = y + 58
        for name, how in items:
            d.text((140, yy), f"· {name}", font=f(22, True), fill=INK)
            d.text((520, yy + 2), how, font=f(20), fill=INK_SOFT)
            yy += 50
        y += h + 14

    box(d, (100, 894, 1820, 1006), MACHINE, YELLOW, 14)
    d.text((136, 908), "왜 이 확장이 가능한가 — 확장점을 미리 나눠 두었기 때문입니다",
           font=f(24, True), fill=YELLOW_LT)
    points = [
        "새 업무 → 도구 1개",
        "새 메뉴 → 색인 재빌드",
        "새 검사 → 계획과 실행 사이",
        "새 모델 → 어댑터 교체",
    ]
    x = 136
    for p in points:
        d.text((x, 948), p, font=f(21, True), fill=PAPER)
        x += 430
    d.text((136, 980), "네 자리 모두 나머지 코드를 건드리지 않고 갈아끼울 수 있습니다.",
           font=f(20), fill=YELLOW_LT)
    return save(im, "future-2-roadmap.png")


# ── 37 · 기술 스택 (이름을 못 박는다) ──────────────────────
# "어떤 알고리즘"만 적어 두면 실제로 무엇을 썼는지가 보이지 않는다.
# 프로토타입 쪽은 전부 이 저장소에서 확인한 것이고, KB 쪽은 '후보'라고 명시한다.
# 확인 위치: package.json(의존성 0) · api/chat.js(gpt-4o-mini, tools)
#            api/embed.js(text-embedding-3-small, 256) · src/auth/webauthn.js
#            js/voice.js(Web Speech API, ko-KR) · src/menu/quantize.js(int8)
def f3_stack():
    im, d = new_slide(
        "기술 스택 — 지금 무엇으로 돌고, KB에선 무엇으로 바꾸나",
        "왼쪽은 지금 배포본에서 실제로 도는 것입니다. 오른쪽은 KB 환경에서의 대체 후보입니다.",
        page=PAGE[37], nav_on=NAV_TECH)

    layers = [
        ("화면 · 입력", [
            ("Vanilla JS (ES Modules) · 빌드 단계 없음 · npm 의존성 0",
             "KB스타뱅킹 웹뷰에 그대로 탑재"),
            ("Web Speech API (SpeechRecognition, ko-KR)",
             "앱 내장 STT 또는 기존 음성 모듈"),
        ]),
        ("대화 · 판단", [
            ("OpenAI gpt-4o-mini · Chat Completions + Function Calling\n"
             "(tools / tool_calls 프로토콜, max_tokens 800)",
             "KB 자체 GenAI 플랫폼, 또는 국내 sLLM 온프레미스\n"
             "(EXAONE · A.X · SOLAR · Qwen 계열 — vLLM 서빙)"),
        ]),
        ("검색 · 색인", [
            ("OpenAI text-embedding-3-small (dimensions=256)",
             "한국어 특화 임베딩 온프레미스 (BGE-M3 · KURE 계열)"),
            ("자체 구현 — int8 대칭 양자화 + 코사인 전수 탐색 (2,714벡터, 680KB)\n"
             "자체 한국어 토크나이저 (조사 제거, 2글자 이상)",
             "규모 확대 시 ANN — HNSW(FAISS/hnswlib) 또는 pgvector\n"
             "인터페이스는 동일하게 유지"),
        ]),
        ("실행 · 인증", [
            ("WebAuthn / FIDO2 (navigator.credentials, 플랫폼 인증기 확인)",
             "KB 앱 생체인증 SDK — FIDO2 규격 그대로"),
            ("자체 AuthGate — 계획 결속 1회용 토큰 · fail-closed",
             "동일 로직 + 사내 감사 로그 적재"),
            ("Vercel Serverless Functions (Node.js)",
             "KB 내부 API 게이트웨이"),
        ]),
        ("산출물 · 검증", [
            ("클라이언트 생성 — CSV(UTF-8 BOM) · 인쇄용 HTML (서버 전송 없음)",
             "동일 · 필요 시 사내 문서 서식 적용"),
            ("node --test 245개 · 독립 LLM 심판 평가",
             "동일 체계 + 실사용 로그 기반 오프라인 재평가"),
        ]),
    ]

    y = 240
    d.text((640, 212), "지금 (배포본에서 실제로 도는 것)", font=f(22, True), fill=INK_SOFT)
    d.text((1290, 212), "KB 적용 후보", font=f(22, True), fill=RED)
    for name, rows in layers:
        h = sum(28 * len(a.split("\n")) + 18 for a, _ in rows) + 22
        box(d, (100, y, 1820, y + h), PAPER, RULE, 12)
        d.rectangle((100, y, 112, y + h), fill=YELLOW)
        d.text((132, y + 14), name, font=f(24, True), fill=INK)
        yy = y + 14
        for now, kb in rows:
            for j, ln in enumerate(now.split("\n")):
                d.text((620, yy + j * 28), ln, font=f(19), fill=INK_SOFT)
            for j, ln in enumerate(kb.split("\n")):
                d.text((1290, yy + j * 28), ln, font=f(19, True), fill=INK)
            yy += 28 * max(len(now.split("\n")), len(kb.split("\n"))) + 18
        y += h + 12

    band(d, y + 4, "새로 도입해야 하는 상용 솔루션이 없습니다 — 모델과 API만 KB 것으로 바꿉니다.",
         x0=100, x1=1820, h=56)
    return save(im, "future-3-stack.png")


# ── 38 · KB 앱에 붙이는 기술 (연동 지점) ──────────────────
# 프로토타입은 증거일 뿐이고, 심사가 보는 것은 '실제 앱에 어떻게 붙느냐'다.
# 연동 지점 다섯 곳을 실제 작업 단위로 적는다.
def f4_integration():
    im, d = new_slide(
        "KB 앱에 붙이는 기술 — 연동 지점 다섯 곳",
        "프로토타입은 이 다섯 곳의 자리를 미리 만들어 둔 것입니다. 실제 작업은 그 자리를 채우는 일입니다.",
        page=PAGE[38], nav_on=NAV_TECH)

    items = [
        ("① 웹뷰 ↔ 네이티브 브릿지", [
            "KB스타뱅킹 WebView 에 대화 화면 탑재 — 앱의 기존 로그인 세션을 그대로 씁니다(별도 로그인 없음)",
            "JS ↔ Native 인터페이스 하나: 계획 ID를 넘기고 생체인증 결과를 콜백으로 받습니다",
            "화면 이동은 딥링크 — kbstarbanking://menu/{id} (프로토타입에 주소 형식까지 구현)",
        ]),
        ("② 내부 API 연동 — 도구 함수 30종", [
            "함수 이름·인자·반환형은 고정, 본문만 내부 API 호출로 교체합니다",
            "조회 19종 → 계정계·카드·증권 조회 / 실행 10종 → 이체·해지·발급 전문",
            "실행계는 멱등키로 중복 실행을 막고, 타임아웃·재시도 정책을 도구 단위로 둡니다",
        ]),
        ("③ 색인 빌드 파이프라인", [
            "메뉴 수집 → 발화 생성(배치) → 임베딩 → int8 양자화 → 서명 → 앱 델타 배포",
            "주 1회 자동 실행, 메뉴 변경이 감지되면 즉시. 버전 태그로 롤백할 수 있습니다",
            "사람이 의도를 등록하는 단계가 없습니다 — 그래서 메뉴가 늘어도 운영 부담이 늘지 않습니다",
        ]),
        ("④ 모델 서빙 (폐쇄망)", [
            "sLLM 온프레미스 추론 서버 + GPU 풀. 시스템 프롬프트 고정부는 캐싱합니다",
            "모델 장애 시 L1 라우팅만으로 계속 동작합니다 — 이미 구현돼 있고 테스트로 고정했습니다",
            "모델 교체는 어댑터 한 곳만 바꿉니다. 나머지 코드는 손대지 않습니다",
        ]),
        ("⑤ 감사 · 관측", [
            "발화 → 선택한 도구 → 인자 → 결과까지 전 구간을 남깁니다 (PII 마스킹 후 적재)",
            "화면의 「AI 판단 로그」와 같은 내용이며, 사고 시 무엇이 왜 일어났는지 답할 수 있습니다",
            "이 로그가 그대로 오프라인 재평가 데이터가 됩니다",
        ]),
    ]
    # 다섯 덩이가 아래로 넘쳐 띠가 통째로 사라진 적이 있다(실측). 높이를 고정한다.
    y = 228
    for title, lines in items:
        h = 42 + len(lines) * 28
        box(d, (100, y, 1820, y + h), PAPER, RULE, 12)
        d.rectangle((100, y, 112, y + h), fill=YELLOW)
        d.text((132, y + 10), title, font=f(24, True), fill=INK)
        yy = y + 46
        for t in lines:
            d.text((156, yy), f"· {t}", font=f(20), fill=INK_SOFT)
            yy += 28
        y += h + 10

    band(d, 922, "다섯 곳 모두 '자리'가 이미 코드에 있습니다 — 새 구조를 설계하는 일이 아니라 채우는 일입니다.",
         x0=100, x1=1820, h=56)
    return save(im, "future-4-integration.png")


def main():
    print("확장 슬라이드:")
    f3_stack()
    f4_integration()
    f1_spec()
    f2_roadmap()


if __name__ == "__main__":
    main()
