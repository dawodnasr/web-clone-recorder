# web-clone-recorder

Playwright-based capture toolkit for reverse-engineering / faithfully reproducing
JS-heavy websites (Webflow, Nuxt/SPA, GSAP sliders, custom loaders). It records what
a real browser sees — video, staged frames, a full-page screenshot, and a DOM +
computed-style dump — so you can rebuild the look, motion, and layout offline.

> No secrets, tokens, or API keys are stored in this repo. The scripts only drive a
> headless browser against a public URL.

## Install

```bash
npm install
npx playwright install chromium
```

Requires Node 18+.

## Tools

### 1. `record.mjs` — full capture
Captures the loader phase, hero-slider cycles, hover states, a scroll-through, a
full-page screenshot, and a DOM + computed-style dump.

```bash
node record.mjs <target-url> <output-dir>
# example:
node record.mjs https://example.com ./out
```

Outputs in `<output-dir>/`:
- `*.webm` — full session video
- `frames/load_*.png` — loader animation (one frame / 250ms for the first 5s)
- `frames/hero_slide_*.png` — hero slider slides
- `frames/hover_*.png` — hover states
- `frames/scroll_*.png` — scroll-through (every 400px)
- `full_page.png` — full-page screenshot
- `dom-dump.json` — title, viewport, per-section computed styles (color, font, spacing,
  shadow, transform, …) and element counts

**Tuning:** the `hoverTargets`, `sections`, and `counts` selectors near the top/middle
of `record.mjs` are examples tuned for one site. Edit them to match the CSS classes of
the site you are capturing.

### 2. `record_scroll.mjs` — scroll-behavior check
Screenshots the viewport at a series of scroll positions — handy for verifying smooth
scroll / pinned sections / scroll-triggered animation.

```bash
node record_scroll.mjs <target-url>   # writes ./out-scroll/
```

### 3. `record_responsive.mjs` — responsive check
Captures the page at desktop / tablet / mobile / fold widths.

```bash
node record_responsive.mjs            # edit the URL constant inside, writes ./out-responsive/
```

## Offline-clone method (notes)

When fully cloning a JS-heavy site to serve statically, watch for:
- **Image optimizers** (`/_ipx/`, Next/Nuxt image): the displayed assets are the
  optimized variants, not the source files — capture/serve those too.
- **Fonts**: self-host the woff2 files; webfont CDNs often block hotlinking.
- **Audio / video**: lazy-loaded; trigger the interaction that loads them before capture.
- **Background requests**: some visuals only appear after XHR/fetch — wait for
  `networkidle` and scroll the section into view first.
- **Line endings**: keep assets as-is (avoid CRLF rewrites on binary-ish text assets).
