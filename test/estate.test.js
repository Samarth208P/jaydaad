import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox, deposit } from './support.js';
import { matchesRuntime } from '../scripts/network.js';

test('enrollment requires a witnessed check-in before funding', async () => {
  const { estate, execute } = await sandbox();
  await assert.rejects(estate.fund({ value: deposit }), /fund an active estate/);
  await execute(0);
  await (await estate.fund({ value: deposit })).wait();
  assert.equal(await estate.phase(), 1n);
});

test('classical caller alone, mismatched witness, replay and early claim fail', async () => {
  const { estate, owner, heir, approvals } = await sandbox();
  const [action, expiry, participant, witness] = await approvals(0);
  await assert.rejects(estate.connect(owner).execute(action, expiry, participant, participant), /unexpected key/);
  await assert.rejects(estate.connect(owner).execute(action, expiry, participant, { ...witness, signature: '0x' }), /invalid approval/);
  await assert.rejects(estate.connect(heir).execute(action, expiry, participant, witness), /wrong caller/);
  await (await estate.execute(action, expiry, participant, witness)).wait();
  await assert.rejects(estate.execute(action, expiry, participant, witness), /invalid approval/);
  await assert.rejects(estate.connect(heir).execute(...await approvals(2)), /claim unavailable/);
});

test('owner can recover in grace, heir receives entire estate once after the new deadline', async () => {
  const { estate, heir, provider, execute, approvals, advanceTo } = await sandbox();
  await execute(0);
  await (await estate.fund({ value: deposit })).wait();
  await advanceTo(await estate.lastCheckIn() + await estate.interval());
  assert.equal(await estate.phase(), 2n);
  await execute(0);
  assert.equal(await estate.phase(), 1n);
  await advanceTo(await estate.lastCheckIn() + await estate.interval() + await estate.grace());
  assert.equal(await estate.phase(), 3n);
  await assert.rejects(estate.execute(...await approvals(0)), /owner window ended/);
  const before = await provider.getBalance(heir.address);
  const receipt = await execute(2);
  assert.equal(await provider.getBalance(heir.address), before + deposit - receipt.fee);
  assert.equal(await estate.phase(), 4n);
  await assert.rejects(estate.connect(heir).execute(...await approvals(2)), /estate closed/);
});

test('expired approvals fail and owner can close with a fresh witnessed cancellation', async () => {
  const { estate, execute, approvals, advanceTo, provider, owner } = await sandbox();
  await execute(0);
  await (await estate.fund({ value: deposit })).wait();
  const old = await approvals(1);
  await advanceTo(old[1] + 1);
  await assert.rejects(estate.execute(...old), /approval window/);
  const receipt = await execute(1);
  const release = estate.interface.parseLog(receipt.logs.at(-1));
  assert.equal(release.args.recipient, owner.address);
  assert.equal(release.args.amount, deposit);
  assert.equal(await provider.getBalance(await estate.getAddress()), 0n);
});

test('rotating a registry key invalidates otherwise valid pinned approvals', async () => {
  const { estate, owner, directory, approvals } = await sandbox();
  const packet = await approvals(0);
  await (await directory.enroll(owner.address, new Uint8Array(2592).fill(4))).wait();
  await assert.rejects(estate.execute(...packet), /enrolled key no longer current/);
});

test('native deposits arriving after closure go only to the original payout recipient', async () => {
  const { estate, execute, provider, owner, heir } = await sandbox();
  await execute(0);
  await execute(1);
  assert.equal(await estate.payoutRecipient(), owner.address);
  const rpc = (await import('hardhat')).default.network.provider;
  await rpc.send('hardhat_setBalance', [await estate.getAddress(), '0x' + deposit.toString(16)]);
  const before = await provider.getBalance(owner.address);
  // A third party can trigger recovery but cannot choose its destination.
  await (await estate.connect(heir).recoverLateDeposit()).wait();
  assert.equal(await provider.getBalance(owner.address), before + deposit);
  assert.equal(await provider.getBalance(await estate.getAddress()), 0n);
  await assert.rejects(estate.recoverLateDeposit(), /nothing to recover/);
});

test('direct EVM funding requires an active vault and emits the deposit event', async () => {
  const { estate, owner, execute } = await sandbox();
  const to = await estate.getAddress();
  await assert.rejects(owner.sendTransaction({ to, value: deposit }), /fund an active estate/);
  await assert.rejects(estate.recoverLateDeposit(), /estate not closed/);
  await execute(0);
  const r = await (await owner.sendTransaction({ to, value: deposit })).wait();
  assert.equal(estate.interface.parseLog(r.logs[0]).name, 'Funded');
});

test('vault attachment accepts this exact deployed release and rejects changed bytecode', async () => {
  const { estate, provider } = await sandbox();
  const code = await provider.getCode(await estate.getAddress());
  assert.equal(matchesRuntime(code), true);
  assert.equal(matchesRuntime(code.slice(0, -2) + (code.endsWith('00') ? '01' : '00')), false);
  assert.equal(matchesRuntime('0x60006000'), false);
});
