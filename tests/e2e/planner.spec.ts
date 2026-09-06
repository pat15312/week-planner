import { test, expect, type Page } from '@playwright/test';

const STORAGE_KEY = 'week_planner_5min_store_v3';
async function option(page: Page, name: string) {
  await page.getByText('Plan options', { exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
async function activities(page: Page) {
  const button = page.getByRole('button', { name: /^Activities/ });
  if (await button.isVisible()) await button.click();
}
async function closeDrawer(page: Page) {
  const drawer = page.getByRole('dialog', { name: 'Activities drawer' });
  if (await drawer.isVisible()) await drawer.getByRole('button', { name: 'Close', exact: true }).click();
}
async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('grid', { name: 'Weekly allocations' })).toBeVisible();
});

test('create, paint, undo, redo and reload a selected plan and view', async ({ page }) => {
  await option(page, 'New plan');
  await page.getByRole('textbox', { name: 'Plan name' }).fill('Sample week');
  await page.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByRole('button', { name: '1h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: '15m', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Plan', { exact: true }).locator('option:checked')).toHaveText('Sample week');
  await expect(page.getByRole('button', { name: '15m', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('gridcell', { name: 'Mon 00:00-00:15: Work', exact: true })).toBeVisible();
  const payload = await saved(page);
  const plan = payload.plans.find((p: { id: string }) => p.id === payload.activePlanId);
  expect(plan.grid[0].filter((cell: string | null) => cell === 'a_work')).toHaveLength(12);
});

test('keyboard editing and modal focus are usable', async ({ page }) => {
  const first = page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true });
  await first.focus();
  await first.press('Enter');
  await expect(page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Work', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('gridcell', { name: 'Tue 00:00-01:00: Free', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Delete');
  await expect(page.getByRole('gridcell', { name: 'Tue 00:00-01:00: Free', exact: true })).toBeFocused();
  await option(page, 'Rename plan');
  const dialog = page.getByRole('dialog', { name: 'Rename plan' });
  await expect(dialog).toBeVisible();
  const nameInput = dialog.getByRole('textbox', { name: 'Plan name' });
  await expect(nameInput).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Save plan', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close Rename plan', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nameInput).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('backs up files, rejects invalid import and restores previous plans', async ({ page }) => {
  await page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true }).click();
  await option(page, 'Export backup');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^week-planner-.*\.json$/);
  const original = await saved(page);
  await page.getByRole('button', { name: 'Close Back up and restore' }).click();
  await option(page, 'Import backup');
  await page.getByRole('textbox', { name: 'Backup JSON' }).fill('{bad');
  await page.getByRole('button', { name: 'Import plans', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JSON could not be read');
  expect(await saved(page)).toEqual(original);
  const replacement = structuredClone(original);
  replacement.plans[0].name = 'Imported week';
  await page.getByLabel('Backup file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
  await page.getByRole('button', { name: 'Import plans', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported successfully' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore previous plans' }).click();
  expect(await saved(page)).toEqual(original);
});

test('reports clipboard failure instead of success', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Denied')) } }));
  await option(page, 'Export backup');
  await page.getByRole('button', { name: 'Copy JSON' }).click();
  await expect(page.getByRole('alert')).toContainText('Copy failed');
});

test('layout fits, day navigation preserves data and touch targets are large', async ({ page, isMobile, hasTouch }, testInfo) => {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const grid = page.getByRole('grid', { name: 'Weekly allocations' });
  const dayCount = await grid.getByRole('columnheader').count() - 1;
  expect(dayCount).toBeGreaterThanOrEqual(3);
  expect(dayCount).toBeLessThanOrEqual(7);
  const first = page.getByRole('gridcell').first();
  const box = await first.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  if (dayCount < 7) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(grid.getByRole('columnheader').nth(1)).toHaveText('Tue');
    await page.getByRole('gridcell', { name: 'Tue 00:00-01:00: Free', exact: true }).click();
    expect((await saved(page)).plans[0].grid[1][0]).toBe('a_work');
  }
  if (isMobile || hasTouch) {
    await page.getByRole('button', { name: '5m', exact: true }).click();
    expect((await page.getByRole('gridcell').first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('planner.png'), fullPage: true });
  await activities(page);
  await page.getByRole('button', { name: 'Edit Work', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('activity-editor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Move down', exact: true }).click();
  expect((await saved(page)).plans[0].activities.map((a: { name: string }) => a.name)).toEqual(['Family', 'Work', 'Sleep', 'Admin']);
  await closeDrawer(page);
});

test('mouse drag reordering uses the indicated gap and painting is one undo', async ({ page, hasTouch }) => {
  test.skip(!!hasTouch, 'Desktop drag regression; touch has a separate test.');
  const handle = page.getByRole('button', { name: 'Drag Work to reorder' });
  const from = (await handle.boundingBox())!;
  const family = (await page.getByRole('button', { name: 'Family 0h 00m' }).boundingBox())!;
  const sleep = (await page.getByRole('button', { name: 'Sleep 0h 00m' }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, (family.y + family.height + sleep.y) / 2, { steps: 12 });
  await page.mouse.up();
  expect((await saved(page)).plans[0].activities.map((a: { name: string }) => a.name)).toEqual(['Family', 'Work', 'Sleep', 'Admin']);
  const first = (await page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true }).boundingBox())!;
  const third = (await page.getByRole('gridcell', { name: 'Mon 02:00-03:00: Free', exact: true }).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).plans[0].grid[0].every((cell: string | null) => cell === null)).toBe(true);
});

test('touch tap paints once and swipe leaves allocations unchanged', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'Requires a touch context.');
  const first = page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true });
  await first.tap();
  const before = await saved(page);
  expect(before.plans[0].grid[0][0]).toBe('a_work');
  const second = page.getByRole('gridcell', { name: 'Mon 01:00-02:00: Free', exact: true });
  await second.dispatchEvent('pointerdown', { pointerId: 20, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 300 });
  await second.dispatchEvent('pointermove', { pointerId: 20, pointerType: 'touch', isPrimary: true, clientX: 100, clientY: 180 });
  await second.dispatchEvent('pointerup', { pointerId: 20, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 180 });
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).plans[0].grid[0][0]).toBeNull();
});

test('invalid stored data survives recovery and a replacement remeasures the grid', async ({ page }) => {
  const original = await saved(page);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.reload();
  await expect(page.getByText('Week Planner needs your help to recover saved data')).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{broken');
  await page.getByRole('button', { name: 'Supply replacement JSON' }).click();
  await page.getByRole('textbox', { name: 'Backup JSON' }).fill(JSON.stringify(original));
  await page.getByRole('button', { name: 'Import plans', exact: true }).click();
  await page.getByRole('button', { name: 'Close Back up and restore' }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  const expectedDays = await page.locator('.planner-scroll').evaluate(el => Math.min(7, Math.max(3, Math.floor((el.clientWidth - 56) / 120))));
  await expect(page.getByRole('columnheader')).toHaveCount(expectedDays + 1);
});

test('denied browser storage still permits editing and file export', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } }));
  await page.reload();
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByText('Browser storage could not be read. Changes may not be saved.', { exact: true })).toBeVisible();
  await page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Free', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'Mon 00:00-01:00: Work', exact: true })).toBeVisible();
  await option(page, 'Export backup');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toContain('week-planner-');
});
