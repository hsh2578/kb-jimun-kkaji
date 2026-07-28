# 문제 정의에 들어가는 '근거 도표'를 만들고 기획서에 끼워 넣는다.
#
# 원본(iM 기획서에서 물려받은 그림)에는 출처를 댈 수 없는 숫자가 들어 있었다.
#   · 6쪽 "연령별 모바일뱅킹 이용률 90/70/23%"  — 근거 없음
#   · 7쪽 "이용자 만족도(토스뱅크) 36/72%"      — 우리 논지와 무관한 타사 지표
# 근거 없는 그래프는 심사에서 가장 먼저 의심받는 자리다. 검증을 통과한
# 공식 통계로 바꾼다.
#
# 쓰는 값 (전부 1차 출처 확인):
#   ① 한국은행 「2024년 지급수단 및 모바일금융서비스 이용행태 조사」(2025.3, n=3,551)
#      금융서비스 이용 시 '주 사용' 접근방식이 모바일인 비중 —
#      20대 74.0 / 30대 79.5 / 40대 70.1 / 50대 53.2 / 60대 이상 18.7
#      같은 조사에서 60대 이상 모바일금융 '이용경험'은 53.8%.
#      → 써본 적 있다와 그걸로 일을 처리한다는 다른 이야기다. 이 격차가 논지다.
#   ② 금융위원회 「고령친화 금융환경 조성방안」(2020.8) 65세 이상 온라인 거래비중 —
#      이체/출금 69.9 / 예금 7.0 / 신용대출 12.4
#      → 단순한 일은 하는데 절차가 붙으면 무너진다. 우리가 노리는 자리가 여기다.
#   ③ 아시아경제 의뢰·마크로밀 엠브레인(2024.7, 성인 500명, ±4.38%p)
#      금융회사 콜센터 AI 상담 만족 21.6 / 보통 39.0 / 불만족 39.4
#      불만족 사유 1위 'AI가 내 요구사항을 이해하지 못한다' 73.6%
#      ※ 같은 수치를 KB 자체 콘텐츠(kbthink)에서도 볼 수 있으나 인용하지 않는다.
#         KB 공모전에 KB 블로그를 근거로 대면 순환논증이 된다.
#
# 실행: python scripts/make-evidence-figures.py [pptx경로]
import glob
import io
import os
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFont

SHOTS = r"C:\Users\hsh\Desktop\공모전"
OUT = os.path.join(SHOTS, "figures")
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_B = r"C:\Windows\Fonts\malgunbd.ttf"

YELLOW = "#C8922A"
YELLOW_SOFT = "#E5C77A"
INK = "#191512"
INK_SOFT = "#5C534A"
RULE = "#D8CFBE"
RED = "#C05A48"
PAPER = "#FFFDF8"


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def center(d, t, cx, y, font, fill=INK):
    d.text((cx - d.textlength(t, font=font) / 2, y), t, font=font, fill=fill)


def bars(d, data, box, maxv=100, label_font=28, value_font=34):
    """세로 막대. box=(x0,y0,x1,y1) 안에 균등 배치한다."""
    x0, y0, x1, y1 = box
    n = len(data)
    slot = (x1 - x0) / n
    bw = min(slot * 0.55, 150)
    for i, (name, v, col) in enumerate(data):
        cx = x0 + slot * (i + 0.5)
        h = (y1 - y0) * (v / maxv)
        d.rectangle((cx - bw / 2, y1 - h, cx + bw / 2, y1), fill=col)
        center(d, f"{v}", cx, y1 - h - value_font - 8, f(value_font, True), INK)
        center(d, name, cx, y1 + 14, f(label_font), INK)
    d.line((x0 - 20, y1, x1 + 20, y1), fill=RULE, width=3)


# ── ① 고령층: 써봤다와 그걸로 처리한다 ─────────────────────
def fig_elderly_gap(size=(1200, 650)) -> Image.Image:
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((16, 8), "금융서비스를 볼 때 '주로' 쓰는 수단이 모바일인 비중 (%)", font=f(31, True), fill=INK)
    d.text((16, 52), "한국은행 2024년 이용행태 조사 (2025.3 발표, n=3,551)", font=f(23), fill=INK_SOFT)

    data = [("20대", 74.0, YELLOW), ("30대", 79.5, YELLOW), ("40대", 70.1, YELLOW),
            ("50대", 53.2, YELLOW_SOFT), ("60대+", 18.7, RED)]
    bars(d, data, (70, 110, 1130, 500))

    d.text((16, 560), "60대 이상은 '써본 적 있다' 53.8% — 그런데 주로 쓰는 수단은 18.7%",
           font=f(29, True), fill=RED)
    d.text((16, 602), "앱을 깔지 않아서가 아닙니다. 깔아놓고도 그걸로 일을 끝내지 못합니다.",
           font=f(25), fill=INK_SOFT)
    return im


