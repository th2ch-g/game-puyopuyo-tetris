import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'artifacts/screens';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const report = [];
for (const [width, height] of [
  [1440, 1000],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [360, 780],
  [320, 640],
  [844, 390],
  [667, 375],
]) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173');
  await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
  const check = async (screen) => {
    report.push({
      screen,
      width,
      height,
      overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      errors: [...errors],
    });
  };
  await check('home');
  await page.getByRole('button', { name: 'さっそく遊ぶ' }).click();
  await page.screenshot({ path: `${output}/setup-${width}.png`, fullPage: true });
  await check('setup');
  await page.getByRole('button', { name: 'ゲームスタート', exact: true }).click();
  await page.getByRole('button', { name: '1P ハードドロップ' }).waitFor();
  await expect(page.getByRole('button', { name: '1P ハードドロップ' })).toBeEnabled();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `${output}/game-${width}.png`, fullPage: true });
  await check('game');
  await page.close();
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
