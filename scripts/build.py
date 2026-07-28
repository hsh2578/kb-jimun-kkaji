# 기술설명서를 처음부터 끝까지 다시 만든다.
#
# 단계가 여러 개고 순서가 중요하다. 손으로 하나씩 돌리다 보면 한 단계를 빠뜨려
# (실측: recolor 를 건너뛰어 청록색이 남고, overlay 를 먼저 돌려 덮어씀)
# 결과가 조용히 어긋난다. 한 번에 돌린다.
#
# 순서가 이런 이유:
#   ① 그림 먼저 — 덮어쓸 그림이 있어야 ⑤에서 얹을 수 있다
#   ② 원본에서 새로 짓는다 — 아래 단계는 전부 이 결과를 고쳐 쓴다
#   ③ 장 추가 — 27~30번은 ②가 만들지 못한다(원본이 26장뿐)
#   ④ 색·이미지 KB화 — 텍스트가 다 들어간 뒤에 해야 놓치지 않는다
#   ⑤ 덮어쓰기 — 마지막이어야 한다. 이 뒤에 ④를 돌리면 얹은 그림이 물든다
#
# 실행: python scripts/build.py
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DESK = r"C:\Users\hsh\Desktop\공모전"
DECK = os.path.join(DESK, "KB_기술설명서_은행카드증권통합_대화형실행에이전트_황성혁.pptx")
FIG = os.path.join(DESK, "figures")

# 원본 슬라이드 번호 → 덮어쓸 그림.
# 원본 도형으로는 담기지 않아 그림으로 대체한 장들이다.
OVERLAY = {
    # 문제 정의 — "20대인 나도 상담을 받고 싶은데 받기가 힘들다"를 다섯 고리로
    4: "prob-1-me.png",             # 저는 20대입니다. 그런데도 막혔습니다
    5: "prob-2-gap.png",            # 도구는 전부 '질문'을 전제합니다
    6: "prob-3-counsel.png",        # 상담을 받고 싶어도, 상담이 가장 멉니다
    7: "prob-4-scale.png",          # 저만의 문제가 아닙니다
    39: "prob-5-bridge.png",         # 그래서 상담을 대체합니다
    9: "fix-10-solution.png",       # 우리 해법 (대화)
    11: "fix-12-layers.png",        # 3계층 라우팅
    12: "slide-12-search.png",      # 메뉴 2,656개를 찾는 법
    13: "slide-13-safety.png",      # 안전장치 3중
    14: "fix-15-boundary.png",      # LLM 경계
    15: "slide-15-llm.png",         # 어떤 LLM
    31: "tech-1-flow.png",          # 요청 하나가 지나가는 길
    32: "tech-2-clarify.png",       # 되묻기 알고리즘
    33: "tech-3-entity.png",        # 엔티티 해석
    40: "tech-5-learn.png",          # 상담 이력으로 되묻기 학습
    34: "tech-4-deploy.png",        # KB 배치 구조
    37: "future-3-stack.png",        # 기술 스택
    38: "future-4-integration.png",  # KB 앱 연동 지점
    35: "future-1-spec.png",        # 프로토타입 사양 → 실서비스 사양
    36: "future-2-roadmap.png",     # 이 구조가 다음에 받아들이는 것
    16: "slide-16-proto.png",       # 프로토타입 (실제 캡처)
    17: "fix-18-metrics.png",       # 실측 성능
    19: "slide-19-kb.png",          # KB만의 문제
    20: "fix-20-targets.png",       # 목표 지표
    21: "fix-21-benefit.png",       # 고객·직원·사회
    22: "plan-1-path.png",          # 적용 경로
    23: "fix-27-versus.png",        # 안내 vs 실행
    24: "fix-28-different.png",     # 다르게 본 지점
    26: "fix-30-appendix.png",      # 부록
    27: "plan-2-schedule.png",      # 일정
    28: "plan-3-cost.png",          # 인력·비용
    29: "plan-4-risk.png",          # 리스크
    30: "plan-5-ops.png",           # 운영
}


def run(*args, label=""):
    r = subprocess.run([sys.executable, "-X", "utf8", *args],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print(r.stdout)
        print(r.stderr)
        raise SystemExit(f"실패: {label or args}")
    return (r.stdout or "").strip().splitlines()


def step(n, name):
    print(f"[{n}] {name}")


def check_not_open() -> None:
    """PowerPoint 로 열려 있으면 먼저 멈춘다.

    열려 있으면 ② 단계가 덮어쓰지 못하고 옆 이름(_v2)으로 저장되는데, 그 뒤
    단계들은 원래 이름을 계속 고쳐서 '빌드는 성공했는데 결과는 옛것'이 된다.
    실제로 그렇게 어긋나 add-slides 가 30장짜리에 또 장을 붙이려다 멈췄다.
    """
    lock = os.path.join(os.path.dirname(DECK), "~$" + os.path.basename(DECK))
    stale = os.path.splitext(DECK)[0] + "_v2.pptx"
    if os.path.exists(lock):
        raise SystemExit(
            "PowerPoint 에서 기획서가 열려 있습니다. 닫고 다시 실행해 주세요.\n"
            f"  {DECK}")
    if os.path.exists(stale):
        os.remove(stale)
        print("     (이전 실행이 남긴 _v2 파일을 지웠습니다)")


def main() -> None:
    s = lambda p: os.path.join(HERE, p)
    check_not_open()

    step(1, "글꼴 검사")
    print("    ", "\n     ".join(run(s("check-glyphs.py"), label="check-glyphs")))

    step(2, "그림 생성")
    for script in ("make-figures.py", "make-slide-figures.py",
                   "make-plan-slides.py", "make-fix-slides.py",
                   "make-problem-slides.py", "make-tech-slides.py",
                   "make-future-slides.py"):
        run(s(script), label=script)
    print("     완료")

    step(3, "원본에서 기획서 짓기 (텍스트·순서)")
    print("    ", "\n     ".join(run(s("build-kb-deck.py"))[-1:]))

    step(4, "장 추가")
    print("    ", "\n     ".join(run(s("add-slides.py"), DECK)[-1:]))

    step(5, "KB 색·이미지로 바꾸기")
    run(s("recolor-deck-images.py"), DECK, label="recolor-images")
    print("    ", "\n     ".join(run(s("recolor-deck-shapes.py"), DECK)[-2:-1]))
    print("    ", "\n     ".join(run(s("make-evidence-figures.py"), DECK)[-2:-1]))

    step(6, "깨지는 장을 그림으로 덮기")
    missing = [f for f in OVERLAY.values() if not os.path.exists(os.path.join(FIG, f))]
    if missing:
        raise SystemExit(f"그림이 없습니다: {missing}")
    args = [f"{n}={os.path.join(FIG, f)}" for n, f in sorted(OVERLAY.items())]
    print("    ", "\n     ".join(run(s("overlay-figure.py"), DECK, *args)))

    print()
    print(f"완성 → {DECK}")


if __name__ == "__main__":
    main()
