# 개발 계획 5장을 그린다.
#
# 왜 5장인가: 예선 평가에서 '개발 계획의 구체성'이 15점인데 원본 기획서는 이
# 항목에 한 장만 썼다. 같은 15점인 '문제 정의'에 다섯 장을 쓰면서 계획을 한 장에
# 몰아 넣은 건 균형이 아니라 누락에 가깝다. 적용 경로 / 일정 / 인력·비용 /
# 리스크 / 운영으로 가른다.
#
# 마지막 장(운영)이 이 묶음의 핵심이다. 요즘IT 기고에서 카드사 AI 콜센터
# 운영자가 "신상품·약관이 바뀔 때마다 답변을 손으로 고쳐야 한다 — 밑 빠진 독에
# 물 붓는 기분"이라고 했다. 문제 정의에서 든 그 지적에 계획으로 답하지 않으면
# 우리도 같은 독이 된다.
#
# 실행: python scripts/make-plan-slides.py
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _pages():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-kb-deck.py")
    spec = importlib.util.spec_from_file_location("_bk2", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {n: pos - 1 for pos, n in enumerate(mod.ORDER, start=1)}


PAGE = _pages()

from slide_kit import (INK, INK_FAINT, INK_SOFT, MACHINE, PAPER, PAPER_DIM,
                       RED, RULE, YELLOW, YELLOW_LT, YELLOW_PALE, band, box,
                       center, f, new_slide, para, right, save)

NAV_PLAN = 3  # 상단 내비에서 '차별점' 구간


def head(d, x0, y, x1, title, fill=MACHINE, tc=PAPER, h=64, size=27):
    d.rounded_rectangle((x0, y, x1, y + h), radius=14, fill=fill)
    d.rectangle((x0, y + h - 14, x1, y + h), fill=fill)
    d.text((x0 + 24, y + (h - size - 6) / 2), title, font=f(size, True), fill=tc)


# ── 22쪽 · 적용 경로 (일정·인력은 뒷장으로 뺐다) ────────────
def plan_path():
    im, d = new_slide(
        "실제 KB 적용 경로 — 무엇을 그대로 쓰고, 무엇만 바꾸나",
        "새 앱을 만들지 않습니다. KB스타뱅킹 안의 메뉴 하나로 들어갑니다.",
        page=PAGE[22], nav_on=NAV_PLAN)

    steps = [
        ("1단계", "웹뷰 삽입",
         "KB스타뱅킹 메뉴에 웹뷰 한 장을 추가합니다.",
         "프로토타입의 화면 코드가 그대로 들어갑니다."),
        ("2단계", "네이티브 브릿지",
         "지문 인증을 앱의 생체인증 모듈로 넘깁니다.",
         "프로토타입의 WebAuthn 자리가 그대로 대체됩니다."),
        ("3단계", "코어 API 연결",
         "도구 함수 30개의 본문만 KB 내부 API 호출로 바꿉니다.",
         "함수 이름·인자·반환 형식은 손대지 않습니다."),
        ("4단계", "딥링크",
         "「열기」 버튼이 KB스타뱅킹 내부 메뉴를 엽니다.",
         "프로토타입에 주소 형식(kbstarbanking://menu/{id})까지 넣었습니다."),
    ]
    x0, w, gap = 100, 400, 40
    for i, (tag, name, a, b) in enumerate(steps):
        x = x0 + i * (w + gap)
        box(d, (x, 260, x + w, 556), PAPER, RULE, 14)
        head(d, x, 260, x + w, "", MACHINE, PAPER, 92)
        d.text((x + 24, 272), tag, font=f(22, True), fill=YELLOW_LT)
        d.text((x + 24, 304), name, font=f(28, True), fill=PAPER)
        y = 372
        y = para(d, a, x + 24, y, f(23), w - 48, INK) + 10
        para(d, b, x + 24, y, f(22), w - 48, INK_SOFT)
        if i < 3:
            d.polygon([(x + w + 8, 390), (x + w + 8, 414), (x + w + 30, 402)], fill=INK_FAINT)

    # 이식 계획의 핵심 — 무엇이 그대로인가
    box(d, (100, 586, 940, 918), PAPER_DIM, RULE, 14)
    d.text((132, 606), "그대로 쓰는 것", font=f(28, True), fill=INK)
    keep = [
        "3계층 라우팅 · 되묻기(ask_clarification)",
        "메뉴 색인 2,714개와 하이브리드 검색",
        "AuthGate · 안전장치 3중 · 감사 로그",
        "대화 화면 · 계획 카드 · 파일 생성",
        "회귀 테스트 245개",
    ]
    y = 654
    for t in keep:
        # 체크 기호(U+2713)는 맑은고딕에 없어 네모로 나온다 — 점으로 대신한다.
        d.ellipse((134, y + 11, 148, y + 25), fill=YELLOW)
        d.text((168, y), t, font=f(24), fill=INK_SOFT)
        y += 50

    box(d, (980, 586, 1820, 918), MACHINE, YELLOW, 14)
    d.text((1012, 606), "바꾸는 것", font=f(28, True), fill=YELLOW_LT)
    change = [
        ("도구 함수 30개의 본문", "가상 데이터 → KB 내부 API"),
        ("인증 호출부", "WebAuthn → 앱 생체인증 모듈"),
        ("메뉴 이동", "화면 전환 → 딥링크"),
        ("모델 호출부", "외부 API → KB 폐쇄망 모델"),
    ]
    y = 654
    for a, b in change:
        d.text((1012, y), f"· {a}", font=f(24, True), fill=PAPER)
        d.text((1032, y + 32), b, font=f(21), fill=YELLOW_LT)
        y += 66

    band(d, 946, "함수의 껍데기는 그대로 두고 속만 바꿉니다 — 그래서 이식이지 재개발이 아닙니다.",
         x0=100, x1=1820, h=64)
    return save(im, "plan-1-path.png")


# ── 27쪽 · 일정과 완료 기준 ─────────────────────────────────
def plan_schedule():
    im, d = new_slide(
        "일정 — 단계마다 '무엇이 되면 다음으로 가는지'를 정했습니다",
        "기간만 적은 일정은 계획이 아닙니다. 각 단계에 통과 기준을 붙였습니다.",
        page=PAGE[27], nav_on=NAV_PLAN)

    # 간트
    d.text((100, 240), "전체 흐름", font=f(24, True), fill=INK_SOFT)
    gx0, gx1, gy = 100, 1820, 274
    marks = ["착수", "3개월", "6개월", "12개월", "24개월"]
    for i, t in enumerate(marks):
        x = gx0 + (gx1 - gx0) * i / (len(marks) - 1)
        d.line((x, gy - 8, x, gy + 62), fill=RULE, width=2)
        center(d, t, x, gy + 70, f(20), INK_FAINT)
    spans = [(0.0, 0.25, "파일럿", YELLOW), (0.25, 0.5, "제한 오픈", YELLOW_LT),
             (0.5, 1.0, "확대", YELLOW_PALE)]
    for a, b, name, col in spans:
        xa, xb = gx0 + (gx1 - gx0) * a, gx0 + (gx1 - gx0) * b
        d.rounded_rectangle((xa + 4, gy, xb - 4, gy + 50), radius=8, fill=col)
        d.text((xa + 24, gy + 11), name, font=f(24, True), fill=INK)

    # 각 단계에 '미달 시' 경로를 붙인다. 이 제품은 L1/L2/L3 3계층이라
    # 축소 경로가 구조적으로 이미 있다 — 그걸 계획으로 쓰지 않을 이유가 없다.
    phases = [
        ("1단계 · 파일럿", "3개월", YELLOW, [
            ("범위", "은행 단일사 조회 도구부터 — 3사 확대는 검토 완료 후"),
            ("누구에게", "사내 임직원 (고객 노출 없음)"),
            ("통과 기준", "도구 선택 ≥ 90% · 회귀 245건 100% · 오실행 0건 · 보안성 심의와 개인정보 영향평가 완료"),
            ("미달 시", "실행 도구를 잠그고 조회·안내(L1·L2)만으로 재측정"),
        ]),
        ("2단계 · 제한 오픈", "6개월", YELLOW_LT, [
            ("범위", "3사 확대 · 실행 도구 개방 · 음성 입력 · 딥링크 전 메뉴 연결"),
            ("누구에게", "동의 고객 일부 (단계적 확대)"),
            ("통과 기준", "과제 완수율 기준 달성 · 되묻기 이탈률 ↓ · 오실행 0건 유지"),
            ("미달 시", "실행 도구를 조회 모드로 되돌리고 범위를 다시 좁힘"),
        ]),
        ("3단계 · 확대", "12개월~", YELLOW_PALE, [
            ("범위", "업무 범위 확장 · FDS 연동 · 고령 고객 대상 음성 우선 모드"),
            ("누구에게", "전체 고객"),
            ("최종 목표", "창구·콜센터를 거쳐야 하던 업무의 비대면 완결"),
            ("미달 시", "단계별로 되돌릴 수 있습니다 — 도구 단위로 껐다 켤 수 있는 구조입니다"),
        ]),
    ]
    y = 372
    for title, dur, col, rows in phases:
        box(d, (100, y, 1820, y + 172), PAPER, RULE, 14)
        d.rectangle((100, y, 112, y + 172), fill=col)
        d.text((140, y + 12), title, font=f(26, True), fill=INK)
        right(d, dur, 1792, y + 14, f(24, True), INK_SOFT)
        yy = y + 54
        for label, text in rows:
            d.text((140, yy), label, font=f(20, True),
                   fill=RED if label == "미달 시" else INK_FAINT)
            para(d, text, 420, yy - 2, f(21), 1360, INK_SOFT)
            yy += 30
        y += 184

    band(d, 942, "각 단계는 기간이 아니라 기준으로 끝나고, 못 넘으면 되돌아갈 자리가 정해져 있습니다.",
         x0=100, x1=1820, h=58)
    return save(im, "plan-2-schedule.png")


# ── 28쪽 · 인력과 비용 ──────────────────────────────────────
def plan_cost():
    im, d = new_slide(
        "인력과 비용 — 왜 작게 시작할 수 있나",
        "라우팅과 문장 생성이 모델을 쓰지 않으므로, 호출 비용이 붙는 구간은 하나뿐입니다.",
        page=PAGE[28], nav_on=NAV_PLAN)

    # 인력
    # 앞선 판은 '4명 3개월'에 보안·법무가 0명이었다. 금융권 신규 서비스에서
    # 가장 오래 걸리는 일(보안성 심의·개인정보 영향평가·계열사 협의)이 빠져
    # 있으면 실무를 모른다는 신호로 읽힌다. 인력을 늘리기보다 범위를 줄인다.
    box(d, (100, 258, 940, 586), PAPER, RULE, 14)
    head(d, 100, 258, 940, "파일럿 인력 — 4명 + 검토 트랙", YELLOW, INK)
    people = [
        ("기획 1", "업무 선정 · 현업 인터뷰 · 되묻기 문안"),
        ("개발 2", "도구 함수 본문의 내부 API 연결 · 브릿지 · 색인 구축"),
        ("현업 1", "창구·콜센터 요청 유형 제공 및 검수"),
        ("검토 트랙", "정보보호·컴플라이언스 검토를 별도로 병행 (겸임 가능)"),
    ]
    y = 336
    for role, work in people:
        d.text((132, y), role, font=f(24, True), fill=INK)
        para(d, work, 132, y + 30, f(20), 780, INK_SOFT)
        y += 62
    d.text((132, 560), "1단계 범위를 은행 단일사 조회 도구로 줄여 검토 부담을 낮춥니다.",
           font=f(20), fill=INK_FAINT)

    # 비용 구조
    box(d, (980, 258, 1820, 586), PAPER, RULE, 14)
    head(d, 980, 258, 1820, "모델 호출이 붙는 구간", MACHINE, PAPER)
    rows = [
        ("① 라우팅", "모델 미사용", "기기 안 색인 검색", YELLOW_PALE),
        ("② 도구 선택", "경량 모델 1회", "여기만 비용이 붙습니다", RED),
        ("③ 문장 생성", "모델 미사용", "규칙 기반, 기기 안", YELLOW_PALE),
    ]
    y = 348
    for tag, use, note, col in rows:
        d.rounded_rectangle((1012, y, 1788, y + 56), radius=10,
                            fill=PAPER_DIM if col != RED else "#F7E9E4",
                            outline=col if col == RED else RULE, width=2)
        d.text((1032, y + 14), tag, font=f(24, True), fill=INK)
        d.text((1180, y + 14), use, font=f(24, True), fill=col if col == RED else INK_SOFT)
        d.text((1370, y + 16), note, font=f(21), fill=INK_SOFT)
        y += 66
    d.text((1012, 542), "대화 3단 중 2단이 모델을 쓰지 않습니다 — 이것이 비용 통제의 근거입니다.",
           font=f(21), fill=INK_FAINT)

    # 비용을 줄이는 지렛대
    box(d, (100, 620, 1820, 900), PAPER_DIM, RULE, 14)
    d.text((132, 638), "비용을 줄이는 지렛대 — 순서대로 검토합니다", font=f(28, True), fill=INK)
    levers = [
        ("색인을 기기에 둔다", "메뉴 검색은 호출이 아예 없습니다. int8 양자화로 앱에 실을 크기까지 줄였습니다."),
        ("도구 목록을 좁혀 보낸다", "후보 메뉴 5건과 필요한 도구만 실어 보냅니다. 매번 전체를 보내지 않습니다."),
        ("경량 모델로 충분함을 측정했다", "도구 선택 정확도 90.0% — 큰 모델이 필요한 구간이 아닙니다."),
        ("폐쇄망 자체 모델로 갈아탄다", "경계가 코드에 있어 모델을 바꿔도 나머지 코드는 그대로입니다."),
    ]
    y = 690
    for i, (t, note) in enumerate(levers):
        d.text((132, y), f"{i + 1}.", font=f(24, True), fill=YELLOW)
        d.text((178, y), t, font=f(24, True), fill=INK)
        para(d, note, 620, y + 2, f(22), 1170, INK_SOFT)
        y += 52

    band(d, 926, "실제 단가는 KB가 어떤 모델을 쓰느냐에 달렸습니다. 저희가 정한 건 '어디에만 비용이 붙는가'입니다.",
         x0=100, x1=1820, h=58)
    return save(im, "plan-3-cost.png")


# ── 29쪽 · 리스크와 대응 ────────────────────────────────────
def plan_risk():
    im, d = new_slide(
        "리스크와 대응 — 규제·오작동·책임",
        "금융에서 '되면 좋은 것'보다 '안 되면 큰일 나는 것'을 먼저 적었습니다.",
        page=PAGE[29], nav_on=NAV_PLAN)

    # 앞선 판에는 계열사 정보 제공 동의가 없었다. 이 제품의 정체성이
    # "은행·카드·증권을 한 대화에서"인데, 그 법적 전제를 한 줄도 안 다뤘다.
    # 배치도에는 3사 원장을 한 박스에 그려 놓고서. 가장 먼저 답해야 할 항목이다.
    risks = [
        ("계열사 정보 — 3사를 한 대화에서 다뤄도 되나",
         "신용정보법상 계열사 간 개인신용정보 제공·이용에는 별도 동의가 필요합니다.",
         "새 동의를 만들지 않습니다. KB가 이미 운영 중인 그룹 통합조회 동의 범위 안에서만 "
         "움직이고, 동의하지 않은 계열사는 색인에서 빼 조회·실행 대신 「열기」 버튼만 "
         "드립니다. 동의 범위는 색인 빌드 시점에 계열사별로 잘라 넣습니다.",
         "기존 동의 안에서"),
        ("규제 — AI는 보조수단이어야 한다",
         "금융당국은 AI의 판단이 사람의 결정을 대체하지 않을 것을 요구합니다.",
         "최종 실행은 반드시 본인 인증을 거칩니다. AI는 계획을 만들 뿐 실행하지 못합니다 "
         "— AuthGate 통과 없이는 도구 호출 자체가 거부됩니다(fail-closed).",
         "이미 구조가 그렇습니다"),
        ("망분리 — 고객 정보가 밖으로 나가면 안 된다",
         "외부 LLM을 쓰면 개인신용정보 유출 우려가 제기됩니다.",
         "잔액·계좌번호·예금주·카드번호·거래내역은 LLM에 보내지 않습니다. 전송 전 "
         "scrubPII 로 지우고, 허용된 필드가 아니면 네트워크에 나가기 전 예외를 던집니다"
         "(assertNoPII). 1순위는 KB 폐쇄망 모델입니다.",
         "코드로 막습니다"),
        ("오작동 — 잘못 알아듣고 실행하면",
         "말로 하는 실행에서 가장 큰 위험입니다.",
         "수취인·금액·잔액·대상 중 하나라도 확인되지 않으면 계획을 만들지 않습니다. "
         "실행 직전 부수효과를 먼저 보여주고, 토큰은 계획 하나에만 묶여 재사용되지 않습니다.",
         "3중으로 막습니다"),
        ("책임 — 무엇이 왜 일어났는지 답할 수 있나",
         "사고가 났을 때 설명하지 못하면 서비스를 유지할 수 없습니다.",
         "어떤 발화가 어떤 도구를 어떤 인자로 불렀는지, 무엇을 LLM에 전송했는지 감사 "
         "로그로 남습니다. 화면에도 실시간으로 같은 내용이 보입니다.",
         "감사 로그로 답합니다"),
    ]
    y = 236
    for title, risk, answer, tag in risks:
        h = 134
        box(d, (100, y, 1820, y + h), PAPER, RULE, 14)
        d.rectangle((100, y, 112, y + h), fill=RED)
        d.text((140, y + 10), title, font=f(25, True), fill=INK)
        d.text((140, y + 44), risk, font=f(20), fill=RED)
        para(d, answer, 140, y + 74, f(20), 1400, INK_SOFT)
        # 알약 너비는 글자에 맞춰 늘린다 — 고정 폭으로 뒀더니 글자가 밖으로 나갔다.
        tw = d.textlength(tag, font=f(18, True))
        d.rounded_rectangle((1776 - tw - 30, y + 12, 1792, y + 50), radius=10, fill=MACHINE)
        d.text((1776 - tw - 15, y + 20), tag, font=f(18, True), fill=YELLOW_LT)
        y += 144

    band(d, 952, "규제는 정책 문서가 아니라 코드와 색인 범위로 지킵니다.",
         x0=100, x1=1820, h=56)
    return save(im, "plan-4-risk.png")


# ── 30쪽 · 운영 (밑 빠진 독에 대한 답) ──────────────────────
def plan_ops():
    im, d = new_slide(
        "운영 — 상품과 메뉴가 바뀌면 어떻게 되나",
        "지금 챗봇이 무너지는 지점이 정확히 여기입니다. 계획으로 답하지 않으면 저희도 같은 독이 됩니다.",
        page=PAGE[30], nav_on=NAV_PLAN)

    # 인용 — 문제 정의에서 든 그 지적
    box(d, (100, 250, 1820, 356), MACHINE, YELLOW, 14)
    d.text((132, 272), "“신상품이 나오거나 약관이 바뀔 때마다 답변을 손으로 고쳐야 한다 "
                       "— 밑 빠진 독에 물 붓는 기분”", font=f(27, True), fill=PAPER)
    d.text((132, 314), "요즘IT · 카드사 AI 콜센터 운영자 기고", font=f(22), fill=YELLOW_LT)

    # 대조
    box(d, (100, 386, 940, 800), PAPER_DIM, RULE, 14)
    head(d, 100, 386, 940, "지금 방식 — 의도를 사람이 등록한다", "#8A7A6A", PAPER)
    steps_a = [
        "새 상품·메뉴가 생긴다",
        "운영자가 '의도(intent)'를 새로 만든다",
        "그 의도에 붙일 예시 문장을 손으로 적는다",
        "답변 문안을 손으로 쓴다",
        "빠뜨린 표현은 계속 “찾을 수 없어요”",
    ]
    y = 478
    for i, t in enumerate(steps_a):
        d.text((132, y), f"{i + 1}.", font=f(23, True), fill=INK_FAINT)
        para(d, t, 176, y, f(23), 730, INK_SOFT)
        y += 52
    d.text((132, 748), "→ 메뉴가 늘수록 사람이 할 일도 함께 늘어납니다.",
           font=f(23, True), fill=RED)

    box(d, (980, 386, 1820, 800), PAPER, YELLOW, 14)
    head(d, 980, 386, 1820, "우리 방식 — 의도를 등록하지 않는다", YELLOW, INK)
    steps_b = [
        ("메뉴를 수집한다", "3사 메뉴 트리를 크롤링 — 사람이 목록을 적지 않습니다"),
        ("발화를 자동 생성한다", "메뉴 하나당 '고객이 할 법한 말' 8개를 만들어 색인"),
        ("색인을 다시 만든다", "새 메뉴는 다음 빌드에서 자동으로 포함됩니다"),
        ("사람이 손대는 곳은 하나", "생활사건 58개 — 세상이 바뀔 때만 고칩니다"),
    ]
    y = 470
    for i, (t, note) in enumerate(steps_b):
        d.text((1012, y), f"{i + 1}.", font=f(23, True), fill=YELLOW)
        d.text((1056, y), t, font=f(24, True), fill=INK)
        para(d, note, 1056, y + 30, f(21), 730, INK_SOFT)
        y += 68
    d.text((1012, 748), "→ 메뉴가 늘어도 사람이 할 일은 늘지 않습니다.",
           font=f(23, True), fill=INK)

    # 운영 주기
    box(d, (100, 826, 1820, 926), PAPER_DIM, RULE, 14)
    d.text((132, 844), "운영 주기", font=f(24, True), fill=INK)
    cycle = [("메뉴 수집", "주 1회 자동"), ("색인 재구축", "메뉴 변경 시 자동"),
             ("도구 추가", "새 업무가 생길 때만"), ("생활사건 손질", "반기 1회")]
    x = 460
    for name, when in cycle:
        d.text((x, 842), name, font=f(23, True), fill=INK_SOFT)
        d.text((x, 878), when, font=f(22, True), fill=YELLOW)
        x += 345

    band(d, 946, "유지비가 메뉴 수에 비례하지 않는 구조입니다 — 이것이 챗봇과 갈리는 지점입니다.",
         x0=100, x1=1820, h=58)
    return save(im, "plan-5-ops.png")


def main():
    print("개발 계획 슬라이드:")
    plan_path()
    plan_schedule()
    plan_cost()
    plan_risk()
    plan_ops()


if __name__ == "__main__":
    main()
