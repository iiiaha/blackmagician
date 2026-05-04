#!/usr/bin/env python3
"""Build a SketchUp extension RBZ from sources under extensions/{slug}/.

Usage:
    python extensions/build.py black_magician
    python extensions/build.py younhyun
    python extensions/build.py younhyun --output some/where

Packages {slug}.rb + {slug}/ from extensions/{slug}/ into a SketchUp RBZ.
The zip includes explicit directory entries — required for code-signed
RBZs. PowerShell's Compress-Archive omits them and signing fails.

Output defaults to the extension's own folder (extensions/{slug}/{slug}.rbz),
overwriting the previous build so there is only ever one canonical RBZ.

The data/ subfolder (vendor materials, contracts, xlsx product lists, etc.)
is intentionally excluded from the RBZ.
"""
import argparse
import os
import zipfile
from pathlib import Path


def build_rbz(slug: str, output_dir: Path) -> Path:
    ext_dir = Path(__file__).parent / slug
    if not ext_dir.is_dir():
        raise SystemExit(f"extensions/{slug}/ not found")

    loader = ext_dir / f"{slug}.rb"
    body = ext_dir / slug
    if not loader.is_file():
        raise SystemExit(f"missing loader: extensions/{slug}/{slug}.rb")
    if not body.is_dir():
        raise SystemExit(f"missing body folder: extensions/{slug}/{slug}/")

    output_dir.mkdir(parents=True, exist_ok=True)
    rbz_path = output_dir / f"{slug}.rbz"

    with zipfile.ZipFile(rbz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(loader, f"{slug}.rb")
        for root, _dirs, files in os.walk(body):
            rel_root = Path(root).relative_to(ext_dir).as_posix()
            zf.writestr(rel_root + "/", "")
            for f in files:
                full = Path(root) / f
                rel = full.relative_to(ext_dir).as_posix()
                zf.write(full, rel)

    return rbz_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("slug", help="extension slug, e.g. black_magician or younhyun")
    parser.add_argument(
        "--output",
        default=None,
        help="output directory (default: extensions/{slug}/)",
    )
    args = parser.parse_args()

    out = (
        Path(args.output)
        if args.output
        else Path(__file__).parent / args.slug
    )
    rbz = build_rbz(args.slug, out)
    print(f"Built {rbz}")
