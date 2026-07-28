# 슬라이드 한 장을 통째로 그림으로 덮는다.
#
# 왜 필요한가: 이 기획서는 iM 원본의 도형에 텍스트만 갈아끼우는 방식으로 만든다.
# 도형 구성이 단순한 장은 잘 나오지만, 세로 라벨 칸·표·다단 카드가 있는 장은
# 내용이 엉뚱한 칸에 들어가거나(문단 순서와 도형 순서가 다름), 글자가 칸을 넘쳐
# 겹치거나, 좁은 세로 칸에서 한 글자씩 쌓여 읽을 수 없게 된다.
# 실측으로 12·13·15·16·19·22쪽이 그랬다.
#
# 글자를 다듬어서는 못 고친다 — 세로 칸은 애초에 긴 문장이 못 들어가고 표는 행
# 높이가 고정이다. 그래서 그 장의 텍스트를 전부 비우고 그림 한 장을 덮는다.
# 그림은 어디서 열어도 같은 모양으로 나오므로 다시 깨질 수 없다.
#
# 배경 무늬는 남긴다(원본의 장식 그림). 지우는 건 '글상자와 도형의 글자'뿐이다.
#
# 실행: python scripts/overlay-figure.py <pptx> <슬라이드번호>=<png> [...]
#   예: python scripts/overlay-figure.py deck.pptx 12=figures/fig-search.png
import os
import re
import shutil
import sys
import zipfile

NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"

# 배경 장식은 지우지 않는다 — 이 그림들은 원본의 무늬라 덮어도 어색하지 않다.
BACKGROUND_MEDIA = {"image1.png", "image3.png"}


def slide_size(zin: zipfile.ZipFile) -> tuple[int, int]:
    xml = zin.read("ppt/presentation.xml").decode("utf-8")
    m = re.search(r'<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"', xml)
    if not m:
        raise SystemExit("슬라이드 크기를 읽지 못했습니다")
    return int(m.group(1)), int(m.group(2))


def blank_text(xml: str) -> str:
    """모든 <a:t>…</a:t> 의 내용을 비운다.

    문단·런 자체는 남긴다. 지우면 도형이 무너지거나 파일이 깨질 수 있다.
    글자만 없애면 도형은 빈 채로 남고, 그 위를 그림이 덮는다.
    """
    return re.sub(r"(<a:t>)(.*?)(</a:t>)", r"\1\3", xml, flags=re.S)


def next_rel_id(rels: str) -> str:
    used = {int(n) for n in re.findall(r'Id="rId(\d+)"', rels)}
    i = 1
    while i in used:
        i += 1
    return f"rId{i}"


def next_shape_id(xml: str) -> int:
    ids = {int(n) for n in re.findall(r'<p:cNvPr id="(\d+)"', xml)}
    return (max(ids) + 1) if ids else 100


def pic_xml(shape_id: int, rid: str, cx: int, cy: int) -> str:
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{shape_id}" name="figure{shape_id}"/>'
        f'<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
        f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("사용법: overlay-figure.py <pptx> <슬라이드번호>=<png> [...]")

    deck = sys.argv[1]
    jobs = {}
    for arg in sys.argv[2:]:
        n, _, png = arg.partition("=")
        if not png or not os.path.exists(png):
            raise SystemExit(f"그림을 찾을 수 없습니다: {png}")
        jobs[int(n)] = png

    zin = zipfile.ZipFile(deck)
    cx, cy = slide_size(zin)

    names = set(zin.namelist())
    for n in jobs:
        if f"ppt/slides/slide{n}.xml" not in names:
            raise SystemExit(f"{n}쪽이 없습니다")

    # 새 그림은 기존 번호와 겹치지 않게 붙인다.
    used = {int(m) for m in re.findall(r"ppt/media/image(\d+)\.", " ".join(names))}
    nxt = (max(used) + 1) if used else 1

    added, patched = {}, {}
    for n, png in sorted(jobs.items()):
        media = f"image{nxt}.png"
        nxt += 1
        added[f"ppt/media/{media}"] = open(png, "rb").read()

        rels_path = f"ppt/slides/_rels/slide{n}.xml.rels"
        rels = zin.read(rels_path).decode("utf-8")
        rid = next_rel_id(rels)
        rels = rels.replace(
            "</Relationships>",
            f'<Relationship Id="{rid}" Type="{REL_IMAGE}" Target="../media/{media}"/></Relationships>',
        )
        patched[rels_path] = rels.encode("utf-8")

        sxml = zin.read(f"ppt/slides/slide{n}.xml").decode("utf-8")
        sid = next_shape_id(sxml)
        sxml = blank_text(sxml)
        # spTree 의 맨 끝에 넣어야 다른 도형 위에 그려진다.
        sxml = sxml.replace("</p:spTree>", pic_xml(sid, rid, cx, cy) + "</p:spTree>")
        patched[f"ppt/slides/slide{n}.xml"] = sxml.encode("utf-8")

    tmp = deck + ".tmp"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = patched.get(item.filename)
        zout.writestr(item, data if data is not None else zin.read(item.filename))
    for path, blob in added.items():
        zout.writestr(path, blob)
    zout.close()
    zin.close()

    # png 확장자가 [Content_Types] 에 없으면 PowerPoint 가 파일을 못 연다.
    with zipfile.ZipFile(tmp) as z:
        ct = z.read("[Content_Types].xml").decode("utf-8")
    if 'Extension="png"' not in ct:
        raise SystemExit("[Content_Types].xml 에 png 선언이 없습니다 — 수동 확인 필요")

    shutil.move(tmp, deck)
    print(f"{len(jobs)}장을 그림으로 대체: {sorted(jobs)}")


if __name__ == "__main__":
    main()
