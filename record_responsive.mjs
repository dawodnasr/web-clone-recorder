// Capture the live site at multiple viewport widths to verify responsive design.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'https://stylorix.echo-trend.com/?v=' + Date.now();
const OUT = './out-responsive';
await mkdir(OUT, { recursive: true });

const sizes = [
  { name: 'desktop-1440', w: 1440, h: 900 },
  { name: 'tablet-1024',  w: 1024, h: 768 },
  { name: 'mobile-414',   w: 414,  h: 896  }, // iPhone XR
  { name: 'mobile-375',   w: 375,  h: 812  }, // iPhone X
  { name: 'fold-360',     w: 360,  h: 780  },
];

const browser = await chromium.launch({ headless: true });
for (const s of sizes) {
  console.log('— ' + s.name);
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // wait for loader

  // Capture hero
  await page.screenshot({ path: `${OUT}/${s.name}-hero.png` });

  // Scroll to half section
  await page.evaluate(() => {
    const el = document.querySelector('.half-section');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${s.name}-half.png` });

  // Capture full page
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${s.name}-full.png`, fullPage: true });

  await ctx.close();
}
await browser.close();
console.log('\n✓ Done. See ' + OUT);
