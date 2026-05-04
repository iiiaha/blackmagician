#!/usr/bin/env python3
"""Generate a single high-resolution toolbar icon for vendor extensions.

Usage:
    python extensions/make_icon.py younhyun YH
    python extensions/make_icon.py marbello MB
    python extensions/make_icon.py jibokdeuk JB --color "#3a5269"

Renders ONE 512px PNG with two uppercase letters centered on a rounded
rect with a thin border. Output lands at extensions/{slug}/{slug}/icon.png
(body root). dialog.rb sets `cmd.small_icon` and `cmd.large_icon` to
this same path; SketchUp downscales for whichever toolbar size mode the
user has — same approach as the iiiaha utility extensions.

Defaults: white card, deep slate letters, mid cyan border. Tune via the
constants below or pass --color / --fg / --border.

Requires: pip install pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ── Style defaults — edit here for a different baseline ─────────────────
DEFAULT_BG = "#ffffff"        # pure white card
DEFAULT_FG = "#1a2536"        # deep slate, near-black with a blue undertone
DEFAULT_BORDER = "#0f92d1"    # mid cyan blue stroke around the rounded rect
ICON_SCALE = 0.85             # rounded rect fills this fraction of the PNG; rest is transparent margin
RADIUS_RATIO = 0.22           # corner radius as fraction of icon (not canvas)
TEXT_SCALE = 0.45             # font size as fraction of icon (not canvas)
BORDER_WIDTH_RATIO = 0.008    # stroke thickness as fraction of icon size
ICON_SIZE = 512               # output resolution; SketchUp downscales for toolbar

# Pretendard preferred. ExtraBold first so the letters sit darker against
# the pale background. Falls through Bold / Variable / Arial Bold.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/Pretendard-ExtraBold.ttf",
    "C:/Windows/Fonts/Pretendard-Bold.ttf",
    "C:/Windows/Fonts/PretendardVariable.ttf",
    str(Path.home() / "AppData/Local/Microsoft/Windows/Fonts/Pretendard-ExtraBold.ttf"),
    str(Path.home() / "AppData/Local/Microsoft/Windows/Fonts/Pretendard-Bold.ttf"),
    str(Path.home() / "AppData/Local/Microsoft/Windows/Fonts/PretendardVariable.ttf"),
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/calibrib.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
]


def find_font(size: int) -> ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    print(
        "Warning: no preferred font found — falling back to PIL default. "
        "Install Pretendard-Bold for the intended look.",
        file=sys.stderr,
    )
    return ImageFont.load_default()


def render_icon(letters: str, size: int, bg: str, fg: str, border: str = DEFAULT_BORDER) -> Image.Image:
    # Render at 2× then downscale for crisp edges. Less supersampling than
    # the toolbar version since 512px output is already plenty of headroom.
    scale = 2
    canvas = size * scale
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # The rounded rect doesn't fill the whole PNG — leave transparent
    # margin so SketchUp doesn't crowd it against neighboring toolbar icons.
    icon_size = canvas * ICON_SCALE
    margin = (canvas - icon_size) / 2

    stroke = max(1, round(icon_size * BORDER_WIDTH_RATIO))
    radius = int(icon_size * RADIUS_RATIO)
    inset = stroke // 2
    draw.rounded_rectangle(
        (margin + inset, margin + inset,
         canvas - margin - 1 - inset, canvas - margin - 1 - inset),
        radius=max(1, radius - inset),
        fill=bg,
        outline=border,
        width=stroke,
    )

    font = find_font(int(icon_size * TEXT_SCALE))
    bbox = draw.textbbox((0, 0), letters, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (canvas - text_w) // 2 - bbox[0]
    y = (canvas - text_h) // 2 - bbox[1]
    draw.text((x, y), letters, font=font, fill=fg)

    return img.resize((size, size), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug", help="extension slug, e.g. younhyun")
    parser.add_argument("letters", help="two uppercase letters, e.g. YH")
    parser.add_argument("--color", default=DEFAULT_BG, help=f"background (default {DEFAULT_BG})")
    parser.add_argument("--fg", default=DEFAULT_FG, help=f"letter color (default {DEFAULT_FG})")
    parser.add_argument("--border", default=DEFAULT_BORDER, help=f"border color (default {DEFAULT_BORDER})")
    args = parser.parse_args()

    letters = args.letters.strip().upper()
    if len(letters) != 2:
        raise SystemExit(f"letters must be exactly 2 chars, got {len(letters)}")

    out = Path(__file__).parent / args.slug / args.slug / "icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img = render_icon(letters, ICON_SIZE, args.color, args.fg, args.border)
    img.save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
