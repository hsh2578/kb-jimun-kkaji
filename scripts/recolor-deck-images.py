# 기획서 이미지를 KB 색으로 바꾸고, iM 목업을 우리 화면으로 갈아끼운다.
#
# 배경(image1·image3)과 차트(image5·image6)는 iM 초록이다. 색상만 KB 노랑 계열로
# 돌린다 — 도형을 다시 그릴 수는 없으므로, 색상환에서 연두~파랑 구간을 노랑 쪽으로
# 밀어버린다. 회색·검정은 채도가 낮아 영향을 받지 않는다.
#
# 목업(image2·image4·image10)에는 "iM AI뱅크" 글자가 그림 안에 박혀 있어
# 색만 바꿔서는 안 된다. 우리 화면 캡처로 통째로 교체한다.
#
# 실행: python scripts/recolor-deck-images.py
import glob
import os
import shutil
import sys
import zipfile

from PIL import Image

SHOTS = r"C:\Users\hsh\Desktop\공모전"

# 인자로 받거나, 가장 최근에 만들어진 기술설명서를 고른다.
# (PowerPoint 로 열어둔 파일은 잠기므로 build 스크립트가 _v2 로 떨어뜨릴 때가 있다.)
if len(sys.argv) > 1:
    DECK = sys.argv[1]
else:
    _c = glob.glob(os.path.join(SHOTS, "KB_기술설명서*.pptx"))
    if not _c:
        raise SystemExit("기술설명서를 찾을 수 없습니다")
    DECK = max(_c, key=os.path.getmtime)

# 초록 계열을 KB 노랑으로. OpenCV 없이 HSV 채널을 직접 손본다.
# PIL 의 H 는 0~255 (0=빨강, 85=초록, 170=파랑).
# 처음 60 부터 잡았더니 연두색이 그대로 남았다 — 45~60 구간까지 내려야 한다.
GREEN_LO, GREEN_HI = 40, 200
KB_HUE = 30                    # 노랑~호박


def to_kb(src: str, dst: str) -> None:
    im = Image.open(src)
    alpha = im.getchannel("A") if im.mode in ("RGBA", "LA") else None
    hsv = im.convert("RGB").convert("HSV")
    h, s, v = hsv.split()
    hp, sp = h.load(), s.load()
    w, ht = im.size
    for y in range(ht):
        for x in range(w):
            # 채도 12 로 잘랐더니 아주 연한 청록 배경이 그대로 남았다(실측 8쪽 오른쪽).
            # 옅은 색일수록 눈에는 '초록기'로 보이므로 4 까지 내린다.
            if GREEN_LO <= hp[x, y] <= GREEN_HI and sp[x, y] > 4:
                hp[x, y] = KB_HUE
    out = Image.merge("HSV", (h, s, v)).convert("RGB")
    if alpha is not None:
        out = out.convert("RGBA")
        out.putalpha(alpha)
    out.save(dst)


def fit(src: str, dst: str, size: tuple[int, int]) -> None:
    """원본 이미지 자리에 맞춰 넣는다. 비율을 유지하고 남는 곳은 종이색으로 채운다.

    크기가 어긋나면 PowerPoint 가 도형 크기에 맞춰 늘려버려 화면이 찌그러진다.
    """
    im = Image.open(src).convert("RGB")
    im.thumbnail(size, Image.LANCZOS)
    canvas = Image.new("RGB", size, (247, 243, 236))  # --paper
    canvas.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    canvas.save(dst)


def main() -> None:
    work = os.path.join(os.environ.get("TEMP", "."), "kbdeck")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)

    zin = zipfile.ZipFile(DECK)
    sizes = {}
    for n in zin.namelist():
        if n.startswith("ppt/media/") and not n.endswith("/"):
            p = os.path.join(work, os.path.basename(n))
            with zin.open(n) as s, open(p, "wb") as f:
                shutil.copyfileobj(s, f)
            sizes[os.path.basename(n)] = Image.open(p).size

    # ① 초록 → KB 노랑
    for name in ["image1.png", "image3.png", "image5.png", "image6.png"]:
        p = os.path.join(work, name)
        to_kb(p, p)
        print(f"  색상 변환 {name}")

    # ② iM 목업 → 우리 화면
    swap = {
        "image2.png": "kb-phone-auth.png",  # 표지·데모 — 세로 틀이므로 폰만 (가로 캡처는 여백이 크다)
        "image10.png": "kb-demo-main.png",  # 안내 vs 실행 — 우리 쪽
        "image4.png": "kb-welcome.png",     # 목차 — 초대 화면
    }
    for target, shot in swap.items():
        src = os.path.join(SHOTS, shot)
        if not os.path.exists(src):
            print(f"  ! 캡처 없음: {src}")
            continue
        fit(src, os.path.join(work, target), sizes[target])
        print(f"  교체 {target} ← {shot}")

    # ③ 다시 담는다
    tmp = DECK + ".new"
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        base = os.path.basename(item.filename)
        p = os.path.join(work, base)
        if item.filename.startswith("ppt/media/") and os.path.exists(p):
            zout.writestr(item, open(p, "rb").read())
        else:
            zout.writestr(item, zin.read(item.filename))
    zout.close()
    zin.close()
    os.replace(tmp, DECK)
    print(f"저장 → {DECK}")


if __name__ == "__main__":
    main()