# ── ② AI 상담은 대안이 되지 못했다 ─────────────────────────
def fig_ai_satisfaction(size=(1080, 580)) -> Image.Image:
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((14, 6), "금융사 콜센터 AI 상담 만족도 (%)", font=f(30, True), fill=INK)
    d.text((14, 48), "아시아경제 의뢰·마크로밀 엠브레인 2024.7 · 성인 500명 · ±4.38%p", font=f(21), fill=INK_SOFT)

    data = [("만족", 21.6, YELLOW_SOFT), ("보통", 39.0, RULE), ("불만족", 39.4, RED)]
    bars(d, data, (90, 100, 990, 420), maxv=50, label_font=27, value_font=32)

    d.text((14, 480), "불만족이 만족의 1.8배", font=f(29, True), fill=RED)
    d.text((14, 522), "불만족 사유 1위 — \u201cAI가 내 요구사항을 이해하지 못한다\u201d 73.6%",
           font=f(24), fill=INK_SOFT)
    return im


# ── ③ 우리가 노리는 자리 (단순 vs 절차) ────────────────────
def fig_complexity_gap(size=(1200, 650)) -> Image.Image:
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((16, 8), "65세 이상, 업무별 온라인 처리 비중 (%)", font=f(31, True), fill=INK)
    d.text((16, 52), "금융위원회 「고령친화 금융환경 조성방안」 2020.8", font=f(23), fill=INK_SOFT)

    data = [("이체·출금", 69.9, YELLOW), ("신용대출", 12.4, RED), ("예금 가입", 7.0, RED)]
    bars(d, data, (110, 110, 1090, 500), maxv=80, value_font=36)

    d.text((16, 560), "같은 사람이, 같은 앱에서 — 절차가 붙는 순간 무너집니다",
           font=f(29, True), fill=RED)
    d.text((16, 602), "이체는 첫 화면에 있습니다. 우리가 노리는 건 그 주변에 묻힌 절차들입니다.",
           font=f(25), fill=INK_SOFT)
    return im


# 6·7쪽의 원본 그림 자리에 그대로 끼운다(크기를 맞춰야 찌그러지지 않는다).
TARGETS = {
    "ppt/media/image5.png": (fig_elderly_gap, (1200, 650)),
    "ppt/media/image6.png": (fig_ai_satisfaction, (1080, 580)),
}


def main() -> None:
    deck = sys.argv[1] if len(sys.argv) > 1 else max(
        glob.glob(os.path.join(SHOTS, "KB_기술설명서*.pptx")), key=os.path.getmtime)

    os.makedirs(OUT, exist_ok=True)
    blobs = {}
    for name, (fn, size) in TARGETS.items():
        img = fn(size)
        buf = io.BytesIO()
        img.save(buf, "PNG")
        blobs[name] = buf.getvalue()
        img.save(os.path.join(OUT, os.path.basename(name).replace("image", "evidence")))

    # 3번 그림은 아직 들어갈 자리(도형)가 없어 파일로만 남긴다.
    fig_complexity_gap().save(os.path.join(OUT, "fig-complexity-gap.png"))

    zin = zipfile.ZipFile(deck)
    tmp = deck + ".tmp"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    hit = []
    for item in zin.infolist():
        if item.filename in blobs:
            zout.writestr(item, blobs[item.filename])
            hit.append(item.filename)
        else:
            zout.writestr(item, zin.read(item.filename))
    zout.close()
    zin.close()

    missing = set(blobs) - set(hit)
    if missing:
        os.remove(tmp)
        raise SystemExit(f"자리를 찾지 못했습니다: {sorted(missing)}")
    os.replace(tmp, deck)
    print(f"근거 도표 {len(hit)}개 교체 · fig-complexity-gap.png 생성")
    print(f"저장 → {deck}")


if __name__ == "__main__":
    main()
