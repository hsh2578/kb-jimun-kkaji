# 기획서와 같은 모양의 슬라이드를 그림으로 그리는 도구.
#
# overlay-figure.py 가 슬라이드를 통째로 그림으로 덮는데, 그 그림이 다른 장과
# 달라 보이면 덧씌운 티가 난다. 그래서 원본의 배경 무늬·제목 막대·상단 내비·
# 푸터를 그대로 재현한다. 값은 실제 슬라이드 PNG를 재어서 맞췄다.
#
# 좌표계는 1920x1080 기준이다(원본 슬라이드 13.333x7.5인치와 같은 16:9).
import os

from PIL import Image, ImageDraw, ImageFont

FIG = r"C:\Users\hsh\Desktop\공모전\figures"
BG = os.path.join(FIG, "_bg.png")
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_B = r"C:\Windows\Fonts\malgunbd.ttf"

W, H = 1920, 1080

# 색 — css/style.css 및 recolor-deck-shapes.py 와 같은 값
YELLOW = "#C8922A"
YELLOW_LT = "#E5C77A"
YELLOW_PALE = "#F6ECD9"
INK = "#191512"
INK_SOFT = "#5C534A"
INK_FAINT = "#A89D8F"
PAPER = "#FFFDF8"
PAPER_DIM = "#F5F1E9"
RULE = "#DED7CB"
MACHINE = "#2E2417"
RED = "#C05A48"

FOOT = "2026 제8회 KB Future Finance A.I. Challenge · 개인 참가 황성혁"
# 목차(2쪽)와 같은 네 구간을 쓴다. 라벨이 어긋나 있으면 문서만 읽는
# 심사자가 자기 위치를 잘못 잡는다 — 실측으로 기술 13장이 「해법」으로,
# 개발 계획 5장이 「차별점」으로 강조돼 있었다.
NAV = ["문제", "해법", "기술", "계획"]


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def text_w(d, t, font):
    return d.textlength(t, font=font)


def center(d, t, cx, y, font, fill=INK):
    d.text((cx - text_w(d, t, font) / 2, y), t, font=font, fill=fill)


def right(d, t, rx, y, font, fill=INK):
    d.text((rx - text_w(d, t, font), y), t, font=font, fill=fill)


def box(d, xy, fill=PAPER, outline=RULE, r=16, width=2):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def wrap(d, text, font, max_w):
    """글자 폭을 재어 줄바꿈한다. 한국어는 단어 경계가 성기므로 어절 단위로 자른다."""
    words, lines, cur = text.split(" "), [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if cur and text_w(d, trial, font) > max_w:
            lines.append(cur)
            cur = w_
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def para(d, text, x, y, font, max_w, fill=INK, leading=1.45):
    """줄바꿈해서 그리고, 다음 y 를 돌려준다."""
    lh = int(font.size * leading)
    for line in wrap(d, text, font, max_w):
        d.text((x, y), line, font=font, fill=fill)
        y += lh
    return y


def new_slide(title, subtitle="", page=None, nav_on=0):
    """배경·제목·내비·푸터를 갖춘 빈 슬라이드를 만든다."""
    im = Image.open(BG).convert("RGB").resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(im)

    # 제목 왼쪽의 금색 세로 막대
    d.rectangle((88, 88, 100, 168), fill=YELLOW)
    d.text((128, 88), title, font=f(52, True), fill=INK)
    if subtitle:
        d.text((131, 172), subtitle, font=f(27), fill=INK_SOFT)

    # 상단 내비 — 현재 구간만 진하게
    x = 1430
    for i, t in enumerate(NAV):
        col = INK if i == nav_on else INK_FAINT
        d.text((x, 46), t, font=f(25, True if i == nav_on else False), fill=col)
        x += 104

    d.text((88, 1028), FOOT, font=f(22), fill=INK_FAINT)
    if page is not None:
        right(d, str(page), 1852, 1026, f(24), INK_FAINT)
    return im, d


def band(d, y, text, sub="", x0=100, x1=1820, h=96, fill=MACHINE):
    """어두운 강조 띠 — 그 장의 결론을 한 줄로 박는 자리.

    부제가 없을 땐 글자를 띠 한가운데에 둔다. 고정 여백으로 뒀더니 띠를 얇게
    쓴 장에서 글자가 띠 아래로 삐져나와 잘린 것처럼 보였다(실측 24·25쪽).
    """
    size = 30
    box(d, (x0, y, x1, y + h), fill, fill, 14)
    top = y + 26 if sub else y + (h - size * 1.35) / 2
    d.text((x0 + 32, top), text, font=f(size, True), fill=PAPER)
    if sub:
        d.text((x0 + 32, y + 60), sub, font=f(24), fill=YELLOW_LT)


def card(d, xy, title, lines, head_fill=YELLOW, head_text=PAPER, body_font=25):
    """머리말이 달린 카드. lines 는 (텍스트, 색) 또는 문자열."""
    x0, y0, x1, y1 = xy
    hh = 68
    d.rounded_rectangle((x0, y0, x1, y1), radius=14, fill=PAPER, outline=RULE, width=2)
    d.rounded_rectangle((x0, y0, x1, y0 + hh), radius=14, fill=head_fill)
    d.rectangle((x0, y0 + hh - 14, x1, y0 + hh), fill=head_fill)
    d.text((x0 + 24, y0 + 18), title, font=f(27, True), fill=head_text)

    y = y0 + hh + 22
    for ln in lines:
        t, col = (ln, INK) if isinstance(ln, str) else ln
        y = para(d, t, x0 + 24, y, f(body_font), x1 - x0 - 48, col) + 8
    return y


def save(im, name):
    path = os.path.join(FIG, name)
    im.save(path)
    print(f"  {name}")
    return path
