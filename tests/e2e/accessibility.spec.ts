import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function audit(page: Page, info: TestInfo, name: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const findings = { name, violations: result.violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) };
  await info.attach(`accessibility-${name}`, { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });
  expect.soft(findings.violations, name).toEqual([]);
}

test('accessibility audit of planner, activity editor and dialogs', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-webkit' || info.project.name === 'phone-webkit' || info.project.name.startsWith('tablet-'), 'Representative Chromium audits cover accessibility; WebKit and touch projects retain interaction coverage.');
  test.setTimeout(120_000);
  await page.goto('./');
  await page.getByRole('gridcell').first().click();
  await audit(page, info, 'fine-grid');
  const drawerButton = page.getByRole('button', { name: /^Activities/ });
  if (await drawerButton.isVisible()) await drawerButton.click();
  await page.getByRole('button', { name: 'Edit Work', exact: true }).click();
  await audit(page, info, 'activity-editor');
  await page.locator('[data-icon-picker-button]:visible').click();
  await audit(page, info, 'icon-picker');
  const drawer = page.getByRole('dialog', { name: 'Activities drawer' });
  if (await drawer.isVisible()) await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  for (const action of ['New plan', 'Export backup', 'Import backup']) {
    await page.getByText('Plan options', { exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
    await audit(page, info, action);
    await page.keyboard.press('Escape');
  }
});

test('keyboard icon selection returns focus to its trigger', async ({ page }) => {
  await page.goto('./');
  const drawerButton = page.getByRole('button', { name: /^Activities/ });
  if (await drawerButton.isVisible()) await drawerButton.click();
  await page.getByRole('button', { name: 'Edit Work', exact: true }).click();
  const trigger = page.locator('[data-icon-picker-button]:visible');
  await trigger.click();
  const choice = page.locator('[data-icon-picker-root]:visible button').first();
  await choice.focus();
  await choice.press('Enter');
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await page.locator('[data-icon-picker-root]:visible button').first().focus();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('[data-icon-picker-root]:visible')).toHaveCount(0);
});
