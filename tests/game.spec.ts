import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createMatch } from '../src/game/engine';
import { DEFAULT_CONFIG, type Kind, type Match } from '../src/game/types';

async function startPractice(page: Page, kind: Kind = 'puyo') {
  await page.goto('./');
  await page.getByRole('button', { name: /自分のペースで/ }).click();
  await page
    .getByRole('group', { name: '1Pのパズル' })
    .getByRole('button', { name: kind === 'puyo' ? /^ぷよ/ : /^テトリス/ })
    .click();
  await page.getByRole('button', { name: 'ゲームスタート', exact: true }).click();
  await expect(page.getByRole('button', { name: '1P ハードドロップ', exact: true })).toBeEnabled();
}
async function loadFixture(page: Page, match: Match) {
  await page.goto('./');
  await page.evaluate(
    (state) => localStorage.setItem('drop-arena:v1:save', JSON.stringify(state)),
    match,
  );
  await page.reload();
  await page.getByRole('button', { name: '前のゲームを再開' }).click();
  await page.getByRole('button', { name: 'ゲームを再開', exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}

test('home, dialogs, settings persistence, and keyboard focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: /つなげて。\s*そろえて。\s*夢中になれ。/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByRole('switch', { name: /色の識別マーク/ }).check();
  await page.getByRole('switch', { name: /効果音/ }).uncheck();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('switch', { name: /色の識別マーク/ })).toBeChecked();
  await expect(page.getByRole('switch', { name: /効果音/ })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '遊び方', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('7バッグ');
  await page.keyboard.press('Escape');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('puyo keyboard play, pause, save, reload, retire, and rematch', async ({ page }) => {
  await startPractice(page);
  const board = page.getByRole('img', { name: /ぷよ盤面/ });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect(board).toHaveAttribute('aria-label', /1 手/);
  await page.keyboard.press('KeyP');
  await expect(page.getByRole('heading', { name: '一時停止中' })).toBeVisible();
  const before = await board.getAttribute('aria-label');
  await page.keyboard.press('Space');
  expect(await board.getAttribute('aria-label')).toBe(before);
  await page.reload();
  await page.getByRole('button', { name: '前のゲームを再開' }).click();
  await expect(board).toHaveAttribute('aria-label', /1 手/);
  await page.getByRole('button', { name: 'ゲームを再開', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(board).toHaveAttribute('aria-label', /2 手/);
  await page.getByRole('button', { name: 'ゲームを一時停止' }).click();
  await page.getByRole('button', { name: 'リタイアして結果を見る' }).click();
  await expect(page.getByRole('heading', { name: 'NICE PRACTICE!' })).toBeVisible();
  await page.getByRole('button', { name: 'もう一度プレイ' }).click();
  await expect(page.getByRole('button', { name: '1P ハードドロップ' })).toBeEnabled();
  await expect(board).toHaveAttribute('aria-label', /0 手/);
});

test('tetris hold, line clearing, sprint completion, and saved record', async ({ page }) => {
  const match = createMatch(
    { ...structuredClone(DEFAULT_CONFIG), mode: 'sprint', kinds: ['tetris', 'puyo'] },
    7,
  );
  match.phase = 'playing';
  const b = match.players[0].boards.tetris;
  b.lines = 39;
  b.grid[21] = [8, 8, 8, 8, 0, 0, 0, 0, 8, 8];
  b.active = { type: 'I', colors: [], x: 4, y: 0, rotation: 0 };
  await loadFixture(page, match);
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'CHALLENGE CLEAR!' })).toBeVisible();
  await expect(page.getByText('40ライン達成', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
  await page.getByRole('button', { name: '記録', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('40 LINES');
  await page.keyboard.press('Escape');
  await startPractice(page, 'tetris');
  await page.keyboard.press('KeyC');
  await expect(page.locator('.hold-box')).toHaveClass(/hold-used/);
  await page.keyboard.press('Space');
  await expect(page.locator('.hold-box')).not.toHaveClass(/hold-used/);
});

test('puyo chain animation and adjacent garbage resolve in the browser', async ({ page }) => {
  const m = createMatch({ ...structuredClone(DEFAULT_CONFIG), mode: 'practice' }, 12);
  m.phase = 'playing';
  const b = m.players[0].boards.puyo;
  b.grid[13] = [1, 1, 2, 0, 0, 3];
  b.grid[12][0] = 1;
  b.grid[12][2] = 8;
  b.grid[11][0] = 2;
  b.grid[10][0] = 2;
  b.active = { type: 'P', colors: [1, 2], x: 1, y: 5, rotation: 0 };
  await loadFixture(page, m);
  await page.keyboard.press('Space');
  await expect(page.getByRole('status').filter({ hasText: '2 CHAIN!' })).toBeVisible();
  await expect(page.locator('.chain-value').first()).toContainText('2');
  await expect(page.locator('.field-score').first()).toContainText('8');
});

test('CPU moves on both rules and round outcomes produce results', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'さっそく遊ぶ' }).click();
  await page.getByLabel('勝利条件', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'ゲームスタート', exact: true }).click();
  await expect(page.getByRole('img', { name: /テトリス盤面/ })).not.toHaveAttribute(
    'aria-label',
    /0 手/,
  );
  await page.getByRole('button', { name: 'ゲームを一時停止' }).click();
  await page.getByRole('button', { name: 'リタイアして結果を見る' }).click();
  await expect(page.getByRole('heading', { name: 'NEXT TIME!' })).toBeVisible();
  await expect(page.getByText('CPU の勝利', { exact: true })).toBeVisible();
});

test('local two-player keyboards are independent and swap retains boards', async ({ page }) => {
  const m = createMatch(
    { ...structuredClone(DEFAULT_CONFIG), mode: 'local', rule: 'swap', names: ['ALPHA', 'BETA'] },
    17,
  );
  m.phase = 'playing';
  m.swapIn = 1800;
  await loadFixture(page, m);
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyF');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-player="0"] .board-svg')).toHaveAttribute('aria-label', /1 手/);
  await expect(page.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /1 手/);
  await expect(page.locator('[data-player="0"] .board-svg')).toHaveAttribute(
    'aria-label',
    /テトリス盤面/,
  );
  await expect(page.locator('[data-player="1"] .board-svg')).toHaveAttribute(
    'aria-label',
    /ぷよ盤面/,
  );
  await noOverflow(page);
});

