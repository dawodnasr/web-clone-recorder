// Quick scroll-behavior verification. Captures viewport at scrollY = 0, 50vh, 100vh, 200vh
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.argv[2] || 'https://stylorix.echo-trend.com/?nocache=' + Date.now();
const OUT = './out-scroll';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, bypassCSP: true });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);  // wait for loader to finish

const scrolls = [0, 450, 900, 1400, 1800, 2400, 3200];
for (const y of scrolls) {
  await page.evaluate((sy) => window.scrollTo({ top: sy, behavior: 'instant' }), y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/scroll_${String(y).padStart(5, '0')}.png` });
  console.log('captured scrollY=' + y);
}

// also check if .hero-section is actually fixed
const heroComputed = await page.evaluate(() => {
  const el = document.querySelector('.hero-section');
  const cs = getComputedStyle(el);
  return { position: cs.position, top: cs.top, zIndex: cs.zIndex, height: cs.height };
});
console.log('hero computed:', JSON.stringify(heroComputed));

const homeComputed = await page.evaluate(() => {
  const el = document.querySelector('.homepage-section');
  const cs = getComputedStyle(el);
  return { marginTop: cs.marginTop, position: cs.position, zIndex: cs.zIndex };
});
console.log('homepage-section computed:', JSON.stringify(homeComputed));

await browser.close();
