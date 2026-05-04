#!/usr/bin/env python3
"""Generate two-letter toolbar icons (24/32/128 PNG) for vendor extensions.

Usage:
    python extensions/make_icon.py younhyun YH
    python extensions/make_icon.py marbello MB
    python extensions/make_icon.py jibokdeuk JB --color "#3a5269"

Renders three sizes of a rounded-square icon with two uppercase letters
centered. Output lands at extensions/{slug}/{slug}/icons/{prefix}_{size}.png
which is what dialog.rb expects when its icon path is built from PLUGIN_DIR.

Defaults match the Black Magician web brand (slate blue #49637a + white).
Tune the constants below or pass --color / --fg to switch.

Requires: pip install pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


# ── Style defaults — edit here for a different baseline ─────────────────
DEFAULT_BG = "#49637a"        # slate blue, matches the brand
DEFAULT_FG = "#ffffff"
RADIUS_RATIO = 0.22           # corner radius as fraction of size
TEXT_SCALE = 0.55             # font size as fraction of icon size
SIZES = (24, 32, 128)

# Pretendard preferred. Falls through Arial Bold / Calibri Bold / system.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/Pretendard-Bold.ttf",
    "C:/Windows/Fonts/Pretendard-ExtraBold.ttf",
    "C:/Windows/Fonts/PretendardVariable.ttf",
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


def render_icon(letters: str, size: int, bg: str, fg: str) -> Image.Image:
    # Render at 4× then downscale to get crisper antialiased edges,
    # especially for the 24px size which suffers without supersampling.
    scale = 4
    canvas = size * scale
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(canvas * RADIUS_RATIO)
    draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=radius, fill=bg)

    font = find_font(int(canvas * TEXT_SCALE))
    bbox = draw.textbbox((0, 0), letters, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    # textbbox is ascent-aligned; subtract bbox offsets to truly center.
    x = (canvas - text_w) // 2 - bbox[0]
    y = (canvas - text_h) // 2 - bbox[1]
    draw.text((x, y), letters, font=font, fill=fg)

    return img.resize((size, size), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug", help="extension slug, e.g. younhyun")
    parser.add_argument("letters", help="two uppercase letters, e.g. YH")
    parser.add_argument(
        "--color",
        default=DEFAULT_BG,
        help=f"background color (default {DEFAULT_BG})",
    )
    parser.add_argument(
        "--fg",
        default=DEFAULT_FG,
        help=f"foreground color (default {DEFAULT_FG})",
    )
    parser.add_argument(
        "--prefix",
        default="icon",
        help='output filename prefix (default "icon" — matches younhyun dialog.rb)',
    )
    args = parser.parse_args()

    letters = args.letters.strip().upper()
    if len(letters) != 2:
        raise SystemExit(f"letters must be exactly 2 chars, got {len(letters)}")

    out_dir = Path(__file__).parent / args.slug / args.slug / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        img = render_icon(letters, size, args.color, args.fg)
        out = out_dir / f"{args.prefix}_{size}.png"
        img.save(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
