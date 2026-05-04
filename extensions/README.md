# extensions/

All SketchUp extensions built by this repo. The main Black Magician
platform extension and every standalone vendor extension share the
same folder shape so a single build script handles all of them.

```
extensions/
  build.py                  # generic RBZ builder (any slug)
  make_icon.py              # two-letter toolbar icon generator
  README.md                 # this file
  blackmagician/            # main platform extension
    blackmagician.rb
    blackmagician/
      core/
      icon.png              # single 512px asset; SketchUp downscales for toolbar
    blackmagician.rbz       # latest build, overwritten by build.py
  {slug}/                   # standalone vendor extensions
    {slug}.rb
    {slug}/
      core/
      icon.png              # single 512px asset
    data/                   # vendor materials (xlsx, contracts, etc.) — excluded from RBZ
    {slug}.rbz              # latest build, overwritten by build.py
```

Single-PNG icon convention matches the iiiaha utility extensions
(cliptomat, alignplus, etc.): `dialog.rb` points both `cmd.small_icon`
and `cmd.large_icon` at the same `icon.png`, and SketchUp scales it for
each toolbar mode. The same file doubles as the homepage / Extension
Warehouse listing thumbnail. The in-dialog brand logo (the one that
appears in the dialog's top-left) is served from
`website/public/{slug}_logo.png` and is not bundled in the RBZ.

The double-naming (`{slug}/{slug}.rb` next to `{slug}/{slug}/`) is
intentional. SketchUp's `SketchupExtension` ctor expects the loader and
the body folder to sit side-by-side under the same name, and the same
shape is required at the root of the final RBZ. Keeping that shape in
source means the build is just a zip of the two paths.

## Building

```
python extensions/build.py black_magician
python extensions/build.py younhyun
```

Output lands directly in `extensions/{slug}/{slug}.rbz`, replacing the
previous build. The script writes explicit zip directory entries —
required for code-signed RBZs. PowerShell `Compress-Archive` strips them
out and signing fails.

## Adding a new standalone vendor

1. Add the row in admin UI with `slug` set.
2. `cp -r extensions/younhyun extensions/{slug}` and rename the loader
   `younhyun.rb` → `{slug}.rb` and the body folder `younhyun/` → `{slug}/`.
3. Update `LIBRARY_URL` inside the loader's dialog code to
   `https://blackmagician.pages.dev?vendor={slug}`.
4. Generate fresh toolbar icons:
   ```
   python extensions/make_icon.py {slug} XX
   ```
   Writes the two PNGs into `extensions/{slug}/{slug}/icons/`.
5. `python extensions/build.py {slug}` and ship the RBZ.

## Notes

- `data/` (vendor side only) is the working area for raw materials. Stays
  in source control but is never bundled into the RBZ.
- `_c.rbz` is the signature-suffixed build returned by SketchUp Extension
  Warehouse. Untracked, lives next to `{slug}.rbz`.
- Don't change a slug after the extension has shipped — installed users
  would get a parallel install rather than an upgrade.
