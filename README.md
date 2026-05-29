# web-clone-recorder

The toolkit used to reverse-engineer and fully clone JS-heavy websites
(Webflow, Nuxt/SPA, GSAP sliders, custom loaders) — capture what a real browser
renders, then rebuild and serve it offline.

The **power tool is Playwright** (real headless browser): static HTML scraping is not
enough for these sites, because the displayed assets are loaded/optimized at runtime.

> No secrets, tokens, or API keys are in this repo. The scripts only drive a headless
> browser against a public URL and serve local files.

## Install

```bash
npm install
npx playwright install chromium
```

Node 18+. (`spa_server.py` needs only Python 3 — no pip deps.)

## The workflow

1. **Capture** the live site with Playwright (`record.mjs`) — video, staged frames,
   full-page screenshot, and a DOM + computed-style dump.
2. **Mirror the real assets** — load the live site, navigate every route, scroll to
   trigger lazy/animation assets, and record every requested URL (images, the
   *optimized* variants like Nuxt `/_ipx/...`, fonts, audio, i18n JSON), then download
   them. (See "Gotchas" — this is where most time is lost.)
3. **Serve offline** with `spa_server.py` — a SPA-fallback + HTTP-Range static server,
   so client-side routes and media seeking work without the original backend.

## Tools

### `record.mjs` — full capture
```bash
node record.mjs <target-url> <output-dir>     # e.g. node record.mjs https://example.com ./out
```
Outputs: session `*.webm`, `frames/load_*|hero_*|hover_*|scroll_*.png`, `full_page.png`,
and `dom-dump.json` (per-section computed styles + element counts).
Tune the `hoverTargets` / `sections` / `counts` selectors to the site you capture.

### `record_scroll.mjs` — scroll-behavior check
```bash
node record_scroll.mjs <target-url>           # -> ./out-scroll/
```

### `record_responsive.mjs` — responsive check
```bash
node record_responsive.mjs                    # edit URL const inside -> ./out-responsive/
```

### `spa_server.py` — offline SPA + Range server
Serve a fully-downloaded clone. Falls back to `index.html` for unknown routes (client-side
routing) and supports HTTP Range (206) so video/audio seeking works.
```bash
python spa_server.py 8013                     # serves the folder it lives in at :8013
```

## Gotchas (hard-won)

- **Real-browser capture, not static scans.** Nuxt `/_ipx/...` optimized WebP are the
  *actual* displayed images; also `/_fonts/`, per-chapter audio (`.opus`/`.mp3`),
  `/_i18n/.../messages.json` only show up via a live browser session.
- **`/_ipx/` URLs are HTML-encoded** (`&amp;`) in markup — `html.unescape()` before
  downloading. The `&` is in the path (no `?`); save files with the literal `&`.
- **`curl` inside `while read … done < file` eats the loop's stdin** → empty downloads.
  Add `</dev/null` to the curl call.
- **Windows `open('w')` writes CRLF** → URL lists get `\r` and 404. Use `newline='\n'`.
- **Headless Chromium has no GPU** → WebGL/curtains.js may log "Unable to create a Plane".
  Not a clone defect — re-verify with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
- **Chapter/route HTML may 403** — don't bypass. A SPA-fallback server (serve file if it
  exists, else `index.html`) makes every client-rendered route work offline anyway.
- **Verify, don't assume:** final check = Playwright against the LOCAL server, navigate
  all pages, assert 0 failed requests (≥400) and 0 console errors.

## The engine
- Playwright — https://github.com/microsoft/playwright
