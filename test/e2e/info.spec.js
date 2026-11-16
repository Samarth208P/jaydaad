import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/network', r => r.fulfill({ json: { connected: true, chainId: 9800, block: 10000000 } }));
  await page.route('**/api/deployment', r => r.fulfill({ json: null }));
  await page.goto('/');
  await expect(page.locator('header button[data-action="connect"]')).toBeEnabled();
});

test('supporting explanations open by keyboard, dismiss, and restore focus', async ({ page }) => {
  const help = page.getByRole('button', { name: 'About how inheritance works', exact: true });
  const panel = page.getByRole('dialog', { name: 'How inheritance works', exact: true });
  await expect(panel).not.toBeVisible();
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await help.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('If you miss the deadline and the grace period passes');
  await expect(help).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(help).toBeFocused();
  await expect(help).toHaveAttribute('aria-expanded', 'false');
  await help.click();
  await panel.getByRole('button', { name: 'Close information', exact: true }).click();
  await expect(panel).not.toBeVisible();
  await help.click();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(panel).not.toBeVisible();
});

test('mobile info stays inside the viewport and works within a form dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'About how inheritance works', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'How inheritance works', exact: true });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Create a vault', exact: true }).click();
  const formDialog = page.locator('#modal');
  await formDialog.getByLabel('Vault name').fill('My untouched plan');
  await expect(formDialog.getByText('Deploy via CLI. Roles and timers lock at creation.', { exact: true })).toBeVisible();
  await formDialog.getByRole('button', { name: 'About vault enrollment', exact: true }).click();
  const enrollment = page.getByRole('dialog', { name: 'Vault enrollment', exact: true });
  await expect(enrollment).toContainText('possession-proven PQ keys');
  await page.keyboard.press('Escape');
  await expect(enrollment).not.toBeVisible();
  await expect(formDialog).toBeVisible();
  await expect(formDialog.getByLabel('Vault name')).toHaveValue('My untouched plan');
  await formDialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
