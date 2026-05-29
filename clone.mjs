// clone.mjs — full offline mirror of a JS-heavy site.
// Loads the target (and any extra routes) in a real browser, scrolls to trigger lazy /
// animation assets, captures EVERY same-origin response (images, the optimized /_ipx
// variants, fonts, audio, JS, CSS, payload JSON), and writes them to disk mirroring their
// URL path. The hydrated HTML of each page is saved as index.html.
//
// This is cleaner than scraping + curl loops: the browser already resolved every URL, so
// there is no html-entity / CRLF / stdin gotcha to handle.
//
// Usage:
//   node clone.mjs <url> [out-dir] [extraRoute1,extraRoute2,...]
//   node clone.mjs https://example.com ./clone /about,/shop
// Then serve it offline:
//   cd <out-dir> && python spa_server.py 8013
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const TARGET = process.argv[2];
if (!TARGET) { console.error('usage: node clone.mjs <url> [out-dir] [route1,route2,...]'); process.exit(1); }
const OUT = resolve(process.argv[3] || './clone');
const ROUTES = (process.argv[4] || '').split(',').map(s => s.trim()).filter(Boolean);
const ORIGIN = new URL(TARGET).origin;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await ctx.newPage();

const assets = new Map(); // url -> Buffer (same-origin, non-HTML, status < 400)
page.on('response', async (res) => {
  try {
    const url = res.url();
    if (!url.startsWith('http')) return;
    if (new URL(url).origin !== ORIGIN) return;     // same-origin only (edit to also grab a CDN)
    if (res.status() >= 400) return;
    const ct = (res.headers()['content-type'] || '');
    if (ct.includes('text/html')) return;           // pages are saved via page.content()
    if (assets.has(url)) return;
    const body = await res.body().catch(() => null);
    if (body) assets.set(url, body);
  } catch {}
});

async function visit(routeOrUrl) {
  const url = routeOrUrl.startsWith('http') ? routeOrUrl
    : ORIGIN + (routeOrUrl.startsWith('/') ? routeOrUrl : '/' + routeOrUrl);
  console.log('▶ visit', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => document.body.scrollHeight).catch(() => 0);
  for (let y = 0; y < h; y += 600) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(600);
  const html = await page.content();
  const path = new URL(url).pathname;
  const rel = (path === '/' || path === '') ? 'index.html'
    : path.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
  const fp = join(OUT, rel);
  await mkdir(dirname(fp), { recursive: true });
  await writeFile(fp, html);
  console.log('  ✓ html ->', rel);
}

await visit(TARGET);
for (const r of ROUTES) await visit(r);

let n = 0;
for (const [url, body] of assets) {
  let p = decodeURIComponent(new URL(url).pathname); // keep literal & in /_ipx/ paths
  if (p.endsWith('/')) p += 'index';
  const fp = join(OUT, p.replace(/^\//, ''));
  await mkdir(dirname(fp), { recursive: true });
  await writeFile(fp, body);
  n++;
}
await browser.close();

console.log(`\n✓ DONE. ${n} assets + ${1 + ROUTES.length} page(s) -> ${OUT}`);
console.log(`  serve offline:  cd "${OUT}" && python spa_server.py 8013`);
