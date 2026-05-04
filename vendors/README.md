# vendors/

Standalone vendor SketchUp extensions. Each vendor that opts out of the
shared Black Magician library and ships its own extension lives here.

Folder name = vendor slug (matches `vendors.slug` in the database). The
slug is the contract used by the web app's vendor mode
(`https://blackmagician.pages.dev?vendor={slug}`).

## Layout

```
vendors/
  build.py                  # generic RBZ builder (any slug)
  README.md                 # this file
  {slug}/
    {slug}.rb               # SketchupExtension loader (sibling-named)
    {slug}/                 # extension body (icons + core/, sibling)
      core/
      icons/
    data/                   # vendor materials (xlsx, contracts, etc.) — excluded from RBZ
    dist/                   # build output, gitignored
```

The double-naming (`vendors/younhyun/younhyun.rb` next to
`vendors/younhyun/younhyun/`) is intentional — SketchUp's
`SketchupExtension` ctor expects the loader and the body folder to sit
side-by-side with the same name, which is also the structure required at
the root of the final RBZ. Keeping the same shape in source means the
build script just zips the two.

## Adding a new vendor

1. Create the row in the admin UI with `slug` set.
2. Scaffold `vendors/{slug}/{slug}.rb` and `vendors/{slug}/{slug}/`. The
   easiest path is to copy `vendors/younhyun/` and rename references.
3. Update `LIBRARY_URL` inside the loader's dialog code to
   `https://blackmagician.pages.dev?vendor={slug}`.
4. Build: `python vendors/build.py {slug}` → `vendors/{slug}/dist/{slug}.rbz`
5. Sign / distribute as usual.

## Build notes

- `build.py` writes explicit directory entries into the zip. Signed RBZs
  require this; `Compress-Archive` strips them out.
- `data/` is the vendor's working area for raw materials (product
  spreadsheets, contracts, etc.). Stays in source control but is never
  included in the shipped RBZ.
