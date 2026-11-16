import { test, expect } from '@playwright/test';

test('a configured deployment opens in testnet mode and shows its confirmed public history', async ({ page }) => {
  const address = '0x2222222222222222222222222222222222222222';
  await page.addInitScript(() => {
    if (!localStorage.getItem('jaydaad.mode')) localStorage.setItem('jaydaad.mode', JSON.stringify('rehearsal'));
  });
  await page.route('**/api/network', r => r.fulfill({ json: { connected: true, chainId: 9800, block: 10000000 } }));
  await page.route('**/api/deployment', r => r.fulfill({ json: {
    deployment: { address, name: 'Configured Diana vault', heirName: 'Configured heir', witnessName: 'Configured witness' },
    events: [{ title: 'Witnessed check-in confirmed', detail: 'Confirmed deployment history',
      hash: 'A'.repeat(64), verified: true, shield: 'contract-verified', mode: 'testnet', time: '2026-11-14T12:00:00Z' }]
  } }));
  await page.route('**/api/vault/*', r => r.fulfill({ json: {
    estate: address, phase: 'Active', balance: '1', owner: '0x1111111111111111111111111111111111111111',
    heir: '0x3333333333333333333333333333333333333333', witness: '0x4444444444444444444444444444444444444444',
    interval: 2592000, grace: 604800, due: 1900000000, release: 1900604800, now: 1899000000,
    nonce: 1, block: 10000000, keys: [], verified: true
  } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Configured Diana vault', exact: true })).toBeVisible();
  await expect(page.getByText('Native Diana testnet QOR')).toBeVisible();
  await expect(page.getByText('Witnessed check-in confirmed', { exact: true })).toBeVisible();
  await expect(page.getByText('Local rehearsal · all accounts')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jaydaad.vault')).address)).toBe(address);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jaydaad.mode')))).toBe('testnet');
  await page.getByRole('button', { name: 'View my vault' }).click();
  await page.getByRole('button', { name: 'Rename vault' }).click();
  await expect(page.getByLabel('Vault name')).toHaveValue('Configured Diana vault');
  await page.getByLabel('Vault name').fill('  The Patel family  ');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'The Patel family' })).toBeVisible();
  await page.getByRole('link', { name: 'Beneficiary', exact: true }).click();
  await page.getByRole('button', { name: 'Edit beneficiary name' }).click();
  await page.getByLabel('Beneficiary name', { exact: true }).fill('Discard this');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configured heir' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit beneficiary name' }).click();
  await page.getByLabel('Beneficiary name', { exact: true }).fill('Asha <Patel>');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'Asha <Patel>' })).toBeVisible();
  await expect(page.locator('.beneficiary-panel .address-wrap')).toHaveText('0x3333333333333333333333333333333333333333');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The Patel family' })).toBeVisible();
  await expect(page.locator('.vault-details')).toContainText('Asha <Patel>');
});
