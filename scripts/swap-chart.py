# 6쪽 차트를 출처가 확인된 수치로 갈아끼운다.
#
# 원본(iM 기획서에서 물려받은 그림)은 '연령별 모바일뱅킹 이용률 90/70/23%' 였는데,
# 그 숫자를 뒷받침하는 출처가 우리에게 없다. 근거 없는 그래프는 심사에서 가장
# 먼저 의심받는 자리이므로, 공표된 조사 결과로 바꾼다.
#
# 쓰는 값: 과기정통부·한국지능정보사회진흥원(NIA) 디지털정보격차 실태조사.
#   고령층 디지털정보화 수준 71.4% (4대 취약계층 중 최하위)
#   부문별 — 접근 96.5 / 활용 80.0 / 역량 65.6
#
# 접근과 역량의 31%p 격차가 이 제품의 근거다. 스마트폰이 없어서가 아니라
# 다룰 줄을 몰라서 막힌다면, 화면을 더 예쁘게 만드는 걸로는 풀리지 않는다.
#
# 실행: python scripts/swap-chart.py [pptx경로]
import glob
import os
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFont

SHOTS = r"C:\Users\hsh\Desktop\공모전"
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_B = r"C:\Windows\Fonts\malgunbd.ttf"

TARGET = "ppt/media/image5.png"  # 6쪽 차트
SIZE = (1200, 650)

YELLOW = "#C8922A"
INK = "#191512"
INK_SOFT = "#5C534A"
RULE = "#E3DBCD"
RED = "#C05A48"

BARS = [("접근", 96.5, YELLOW), ("활용", 80.0, YELLOW), ("역량", 65.6, RED)]


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def center(d, text, cx, y, font, fill=INK):
    d.text((cx - d.textlength(text, font=font) / 2, y), text, font=font, fill=fill)


def draw_chart(path: str) -> None:
    im = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    d.text((20, 10), "고령층 디지털정보화 수준 — 부문별 (%)", font=f(34, True), fill=INK)
    d.text((20, 58), "일반 국민 대비. 종합 71.4%로 4대 취약계층 중 최하위", font=f(24), fill=INK_SOFT)

    base_y = 520
    top_y = 130
    x0, bw, gap = 120, 200, 130
    for i, (name, v, col) in enumerate(BARS):
        x = x0 + i * (bw + gap)
        h = (base_y - top_y) * (v / 100)
        d.rectangle((x, base_y - h, x + bw, base_y), fill=col)
        center(d, f"{v}%", x + bw / 2, base_y - h - 48, f(38, True), INK)
        center(d, name, x + bw / 2, base_y + 18, f(30, True), INK)

    d.line((60, base_y, 1140, base_y), fill=RULE, width=3)

    # 격차를 눈으로 보이게 — 이 그림의 요지다.
    d.text((20, 585), "접근 96.5 → 역량 65.6 · 31%p 격차", font=f(30, True), fill=RED)
    d.text((560, 592), "기기는 손에 있는데, 다룰 줄을 모릅니다", font=f(26), fill=INK_SOFT)

    im.save(path)


def main() -> None:
    deck = sys.argv[1] if len(sys.argv) > 1 else max(
        glob.glob(os.path.join(SHOTS, "KB_기술설명서*.pptx")), key=os.path.getmtime)

    work = os.path.join(os.environ.get("TEMP", "."), "kbchart.png")
    draw_chart(work)
    new = open(work, "rb").read()

    zin = zipfile.ZipFile(deck)
    tmp = deck + ".tmp"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    hit = False
    for item in zin.infolist():
        if item.filename == TARGET:
            zout.writestr(item, new)
            hit = True
        else:
            zout.writestr(item, zin.read(item.filename))
    zout.close()
    zin.close()
    if not hit:
        os.remove(tmp)
        raise SystemExit(f"{TARGET} 을 찾지 못했습니다")
    os.replace(tmp, deck)
    print(f"차트 교체 → {deck}")


if __name__ == "__main__":
    main()
