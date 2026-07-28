# 그림에 쓴 글자 중 글꼴에 없는 것을 찾는다.
#
# 맑은고딕에 ✕(U+2715)와 ✓(U+2713)가 없다. 없는 글자를 그리면 PIL 은 조용히
# .notdef 글리프(네모)를 찍는다 — 오류도 경고도 없다. 그래서 18쪽 「LLM에
# 나가지 않는 것」 목록이 네모 다섯 개로 나가 있었는데, 렌더링을 눈으로 볼
# 때까지 아무도 몰랐다. 하필 이 문서의 핵심 주장을 담은 박스였다.
#
# 빌드할 때마다 돌려서 같은 일이 되풀이되지 않게 한다.
#
# 실행: python scripts/check-glyphs.py
import glob
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = [r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\malgunbd.ttf"]

# 한글·영문·숫자·기본 문장부호는 검사에서 뺀다. 기호만 본다.
SKIP = re.compile(
    r"[\uAC00-\uD7A3\u3131-\u318E"      # 한글
    r"a-zA-Z0-9"                         # 영숫자
    r"\s.,:;!?()\[\]{}<>/\\|'\"`~@#$%^&*_+=-"
    r"\u201C\u201D\u2018\u2019"          # 따옴표
    r"]"
)


def notdef_ref(font):
    """그 글꼴의 '없는 글자' 모양을 사설영역 문자로 떠 둔다."""
    im = Image.new("L", (80, 80), 0)
    ImageDraw.Draw(im).text((6, 6), "\ue000", font=font, fill=255)
    return im.tobytes()


def render(font, ch):
    im = Image.new("L", (80, 80), 0)
    ImageDraw.Draw(im).text((6, 6), ch, font=font, fill=255)
    return im.tobytes()


def main() -> None:
    files = sorted(glob.glob(os.path.join(HERE, "make-*.py"))) + \
        [os.path.join(HERE, "slide_kit.py")]

    # 소스에서 문자열 리터럴만 긁어 검사 대상 글자를 모은다.
    # 주석은 먼저 걷어낸다 — 안 그러면 "✕는 글꼴에 없다"고 적은 주석 자체가
    # 걸려서 검사기가 자기 설명을 오류로 보고한다(실제로 그랬다).
    chars = {}
    for path in files:
        src = open(path, encoding="utf-8").read()
        src = "\n".join(re.sub(r"#.*$", "", ln) for ln in src.splitlines())
        for lit in re.findall(r'"([^"\\]*)"|\'([^\'\\]*)\'', src):
            for text in lit:
                for ch in text:
                    if not SKIP.match(ch):
                        chars.setdefault(ch, set()).add(os.path.basename(path))

    bad = []
    for path in FONTS:
        font = ImageFont.truetype(path, 40)
        ref = notdef_ref(font)
        for ch, where in sorted(chars.items()):
            if render(font, ch) == ref:
                bad.append((ch, os.path.basename(path), sorted(where)))

    if not bad:
        print(f"글꼴 검사 통과 — 기호 {len(chars)}종 모두 정상")
        return

    print("글꼴에 없는 글자를 찾았습니다 (화면에 네모로 나갑니다):")
    for ch, font, where in bad:
        print(f"  {ch!r} U+{ord(ch):04X}  [{font}]  → {', '.join(where)}")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
