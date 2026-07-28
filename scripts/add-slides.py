# 기획서에 슬라이드를 새로 붙인다.
#
# 원본(iM 기획서)은 26장뿐이라 개발 계획을 늘리려면 장 자체를 만들어야 한다.
# 새 장은 어차피 그림으로 덮으므로(overlay-figure.py), 기존 장 하나를 복제해
# 빈 캔버스로 쓴다. 복제는 네 곳을 함께 고쳐야 PowerPoint 가 파일을 연다:
#   ① ppt/slides/slideN.xml           — 장 내용
#   ② ppt/slides/_rels/slideN.xml.rels — 그 장이 참조하는 것들
#   ③ [Content_Types].xml              — 새 장의 종류 선언
#   ④ ppt/_rels/presentation.xml.rels + ppt/presentation.xml 의 sldIdLst
# 하나라도 빠지면 '복구가 필요합니다'가 뜬다.
#
# 붙일 자리는 build-kb-deck.py 의 ORDER 가 정한다 — 26보다 큰 번호가 새 장이다.
#
# 실행: python scripts/add-slides.py <pptx>
import importlib.util
import os
import re
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CLONE_FROM = 22  # 복제 원본 — 배경만 쓰므로 어느 장이든 상관없다
CT_SLIDE = ("application/vnd.openxmlformats-officedocument."
            "presentationml.slide+xml")
REL_SLIDE = ("http://schemas.openxmlformats.org/officeDocument/2006/"
             "relationships/slide")


def load_order():
    spec = importlib.util.spec_from_file_location(
        "_bk", os.path.join(HERE, "build-kb-deck.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.ORDER


def blank_text(xml: str) -> str:
    return re.sub(r"(<a:t>)(.*?)(</a:t>)", r"\1\3", xml, flags=re.S)


def main() -> None:
    deck = sys.argv[1]
    order = load_order()
    existing = [n for n in order if n <= 26]
    new = [n for n in order if n > 26]
    if not new:
        print("새로 붙일 장이 없습니다")
        return

    zin = zipfile.ZipFile(deck)
    names = set(zin.namelist())
    src_xml = zin.read(f"ppt/slides/slide{CLONE_FROM}.xml").decode("utf-8")
    src_rels = zin.read(f"ppt/slides/_rels/slide{CLONE_FROM}.xml.rels").decode("utf-8")
    ct = zin.read("[Content_Types].xml").decode("utf-8")
    prels = zin.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
    pxml = zin.read("ppt/presentation.xml").decode("utf-8")

    used_rid = {int(x) for x in re.findall(r'Id="rId(\d+)"', prels)}
    used_sid = {int(x) for x in re.findall(r'<p:sldId id="(\d+)"', pxml)}

    added = {}
    rid_of = {}
    for n in new:
        if f"ppt/slides/slide{n}.xml" in names:
            raise SystemExit(f"slide{n}.xml 이 이미 있습니다")
        # 글자는 비운다 — 원본 장의 문장이 새 장에 남으면 안 된다.
        added[f"ppt/slides/slide{n}.xml"] = blank_text(src_xml).encode("utf-8")
        added[f"ppt/slides/_rels/slide{n}.xml.rels"] = src_rels.encode("utf-8")

        r = 1
        while r in used_rid:
            r += 1
        used_rid.add(r)
        rid_of[n] = f"rId{r}"

        ct = ct.replace("</Types>",
                        f'<Override PartName="/ppt/slides/slide{n}.xml" '
                        f'ContentType="{CT_SLIDE}"/></Types>')
        prels = prels.replace("</Relationships>",
                              f'<Relationship Id="{rid_of[n]}" Type="{REL_SLIDE}" '
                              f'Target="slides/slide{n}.xml"/></Relationships>')

    # sldIdLst 를 ORDER 대로 다시 만든다.
    m = re.search(r"(<p:sldIdLst>)(.*?)(</p:sldIdLst>)", pxml, re.S)
    if not m:
        raise SystemExit("슬라이드 목록을 찾지 못했습니다")
    cur = re.findall(r"<p:sldId[^>]*/>", m.group(2))
    if len(cur) != len(existing):
        raise SystemExit(f"기존 장 수가 맞지 않습니다: {len(cur)} vs {len(existing)}")
    by_src = dict(zip(existing, cur))  # build 단계에서 이미 ORDER 순으로 놓였다

    sid = max(used_sid) + 1
    for n in new:
        by_src[n] = f'<p:sldId id="{sid}" r:id="{rid_of[n]}"/>'
        sid += 1

    pxml = pxml[: m.start(2)] + "".join(by_src[n] for n in order) + pxml[m.end(2) :]

    patched = {
        "[Content_Types].xml": ct.encode("utf-8"),
        "ppt/_rels/presentation.xml.rels": prels.encode("utf-8"),
        "ppt/presentation.xml": pxml.encode("utf-8"),
    }

    tmp = deck + ".tmp"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = patched.get(item.filename)
        zout.writestr(item, data if data is not None else zin.read(item.filename))
    for path, blob in added.items():
        zout.writestr(path, blob)
    zout.close()
    zin.close()
    shutil.move(tmp, deck)
    print(f"{len(new)}장 추가: {new} · 총 {len(order)}장")


if __name__ == "__main__":
    main()
