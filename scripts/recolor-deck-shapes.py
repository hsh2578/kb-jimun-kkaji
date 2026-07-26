# 기획서의 '도형 색'을 KB 색으로 바꾼다.
#
# 이미지만 바꿨더니 여전히 초록이 보였다. 헤더 바·강조 박스의 색은 그림이 아니라
# XML 의 srgbClr 값이라 이미지 교체로는 잡히지 않는다(실측: 8쪽 헤더가 청록).
#
# 색을 고르는 기준:
#   · 흰 글자가 얹힌 진한 청록은 '진한 금갈색'으로 — 노랑으로 바꾸면 흰 글자가 안 읽힌다.
#   · 올리브·라임은 KB 앰버로.
#   · 회색빛 중성색은 살짝 따뜻하게만 — 완전히 바꾸면 대비가 무너진다.
#   · 빨강(#C05A48)은 경고색이므로 그대로 둔다.
#
# 실행: python scripts/recolor-deck-shapes.py [pptx경로]
import glob
import os
import re
import sys
import zipfile

SHOTS = r"C:\Users\hsh\Desktop\공모전"

if len(sys.argv) > 1:
    DECK = sys.argv[1]
else:
    _c = glob.glob(os.path.join(SHOTS, "KB_기술설명서*.pptx"))
    if not _c:
        raise SystemExit("기획서를 찾을 수 없습니다")
    DECK = max(_c, key=os.path.getmtime)

# 원래색 → KB색
COLORS = {
    "104F4B": "2E2417",  # 진한 청록 헤더 → 진한 먹갈색 (흰 글자 유지)
    "2A5A55": "3A2E1D",  # 진한 청록 변주
    "187A74": "9A7A1C",  # 청록 헤더 바 → 진한 금색 (흰 글자 읽힘)
    "6F862E": "C8922A",  # 올리브 → KB 앰버
    "9BBB59": "D8A83A",  # 오피스 기본 초록 → 밝은 앰버
    "C5DC87": "F2DFA0",  # 연한 라임 → 연한 금색
    "CCEAE7": "F6ECD9",  # 연한 청록 → 연한 크림
    "DDEAE8": "F2EADC",
    "E7F1E9": "F5EFE4",
    "ECF1E3": "F6F1E6",
    # 중성색 — 초록빛만 걷어내고 따뜻하게
    "222A2B": "201B15",
    "626E6E": "6E655A",
    "D2DAD8": "DED7CB",
    "D5DDDD": "E0D9CD",
    "BCC4C4": "C8BFB1",
    "F1F3F2": "F5F2EC",
}

TARGETS = re.compile(r"ppt/(slides|slideLayouts|slideMasters|theme)/.*\.xml$")


def main() -> None:
    zin = zipfile.ZipFile(DECK)
    tmp = DECK + ".tmp"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    swapped = 0
    cleaned = 0

    for item in zin.infolist():
        data = zin.read(item.filename)
        if TARGETS.match(item.filename):
            xml = data.decode("utf-8")

            # ① 초록 계열을 KB 색으로
            def sub(m):
                nonlocal swapped
                old = m.group(1).upper()
                new = COLORS.get(old)
                if new:
                    swapped += 1
                    return f'srgbClr val="{new}"'
                return m.group(0)

            xml = re.sub(r'srgbClr val="([0-9A-Fa-f]{6})"', sub, xml)

            # ② U+2028(줄바꿈 문자) 제거.
            # 빌드 때 \n 을 이 문자로 넣었는데 PowerPoint 가 네모 기호로 그린다(실측 8쪽).
            if "\u2028" in xml or "\u2029" in xml:
                cleaned += xml.count("\u2028") + xml.count("\u2029")
                xml = xml.replace("\u2028", " ").replace("\u2029", " ")

            data = xml.encode("utf-8")
        zout.writestr(item, data)

    zout.close()
    zin.close()
    os.replace(tmp, DECK)
    print(f"색상 교체 {swapped}곳 · 줄바꿈 기호 제거 {cleaned}개")
    print(f"저장 → {DECK}")


if __name__ == "__main__":
    main()
