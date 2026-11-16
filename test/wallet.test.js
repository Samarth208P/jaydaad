import test from 'node:test';
import assert from 'node:assert/strict';
import { bank, openEvmWindowMsg, closeEvmWindowMsg, qorechainRegistry, bech32ToHex } from '@qorechain/sdk';
import { toMicroQor, toNative } from '../web/wallet.js';

test('native QOR conversion preserves six decimal places without floating point rounding', () => {
  assert.equal(toMicroQor('0.000001'), '1');
  assert.equal(toMicroQor('1.123456'), '1123456');
  assert.equal(toMicroQor('99999999.999999'), '99999999999999');
  for (const input of ['0', '-1', '0.0000001', '1e6', 'Infinity', '1.1234567', '01', '', 'NaN']) assert.throws(() => toMicroQor(input));
});
test('native vault address maps to the exact EVM address bytes', () => {
  const evm = '0x1111111111111111111111111111111111111111';
  assert.equal(bech32ToHex(toNative(evm)).toLowerCase(), evm.toLowerCase());
  assert.throws(() => toNative('0x1234'));
});
test('QoreX messages contain protobuf bytes and restrict the window to the vault', () => {
  const registry = qorechainRegistry();
  const target = '0x1111111111111111111111111111111111111111';
  const sender = toNative('0x2222222222222222222222222222222222222222');
  const message = bank.send({ fromAddress: sender, toAddress: toNative(target), amount: [{ denom: 'uqor', amount: toMicroQor('1.25') }] });
  const encoded = registry.encodeAsAny(message);
  assert.ok(encoded.value instanceof Uint8Array);
  const decoded = registry.decode(encoded);
  assert.equal(decoded.amount[0].denom, 'uqor');
  assert.equal(decoded.amount[0].amount, '1250000');
  assert.equal(decoded.toAddress, toNative(target));
  const open = registry.decode(registry.encodeAsAny(openEvmWindowMsg({ sender, blocks: 100, maxTxs: 3, maxValue: toMicroQor('1'), allowedTargets: [target] })));
  assert.equal(String(open.blocks), '100');
  assert.equal(String(open.maxTxs), '3');
  assert.equal(open.maxValue, '1000000');
  assert.deepEqual(open.allowedTargets, [target]);
  assert.equal(open.nativeOnly, false);
  const close = registry.decode(registry.encodeAsAny(closeEvmWindowMsg(sender)));
  assert.equal(close.sender, sender);
});
