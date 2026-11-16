import { readFile, writeFile } from 'node:fs/promises';
import { Contract, getBytes } from 'ethers';
import { networkHealth, provider } from './network.js';

const [address, checkinHash] = process.argv.slice(2);
if (!address || !checkinHash) throw Error('Usage: node scripts/live-security.js VAULT CHECKIN_TX_HASH');
await networkHealth();
const artifact = JSON.parse(await readFile('artifacts/JaydaadEstate.json', 'utf8'));
const estate = new Contract(address, artifact.abi, provider);
const tx = await provider.getTransaction(checkinHash);
if (!tx || tx.to?.toLowerCase() !== address.toLowerCase()) throw Error('Check-in transaction does not target this vault.');
const original = estate.interface.decodeFunctionData('execute', tx.data);
const owner = await estate.owner();
const heir = await estate.heir();
const expiry = (await provider.getBlock('latest')).timestamp + 300;
const participant = { key: original.participant.key, signature: original.participant.signature };
const witness = { key: original.approval.key, signature: original.approval.signature };
const checks = [];
async function rejects(name, from, action, validUntil, actorProof, witnessProof, expected) {
  const data = estate.interface.encodeFunctionData('execute', [action, validUntil, actorProof, witnessProof]);
  try {
    await provider.call({ to: address, from, data });
    checks.push({ name, passed: false, reason: 'Unexpectedly accepted in simulation.' });
  } catch (error) {
    const reason = error.reason || error.shortMessage || error.message;
    checks.push({ name, passed: reason.includes(expected), reason });
  }
}
try {
  await rejects('Classical key without participant PQ signature', owner, 0, expiry, { ...participant, signature: '0x' }, witness, 'invalid approval');
  await rejects('Wrong transaction caller', heir, 0, expiry, participant, witness, 'wrong caller');
  await rejects('Beneficiary claim before grace expiry', heir, 2, expiry, participant, witness, 'claim unavailable');
  const originalExpiry = Number(original.validUntil);
  const now = (await provider.getBlock('latest')).timestamp;
  await rejects('Replay of the successful witnessed check-in', owner, Number(original.action), originalExpiry, participant, witness,
    originalExpiry >= now ? 'invalid approval' : 'approval window');
  if (getBytes(participant.key).length !== 2592) throw Error('Original transaction does not contain an ML-DSA-87 key.');
  const report = { kind: 'read-only-live-contract-simulations', chainId: 9800, network: 'qorechain-diana',
    estate: address, positiveCheckinTransaction: checkinHash, recordedAt: new Date().toISOString(),
    transactionBroadcast: false, checks, passed: checks.every(c => c.passed),
    note: 'These are live eth_call simulations; they did not broadcast attack transactions or move funds.' };
  await writeFile('deployments/diana-security.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally { provider.destroy(); }
