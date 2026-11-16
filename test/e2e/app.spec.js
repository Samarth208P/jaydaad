import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const protocol = (operation, value) => JSON.parse(execFileSync(process.execPath, ['test/protocol-helper.js', operation, JSON.stringify(value)], { encoding: 'utf8' }));
const hexToBech32 = address => protocol('address', address);

const network = { connected: true, chainId: 9800, nativeChainId: 'qorechain-diana', block: 10000000, registryAvailable: true };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/network', r => r.fulfill({ json: network }));
  await page.route('**/api/deployment', r => r.fulfill({ json: null }));
});
const connectButton = page => page.locator('header button[data-action="connect"]');
async function ready(page) { await page.goto('/'); await expect(connectButton(page)).toBeEnabled(); }

test('testnet first, explicit missing-wallet path, and responsive navigation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await expect(page.getByText('Native Diana testnet QOR')).toBeVisible();
  await connectButton(page).click();
  await expect(page.getByRole('heading', { name: 'A familiar wallet. A safer future.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Install QoreX extension' })).toHaveAttribute('href', /chromewebstore/);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Page index', exact: true }).getByRole('link', { name: 'Security center', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Care deserves a second signature.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('only the public chain is available', async ({ request }) => {
  expect((await request.get('/api/rehearsal')).status()).toBe(404);
  expect((await request.post('/api/rehearsal/reset')).status()).toBe(405);
});

const owner = '0x1111111111111111111111111111111111111111';
const target = '0x2222222222222222222222222222222222222222';
const nativeAddress = hexToBech32(owner, 'qor');
const txhash = 'A'.repeat(64);
const vault = { estate: target, owner, heir: '0x3333333333333333333333333333333333333333', witness: '0x4444444444444444444444444444444444444444', phase: 'Active', balance: '0', interval: 86400, grace: 86400, due: 2000000000, now: 1999990000, release: 2000086400, nonce: 1, block: 10000000, verified: true, keys: [] };
async function nativeWallet(page, { wrongNetwork = false, reject = false, mismatchedReceipt = false } = {}) {
  await page.addInitScript(({ address, target, wrongNetwork, reject, txhash }) => {
    window.__qorexRequests = [];
    const native = { isQoreX: true, capabilities: ['signAndBroadcast'], enable: async () => null, signDirect: async () => { throw Error('Use signAndBroadcast'); },
      getKey: async () => ({ bech32Address: address, name: 'Test double' }),
      signAndBroadcast: async request => { window.__qorexRequests.push(request); if (reject) throw Error('User rejected the wallet request.'); return { txHash: txhash, code: 0, height: 10000001, shield: 'shielded' }; } };
    window.qorex = { native };
    if (wrongNetwork) {
      const evm = { request: async () => '0x2649' }; window.qorex.evm = evm;
      window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { rdns: 'network.qore.qorex', uuid: 'test', name: 'QoreX' }, provider: evm } })));
    }
    localStorage.setItem('jaydaad.vault', JSON.stringify({ address: target, name: 'Diana family vault' }));
  }, { address: nativeAddress, target, wrongNetwork, reject, txhash });
  await page.route('**/api/account/*', r => r.fulfill({ json: { balances: [{ denom: 'uqor', amount: '100000000' }], window: { found: false, live: false } } }));
  await page.route('**/api/key/*', r => r.fulfill({ json: { registered: true, proven: true, algorithm: 1, bytes: 2592 } }));
  await page.route('**/api/vault/*', r => r.fulfill({ json: vault }));
  await page.route('**/api/receipt/*', async r => {
    const messages = await page.evaluate(() => window.__qorexRequests.at(-1)?.messages || []);
    const decoded = messages.map(m => ({ '@type': m.typeUrl, ...Object.fromEntries(Object.entries(protocol('decode', m)).map(([k, v]) => [k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), v])) }));
    if (mismatchedReceipt && decoded[0]) decoded[0].to_address = nativeAddress;
    await r.fulfill({ json: { tx_response: { txhash, code: 0, height: '10000001' }, tx: { body: { messages: decoded, extension_options: [{ '@type': '/qorechain.pqc.v1.PQCHybridSignature' }] } } } });
  });
}
test('QoreX native funding signs exact uqor amount, targets the vault, and verifies the receipt', async ({ page }) => {
  await nativeWallet(page); await ready(page);
  await connectButton(page).click();
  await expect(page.locator('.wallet-connected')).toBeVisible();
  await page.getByRole('button', { name: 'Add funds', exact: true }).click();
  await page.getByLabel('Amount (test QOR)').fill('1.123456');
  await page.getByRole('button', { name: 'Review transfer in QoreX', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const requests = await page.evaluate(() => window.__qorexRequests);
  expect(requests).toHaveLength(1); expect(requests[0].chainId).toBe('qorechain-diana');
  const message = protocol('decode', requests[0].messages[0]);
  expect(message.toAddress).toBe(hexToBech32(target, 'qor'));
  expect(message.fromAddress).toBe(nativeAddress);
  expect(message.amount).toEqual([{ denom: 'uqor', amount: '1123456' }]);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Hybrid verified' })).toBeVisible();
  await page.getByLabel('Transaction hash').fill(txhash);
  await page.getByRole('button', { name: 'Verify receipt', exact: true }).click();
  await expect(page.locator('#receipt-result')).toContainText('Included successfully');
});
test('QoreX scoped window uses one target and bounded time, count, and value', async ({ page }) => {
  await nativeWallet(page); await ready(page);
  await connectButton(page).click();
  await expect(page.locator('.wallet-connected')).toBeVisible();
  await page.getByRole('link', { name: 'Security center', exact: true }).click();
  await page.getByRole('button', { name: 'Open scoped window', exact: true }).click();
  await page.getByRole('button', { name: 'Review window in QoreX', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const requests = await page.evaluate(() => window.__qorexRequests);
  const message = protocol('decode', requests[0].messages[0]);
  expect(message.allowedTargets).toEqual([target]); expect(String(message.blocks)).toBe('100'); expect(String(message.maxTxs)).toBe('3'); expect(message.maxValue).toBe('1000000');
});
test('mainnet connection is refused before any transaction request', async ({ page }) => {
  await nativeWallet(page, { wrongNetwork: true }); await ready(page);
  await connectButton(page).click();
  await expect(page.getByRole('status')).toContainText('Select Diana testnet');
  expect(await page.evaluate(() => window.__qorexRequests)).toHaveLength(0);
});
test('wallet rejection keeps the funding dialog open and records no success', async ({ page }) => {
  await nativeWallet(page, { reject: true }); await ready(page);
  await connectButton(page).click();
  await expect(page.locator('.wallet-connected')).toBeVisible();
  await page.getByRole('button', { name: 'Add funds', exact: true }).click();
  await page.getByRole('button', { name: 'Review transfer in QoreX', exact: true }).click();
  await expect(page.locator('#modal-error')).toContainText('User rejected');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jaydaad.transactions') || '[]'))).toHaveLength(0);
});

test('an included receipt for a different recipient is never recorded as vault funding', async ({ page }) => {
  await nativeWallet(page, { mismatchedReceipt: true }); await ready(page);
  await connectButton(page).click();
  await expect(page.locator('.wallet-connected')).toBeVisible();
  await page.getByRole('button', { name: 'Add funds', exact: true }).click();
  await page.getByRole('button', { name: 'Review transfer in QoreX', exact: true }).click();
  await expect(page.locator('#modal-error')).toContainText('does not match the action you approved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('jaydaad.transactions') || '[]'))).toHaveLength(0);
});
