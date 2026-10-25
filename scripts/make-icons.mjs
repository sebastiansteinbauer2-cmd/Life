// Vygeneruje PNG ikony z SVG pomocí Playwright (Chromium).
// Spuštění: NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const jobs = [
  ['public/icon.svg', 'public/icon-192.png', 192],
  ['public/icon.svg', 'public/icon-512.png', 512],
  ['public/icon.svg', 'public/apple-touch-icon.png', 180],
  ['scripts/icon-maskable.svg', 'public/icon-maskable-512.png', 512],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = readFileSync(src, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out });
  console.log('✓', out);
}
await browser.close();
