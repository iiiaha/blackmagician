#!/usr/bin/env python3
"""Build a vendor extension RBZ from sources under vendors/{slug}/.

Usage:
    python vendors/build.py younhyun
    python vendors/build.py younhyun --output dist

Packages {slug}.rb + {slug}/ from vendors/{slug}/ into a SketchUp RBZ.
The zip includes explicit directory entries — required for code-signed
RBZs. PowerShell's Compress-Archive omits them and signing fails.

The data/ subfolder under each vendor (vendor materials, contracts,
xlsx product lists, etc.) is intentionally excluded from the RBZ.
"""
import argparse
import os
import zipfile
from pathlib import Path


def build_rbz(slug: str, output_dir: Path) -> Path:
    vendor_dir = Path(__file__).parent / slug
    if not vendor_dir.is_dir():
        raise SystemExit(f"vendors/{slug}/ not found")

    loader = vendor_dir / f"{slug}.rb"
    body = vendor_dir / slug
    if not loader.is_file():
        raise SystemExit(f"missing loader: vendors/{slug}/{slug}.rb")
    if not body.is_dir():
        raise SystemExit(f"missing body folder: vendors/{slug}/{slug}/")

    output_dir.mkdir(parents=True, exist_ok=True)
    rbz_path = output_dir / f"{slug}.rbz"

    with zipfile.ZipFile(rbz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(loader, f"{slug}.rb")
        for root, _dirs, files in os.walk(body):
            rel_root = Path(root).relative_to(vendor_dir).as_posix()
            zf.writestr(rel_root + "/", "")
            for f in files:
                full = Path(root) / f
                rel = full.relative_to(vendor_dir).as_posix()
                zf.write(full, rel)

    return rbz_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug", help="vendor slug, e.g. younhyun")
    parser.add_argument(
        "--output",
        default=None,
        help="output directory (default: vendors/{slug}/dist/)",
    )
    args = parser.parse_args()

    out = (
        Path(args.output)
        if args.output
        else Path(__file__).parent / args.slug / "dist"
    )
    rbz = build_rbz(args.slug, out)
    print(f"Built {rbz}")
