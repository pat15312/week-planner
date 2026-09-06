import { test, expect } from '@playwright/test';

test('large plan collection remains editable and survives reload', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    if (localStorage.getItem('week_planner_5min_store_v3')) return;
    const plans = Array.from({ length: 50 }, (_, i) => ({
      id: `plan-${i}`, name: `Synthetic plan ${i}`,
      activities: Array.from({ length: 100 }, (_, j) => ({ id: `a-${j}`, name: `Activity ${j}`, colour: '#8B5CF6', icon: 'calendar' })),
      grid: Array.from({ length: 7 }, () => Array.from({ length: 288 }, (_, row) => `a-${row % 100}`)),
      selectedActivityId: 'a-0', tool: 'paint',
    }));
    localStorage.setItem('week_planner_5min_store_v3', JSON.stringify({ version: 3, activePlanId: 'plan-49', plans }));
    localStorage.setItem('week_planner_preferences', JSON.stringify({ version: 1, timeScale: '5' }));
  });
  const start = Date.now();
  await page.goto('./');
  const cell = page.getByRole('gridcell', { name: 'Mon 00:05-00:10: Activity 1', exact: true });
  await expect(cell).toBeVisible();
  const loadMs = Date.now() - start;
  await page.getByRole('button', { name: 'Erase', exact: true }).click();
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const editStart = Date.now();
    await cell.click();
    await expect(page.getByRole('gridcell', { name: 'Mon 00:05-00:10: Free', exact: true })).toBeVisible();
    samples.push(Date.now() - editStart);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(cell).toBeVisible();
  }
  await cell.click();
  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'Mon 00:05-00:10: Free', exact: true })).toBeVisible();
  await expect(page.getByLabel('Plan', { exact: true })).toHaveValue('plan-49');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('week_planner_5min_store_v3')!));
  expect(saved.plans).toHaveLength(50);
  expect(saved.plans[0].grid[0][1]).toBe('a-1');
  expect(saved.plans[49].grid[0][1]).toBeNull();
  await info.attach('performance', { body: JSON.stringify({ loadMs, editRoundTripMs: samples, payloadBytes: Buffer.byteLength(JSON.stringify(saved)), note: 'Wall-clock browser automation round trips, not device input latency.' }, null, 2), contentType: 'application/json' });
  // A generous regression ceiling for shared CI, not a responsiveness claim.
  expect(Math.max(...samples)).toBeLessThan(3000);
});
