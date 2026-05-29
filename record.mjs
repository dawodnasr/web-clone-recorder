import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TARGET = process.argv[2] || 'https://skitz-you.webflow.io/';
const OUT = resolve(process.argv[3] || './out');
await mkdir(OUT, { recursive: true });
await mkdir(`${OUT}/frames`, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

console.log(`▶ Recording: ${TARGET}`);
console.log(`▶ Output:    ${OUT}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: OUT, size: VIEWPORT },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

// --- 1. Initial load + loader phase ----------------------------------------
console.log('  • navigating + capturing loader phase...');
const startNav = Date.now();
await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

// take a frame every 250ms for first 5 seconds (catches loader animation)
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(250);
  const ms = String(i * 250).padStart(5, '0');
  await page.screenshot({ path: `${OUT}/frames/load_${ms}.png`, fullPage: false });
}
console.log(`  ✓ loader phase done (${Date.now() - startNav}ms)`);

// --- 2. Hero slider — capture 3 slides over ~24s ---------------------------
console.log('  • waiting for hero slider cycles...');
await page.waitForTimeout(1500);
for (let s = 0; s < 4; s++) {
  await page.screenshot({ path: `${OUT}/frames/hero_slide_${s}.png` });
  // small delay then click "next" to force a slide
  const nextBtn = await page.$('a.s-arrow.slider-right, .slider-right, .nexter');
  if (nextBtn) {
    await nextBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2200);
  } else {
    await page.waitForTimeout(2200);
  }
}

// --- 3. Hover interactions ------------------------------------------------
console.log('  • testing hovers...');
const hoverTargets = [
  { sel: 'a.button, .button', tag: 'button' },
  { sel: '.card-slide-link', tag: 'card' },
  { sel: '.nav-link', tag: 'navlink' },
  { sel: '.instaimg', tag: 'insta' },
];
for (const { sel, tag } of hoverTargets) {
  const el = await page.$(sel);
  if (el) {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await el.hover().catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/frames/hover_${tag}.png` });
  }
}

// --- 4. Scroll-through capture (every 400px) ------------------------------
console.log('  • scrolling through whole page...');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const pageHeight = await page.evaluate(() => document.body.scrollHeight);
let pos = 0; let i = 0;
while (pos < pageHeight) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), pos);
  await page.waitForTimeout(450);
  const label = String(pos).padStart(5, '0');
  await page.screenshot({ path: `${OUT}/frames/scroll_${label}.png` });
  pos += 400;
  i++;
  if (i > 40) break;
}

// --- 5. Full-page screenshot ----------------------------------------------
console.log('  • full-page screenshot...');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/full_page.png`, fullPage: true });

// --- 6. DOM + computed-style dump -----------------------------------------
console.log('  • extracting DOM + computed styles...');
const dom = await page.evaluate(() => {
  const pick = (el, props) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    out._rect = el.getBoundingClientRect().toJSON();
    out._tag = el.tagName.toLowerCase();
    out._classes = el.className;
    return out;
  };

  const COMMON = [
    'color','background-color','font-family','font-size','font-weight','line-height',
    'letter-spacing','text-transform','border-radius','padding','margin','box-shadow',
    'transition','transform','display','position','width','height','z-index','opacity'
  ];

  const select = (sel, limit = 4) => {
    const els = Array.from(document.querySelectorAll(sel)).slice(0, limit);
    return els.map((e) => pick(e, COMMON));
  };

  return {
    title: document.title,
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight },
    pageHeight: document.body.scrollHeight,
    body: pick(document.body, COMMON),
    sections: {
      heroSection: select('.hero-section, .section.hero-section', 1),
      heroH1: select('.hero-h1, h1', 3),
      heroH1Border: select('.h1-border', 1),
      tag: select('.tag', 1),
      navLink: select('.nav-link', 2),
      button: select('.button, a.button', 3),
      butBorder: select('.but-border', 1),
      logo: select('.brand img, .logo-text, .brand', 2),
      midH2: select('.mid-h2, .no-margin-h2, .big-h2', 3),
      newsSliderImg: select('.news-slider-img, .card-slide-link', 3),
      smallTag: select('.small-tag', 1),
      rotatedTag: select('.rotated-tag', 1),
      polygons: select('.polygon-black, .polygon-yellow', 4),
      footerLink: select('.footer-link, .footer-h4', 3),
      newsPhotoBorder: select('.news-photo-border', 1),
      halfSection: select('.half-section, .half-slider, .half-section-text-side', 3),
      yellowSection: select('.yellow-news-section, .all-tick-core, .tick', 3),
      insta: select('.instacore, .insta-photos-line, .instaimg', 3),
    },
    counts: {
      heroBgSlides: document.querySelectorAll('.hero-bg-slide, [class*="hero-bg"]').length,
      heroTextSlides: document.querySelectorAll('.hero-slide').length,
      heroTabSlides: document.querySelectorAll('.hero-tab-slide').length,
      productCards: document.querySelectorAll('.card-slide-link, ._30-slide').length,
      halfSlides: document.querySelectorAll('.half-slider .w-slide, .half-slide').length,
      instaImages: document.querySelectorAll('.instaimg').length,
    }
  };
});

await writeFile(`${OUT}/dom-dump.json`, JSON.stringify(dom, null, 2));

// --- 7. Close + finalize video --------------------------------------------
await page.close();
await context.close();
await browser.close();

console.log('\n✓ DONE. Outputs:');
console.log('  • video: out/*.webm (one per page)');
console.log('  • frames: out/frames/*.png (load/hero/hover/scroll)');
console.log('  • full page: out/full_page.png');
console.log('  • DOM dump: out/dom-dump.json');
