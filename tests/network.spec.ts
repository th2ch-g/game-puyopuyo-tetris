import { test, expect } from '@playwright/test';

test('real WebRTC room: invite, ready, synchronized input, reconnect, result, rematch', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on('pageerror', (e) => errors.push(e.message));
  guest.on('pageerror', (e) => errors.push(e.message));
  await host.goto('./');
  await host.getByRole('button', { name: '友達を招待', exact: true }).click();
  await host.getByLabel('プレイヤー名', { exact: true }).fill('HOST');
  await host.getByLabel('勝利条件', { exact: true }).selectOption('1');
  await host.getByRole('button', { name: 'ルーム作成', exact: true }).click();
  await expect(host.getByRole('status')).toContainText('招待コードを友達に送ってください', {
    timeout: 30_000,
  });
  const code = (await host.getByTestId('room-code').textContent())!;
  await guest.goto(`./#room=${code}`);
  await expect(guest.getByLabel('招待コード', { exact: true })).toHaveValue(code);
  await guest.getByLabel('プレイヤー名', { exact: true }).fill('GUEST');
  await guest
    .getByRole('group', { name: 'あなたのパズル' })
    .getByRole('button', { name: /^テトリス/ })
    .tap();
  await guest.getByRole('button', { name: '参加する', exact: true }).tap();
  await expect(guest.getByRole('button', { name: '準備完了', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await guest.getByRole('button', { name: '準備完了', exact: true }).tap();
  await expect(host.getByRole('button', { name: '対戦スタート', exact: true })).toBeEnabled();
  await expect(host.getByRole('img', { name: 'ルーム招待リンクのQRコード' })).toBeVisible();
  const thirdContext = await browser.newContext();
  const third = await thirdContext.newPage();
  await third.goto(`./#room=${code}`);
  await third.getByRole('button', { name: '参加する', exact: true }).click();
  await expect(third.getByRole('status')).toContainText('このルームは満員です');
  await expect(host.locator('.room-members')).toContainText('GUEST');
  await thirdContext.close();
  await host.getByRole('button', { name: '対戦スタート', exact: true }).click();
  await expect(guest.getByRole('button', { name: '2P ハードドロップ' })).toBeEnabled();
  await guest.getByRole('button', { name: '2P 右回転' }).tap();
  await guest.getByRole('button', { name: '2P ハードドロップ' }).tap();
  await expect(host.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /1 手/);
  await expect(guest.getByTestId('score-1')).toHaveText(
    (await host.getByTestId('score-1').textContent())!,
  );
  await host.keyboard.press('Space');
  await expect(guest.locator('[data-player="0"] .board-svg')).toHaveAttribute('aria-label', /1 手/);
  await guest.reload();
  await guest.getByRole('button', { name: '対戦ルームに戻る' }).tap();
  await expect(guest.getByRole('heading', { name: '一時停止中' })).toBeVisible({ timeout: 30_000 });
  await expect(guest.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /1 手/);
  await guest.getByRole('button', { name: '再開準備OK' }).tap();
  await host.getByRole('button', { name: 'ゲームを再開', exact: true }).click();
  await expect(guest.getByRole('button', { name: '2P ハードドロップ' })).toBeEnabled();
  await guest.getByRole('button', { name: '2P ハードドロップ' }).tap();
  await expect(host.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /2 手/);
  await host.reload();
  await host.getByRole('button', { name: '対戦ルームに戻る' }).click();
  await expect(host.getByRole('button', { name: 'ゲームを再開', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(host.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /2 手/);
  await guest.getByRole('button', { name: '再開準備OK' }).tap();
  await host.getByRole('button', { name: 'ゲームを再開', exact: true }).click();
  await expect(guest.getByRole('button', { name: '2P ハードドロップ' })).toBeEnabled();
  await host.getByRole('button', { name: 'ゲームを一時停止' }).click();
  await host.getByRole('button', { name: 'リタイアして結果を見る' }).click();
  await expect(guest.getByRole('heading', { name: 'YOU WIN!' })).toBeVisible();
  await host.getByRole('button', { name: 'もう一度プレイ' }).click();
  await expect(guest.getByRole('button', { name: '2P ハードドロップ' })).toBeEnabled();
  await expect(guest.locator('[data-player="1"] .board-svg')).toHaveAttribute('aria-label', /0 手/);
  expect(errors).toEqual([]);
  await hostContext.close();
  await guestContext.close();
});
