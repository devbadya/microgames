#!/usr/bin/env python3
"""Crop frames from Quaternius Dinosaur Animated Pack Preview.gif into PNG sprites.

Reads the gif from TMP_PREVIEW_GIF env, or ../../tmp/Dinosaur Animated Pack - Dec 2018/Preview.gif
Writes to ../../public/games/dino-run/preview-sprites/ relative to repo root unless OUT_DIR set.

Requires Pillow: pip install pillow
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image, ImageSequence  # pip install pillow

_here = Path(__file__).resolve()
REPO = _here.parent.parent

DEFAULT_GIF = REPO / "tmp/Dinosaur Animated Pack - Dec 2018/Preview.gif"
OUT_DIR = Path(os.environ.get("OUT_DIR", REPO / "public/games/dino-run/preview-sprites"))

# 10x10 frame grid in Preview.gif; each row block is one species’ run segment.
SKIN_SEGMENTS = {
    "velociraptor": (0, 19),
    "parasaurolophus": (20, 29),
    "trex": (30, 49),
    "stegosaurus": (50, 69),
    "triceratops": (70, 89),
    "apatosaurus": (90, 99),
}


def bbox_non_white(rgb_im: Image.Image, thresh: int = 246) -> tuple[int, int, int, int]:
    px = rgb_im.load()
    w, h = rgb_im.size
    minx, miny = w, h
    maxx, maxy = -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            if r >= thresh and g >= thresh and b >= thresh:
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        return 0, 0, w - 1, h - 1
    return minx, miny, maxx, maxy


def crop_and_scale(im: Image.Image, max_side: int = 420, pad: int = 8) -> Image.Image:
    bbox = bbox_non_white(im.convert("RGB"))
    x0, y0, x1, y1 = bbox
    im = im.crop((x0, y0, x1 + 1, y1 + 1)).convert("RGBA")
    wp, hp = im.size
    nw = max(wp + 2 * pad, 2)
    nh = max(hp + 2 * pad, 2)
    canvas = Image.new("RGBA", (nw, nh), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    cw, ch = canvas.size
    side = max(cw, ch)
    if side > max_side:
        ratio = max_side / side
        canvas = canvas.resize(
            (max(1, int(cw * ratio)), max(1, int(ch * ratio))),
            Image.Resampling.LANCZOS,
        )
    return canvas


def pick_four(lo: int, hi: int) -> list[int]:
    span = hi - lo
    if span <= 0:
        return [lo] * 4
    step = span / 3
    idxs = [int(round(lo + i * step)) for i in range(4)]
    return [max(lo, min(hi, i)) for i in idxs]


def main() -> int:
    gif_path = Path(os.environ.get("TMP_PREVIEW_GIF", DEFAULT_GIF))
    if not gif_path.is_file():
        print("Missing Preview.gif at", gif_path, file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    gif = Image.open(gif_path)
    frames = [frame.copy() for frame in ImageSequence.Iterator(gif)]

    for skin, (lo, hi) in SKIN_SEGMENTS.items():
        for i, fi in enumerate(pick_four(lo, hi)):
            crop_and_scale(frames[fi]).save(
                OUT_DIR / f"{skin}-run-{i}.png",
                optimize=True,
            )
        jf = (lo + hi) // 2
        crop_and_scale(frames[jf]).save(OUT_DIR / f"{skin}-jump.png", optimize=True)

    print("Wrote sprites to", OUT_DIR)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
