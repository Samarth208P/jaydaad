import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { hexlify } from 'ethers';
import { recipientFixture } from '../recipient-fixture.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/network', route => route.fulfill({ json: { chainId: 9800, connected: true } }));
});

test('a changed handle must be confirmed before its address fills the chosen role', async ({ page }) => {
  const previous = '0x1111111111111111111111111111111111111111';
  const address = '0x2222222222222222222222222222222222222222';
  await page.addInitScript(old => localStorage.setItem('jaydaad.handle.family_heir', JSON.stringify(old)), previous);
  await page.route('**/api/deployment', route => route.fulfill({ body: 'null', contentType: 'application/json' }));
  await page.route('**/api/handles/family_heir', route => route.fulfill({ json: { handle: 'family_heir', address } }));
  await page.route('**/api/key/*', route => route.fulfill({ json: { registered: true, proven: true, algorithm: 1, bytes: 2592 } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a vault', exact: true }).click();
  const input = page.getByLabel('Beneficiary address or @handle');
  await input.fill('@family_heir');
  await page.getByRole('button', { name: 'Look up beneficiary handle' }).click();
  await expect(page.locator('#review-heir')).toContainText(previous);
  await expect(page.locator('#review-heir')).toContainText(address);
  await expect(input).toHaveValue('@family_heir');
  await page.getByRole('button', { name: 'Confirm changed address' }).click();
  await expect(input).toHaveValue(address);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jaydaad.handle.family_heir')))).toBe(address);
});

test('a browser-encrypted note can be opened with the beneficiary offline command', async ({ page }, testInfo) => {
  const { vault, keys, card, kem } = recipientFixture();
  await page.route('**/api/deployment', route => route.fulfill({ json: { deployment: { address: vault.estate } } }));
  await page.route('**/api/vault/*', route => route.fulfill({ json: { ...vault, phase: 'Active',
    owner: '0x1111111111111111111111111111111111111111', witness: '0x4444444444444444444444444444444444444444',
    now: 1, due: 100, release: 130, interval: 100, grace: 30, balance: '1' } }));
  await page.route('**/api/encryption-key/*', route => route.fulfill({ json: { publicKey: kem } }));
  await page.goto('/#beneficiaries');
  await page.getByRole('button', { name: 'Create private handover note' }).click();
  await page.getByLabel('Beneficiary’s signed QoreSeal recipient card').setInputFiles({
    name: 'card.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(card)) });
  const note = 'The inventory is in the blue folder.';
  await page.getByLabel('Handover note', { exact: true }).fill(note);
  const download = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('button', { name: 'Encrypt & download' }).click();
  const file = testInfo.outputPath('handover.json');
  await (await download).saveAs(file);
  expect(await readFile(file, 'utf8')).not.toContain(note);
  const seedFile = testInfo.outputPath('recipient.key');
  const plainFile = testInfo.outputPath('note.txt');
  await writeFile(seedFile, hexlify(keys.seed), { mode: 0o600 });
  execFileSync(process.execPath, ['scripts/open-note.js', file, seedFile, plainFile]);
  expect(await readFile(plainFile, 'utf8')).toBe(note);
});
