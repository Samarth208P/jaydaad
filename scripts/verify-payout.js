import { readdir, readFile, writeFile } from 'node:fs/promises';
import { Interface } from 'ethers';
import { networkHealth, provider, readJson } from './network.js';
const claimHash = process.argv[2];
if (!claimHash) throw Error('Provide the real claim transaction hash.');
await networkHealth();
try {
  const before = JSON.parse(await readFile('deployments/payout-accounting.json', 'utf8'));
  const artifact = JSON.parse(await readFile('artifacts/JaydaadEstate.json', 'utf8'));
  const receipt = await provider.getTransactionReceipt(claimHash);
  if (!receipt || receipt.status !== 1 || receipt.to.toLowerCase() !== before.vault.toLowerCase()) throw Error('No successful claim receipt for the expected vault.');
  const iface = new Interface(artifact.abi);
  const release = receipt.logs.map(log => { try { return iface.parseLog(log); } catch { return null; } }).find(log => log?.name === 'Released');
  if (!release || Number(release.args.action) !== 2 || release.args.recipient.toLowerCase() !== before.heir.toLowerCase()) throw Error('The vault did not release funds to the expected heir.');
  const files = (await readdir('deployments')).filter(f => /^diana-\d+\.json$/.test(f));
  let operation;
  for (const file of files) {
    const data = JSON.parse(await readFile('deployments/' + file, 'utf8'));
    if (data.records.some(r => r.hash?.toLowerCase() === claimHash.toLowerCase())) { operation = data; break; }
  }
  if (!operation) throw Error('Missing claim operation evidence file.');
  let nativeFees = 0n;
  const feeReceipts = [];
  for (const record of operation.records.filter(r => r.lane === 'native')) {
    const tx = await readJson('/cosmos/tx/v1beta1/txs/' + record.hash);
    if (Number(tx.tx_response.code) !== 0) throw Error('Window operation failed.');
    const amount = tx.tx.auth_info.fee.amount.find(c => c.denom === 'uqor')?.amount || '0';
    nativeFees += BigInt(amount) * 1000000000000n;
    feeReceipts.push({ hash: record.hash, amountUqor: amount });
  }
  const after = await provider.getBalance(before.heir);
  const expected = BigInt(before.balanceBeforeWei) + release.args.amount - receipt.fee - nativeFees;
  const report = { ...before, status: after === expected ? 'verified' : 'accounting-mismatch', claimHash,
    block: receipt.blockNumber, payoutWei: release.args.amount.toString(), recipient: release.args.recipient,
    balanceAfterWei: after.toString(), expectedBalanceAfterWei: expected.toString(),
    evmFeeWei: receipt.fee.toString(), nativeWindowFeesWei: nativeFees.toString(), nativeFeeReceipts: feeReceipts,
    checkedAt: new Date().toISOString(), explanation: 'Heir balance after = balance before + vault payout - EVM claim gas - native window open/close fees.' };
  await writeFile('deployments/payout-accounting.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'verified') process.exitCode = 1;
} finally { provider.destroy(); }
