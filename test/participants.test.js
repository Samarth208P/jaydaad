import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { HandleClient, recordSignBytes, signClaim } from '@qorechain/handles';
import { hexToBech32 } from '@qorechain/sdk';
import { Wallet, getBytes, ripemd160, sha256 } from 'ethers';
import { envelopeFromText, open } from '@qorechain/qoreseal';
import { resolveRoleHandle } from '../scripts/handles.js';
import { encryptHandover, notePurpose } from '../web/handover.js';
import { recipientFixture } from './recipient-fixture.js';

test('handle lookup verifies both signatures and binds the requested name and EVM address', async () => {
  const registry = generateKeyPairSync('ed25519');
  const owner = Wallet.createRandom();
  const qorAddress = hexToBech32(ripemd160(sha256(owner.signingKey.compressedPublicKey)), 'qor');
  const handle = 'family_heir';
  const record = { handle, qorAddress, evmAddress: owner.address, createdAt: 1, pqcRegistered: true,
    ...signClaim(handle, qorAddress, getBytes(owner.privateKey)) };
  const signRecord = () => sign(null, recordSignBytes(record), registry.privateKey).toString('hex');
  record.sigRegistryHex = signRecord();
  const client = new HandleClient({ baseUrl: 'https://test.invalid',
    registryPubkeyHex: Buffer.from(registry.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex'),
    fetchImpl: async () => Response.json({ record }) });
  assert.deepEqual(await resolveRoleHandle('@family_heir', client), { handle, address: owner.address });
  await assert.rejects(resolveRoleHandle('@another_user', client), /different handle/);
  record.evmAddress = Wallet.createRandom().address;
  await assert.rejects(resolveRoleHandle(handle, client), /verification/);
  record.sigRegistryHex = signRecord();
  await assert.rejects(resolveRoleHandle(handle, client), /signed owner key/);
});

test('a handover note opens only with the recipient keys and correct vault context', () => {
  const { card, keys, vault, kem } = recipientFixture();
  const packet = encryptHandover(vault, card, kem, 'Ask Mira for the document index.');
  const args = { chainId: packet.chainId, purpose: notePurpose(vault.estate), keys, envelope: envelopeFromText(packet.envelope) };
  assert.equal(new TextDecoder().decode(open(args)), 'Ask Mira for the document index.');
  const other = recipientFixture();
  assert.throws(() => open({ ...args, keys: other.keys }));
  assert.throws(() => open({ ...args, purpose: notePurpose(other.vault.heir) }));
  assert.throws(() => encryptHandover(vault, other.card, kem, 'Private'), /card/);
  assert.throws(() => encryptHandover(vault, card, other.kem, 'Private'), /registered/);
  vault.keys[0].pinned = false;
  assert.throws(() => encryptHandover(vault, card, kem, 'Private'), /enrolled/);
});