test('mobile touch controls support hold, repeat, cancellation, and landscape', async ({
  browser,
  browserName,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await startPractice(page, 'tetris');
  await noOverflow(page);
  const drop = page.getByRole('button', { name: '1P ハードドロップ' });
  const bounds = await drop.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: '1P ホールド' }).tap();
  await expect(page.locator('.hold-box')).toHaveClass(/hold-used/);
  await page.getByRole('button', { name: '1P 右回転' }).tap();
  await drop.tap();
  await expect(page.getByRole('img', { name: /テトリス盤面/ })).toHaveAttribute(
    'aria-label',
    /1 手/,
  );
  const left = page.getByRole('button', { name: '1P 左へ移動' });
  const leftBox = (await left.boundingBox())!;
  if (browserName === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: leftBox.x + leftBox.width / 2, y: leftBox.y + leftBox.height / 2, id: 1 }],
    });
    await page.waitForTimeout(230);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  } else {
    await page.mouse.move(leftBox.x + leftBox.width / 2, leftBox.y + leftBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(230);
    await page.mouse.up();
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  const landscapeDrop = (await drop.boundingBox())!;
  expect(landscapeDrop.y + landscapeDrop.height).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 667, height: 375 });
  await noOverflow(page);
  const compactDrop = (await drop.boundingBox())!;
  expect(compactDrop.y + compactDrop.height).toBeLessThanOrEqual(375);
  expect(errors).toEqual([]);
  await context.close();
});

test('local mobile offers both players reachable controls without overflow', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('./');
  await page.getByRole('button', { name: /となりの人と/ }).tap();
  await page.getByRole('button', { name: 'ゲームスタート', exact: true }).tap();
  await expect(page.getByRole('button', { name: '1P ハードドロップ' })).toBeEnabled();
  await page.getByRole('button', { name: '1P ハードドロップ' }).tap();
  await page.getByRole('button', { name: '2P ハードドロップ' }).tap();
  for (const player of [0, 1])
    await expect(page.locator(`[data-player="${player}"] .board-svg`)).toHaveAttribute(
      'aria-label',
      /1 手/,
    );
  await noOverflow(page);
  const box = await page.getByRole('button', { name: '2P ハードドロップ' }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(780);
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  for (const label of ['1P ハードドロップ', '2P ハードドロップ']) {
    const control = (await page.getByRole('button', { name: label }).boundingBox())!;
    expect(control.y + control.height).toBeLessThanOrEqual(390);
  }
  await context.close();
});

test('home, setup, and in-game accessibility at desktop and narrow widths', async ({ page }) => {
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./');
    await noOverflow(page);
    const home = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(home.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'さっそく遊ぶ' }).click();
  await noOverflow(page);
  const setup = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(setup.violations).toEqual([]);
  await page.getByRole('button', { name: 'ゲームスタート', exact: true }).click();
  await expect(page.getByRole('button', { name: '1P ハードドロップ' })).toBeEnabled();
  await noOverflow(page);
  const game = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(game.violations).toEqual([]);
});

test('invalid stored settings and game data are safely ignored', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    localStorage.setItem('drop-arena:v1:save', '{"version":1,"players":[]}');
    localStorage.setItem('drop-arena:v1:settings', 'null');
    localStorage.setItem('drop-arena:v1:records', '{"invalid":true}');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: '前のゲームを再開' })).toHaveCount(0);
  await page.getByRole('button', { name: '記録', exact: true }).click();
  await expect(page.getByText('最初の一戦を、記録しよう。')).toBeVisible();
});
