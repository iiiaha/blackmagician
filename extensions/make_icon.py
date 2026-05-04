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
DEFAULT_BG = "#ffffff"        # pure white
DEFAULT_FG = "#1a2536"        # deep slate, near-black with a blue undertone
DEFAULT_BORDER = "#0f92d1"    # mid blue stroke around the rounded rect
RADIUS_RATIO = 0.22           # corner radius as fraction of size
TEXT_SCALE = 0.45             # font size as fraction of icon size — keep some breathing room around letters
BORDER_WIDTH_RATIO = 0.012    # stroke thickness as fraction of output size; floor at 1px
SIZES = (24, 32)              # SketchUp toolbar small / large modes
LISTING_SIZE = 512            # high-res render for homepage / EW listing thumbnails

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
    # Render at 4× then downscale to get crisper antialiased edges,
    # especially for the 24px size which suffers without supersampling.
    scale = 4
    canvas = size * scale
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Stroke width is based on output size (with a 1px floor) and then
    # scaled up to the supersampled canvas, so both 24px and 512px land
    # on a visually thin outline rather than scaling proportionally.
    stroke = max(1, round(size * BORDER_WIDTH_RATIO)) * scale
    radius = int(canvas * RADIUS_RATIO)
    # Inset by half-stroke so the outline isn't clipped by the canvas edge.
    inset = stroke // 2
    draw.rounded_rectangle(
        (inset, inset, canvas - 1 - inset, canvas - 1 - inset),
        radius=radius - inset,
        fill=bg,
        outline=border,
        width=stroke,
    )

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
        help='toolbar icon filename prefix (default "icon" — matches dialog.rb expectations)',
    )
    parser.add_argument(
        "--no-listing",
        action="store_true",
        help=f"skip the {LISTING_SIZE}px listing.png render (default: also write extensions/{{slug}}/listing.png)",
    )
    args = parser.parse_args()

    letters = args.letters.strip().upper()
    if len(letters) != 2:
        raise SystemExit(f"letters must be exactly 2 chars, got {len(letters)}")

    ext_dir = Path(__file__).parent / args.slug
    icons_dir = ext_dir / args.slug / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    for size in SIZES:
        img = render_icon(letters, size, args.color, args.fg)
        out = icons_dir / f"{args.prefix}_{size}.png"
        img.save(out)
        print(f"wrote {out}")

    # High-res listing render for homepage / EW thumbnails — sibling to the
    # body folder so it doesn't get bundled into the RBZ.
    if not args.no_listing:
        img = render_icon(letters, LISTING_SIZE, args.color, args.fg)
        out = ext_dir / "listing.png"
        img.save(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
