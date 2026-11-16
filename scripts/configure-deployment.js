import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Contract, formatEther, keccak256 } from 'ethers';
import { evmToQor } from '@qorechain/sdk';
import { DIANA, networkHealth, readJson, readVault, provider } from './network.js';

const [primary, demo] = process.argv.slice(2);
if (!primary || !demo) throw Error('Usage: node scripts/configure-deployment.js PRIMARY_ADDRESS DEMO_ADDRESS');
await networkHealth();
const artifact = JSON.parse(await readFile('artifacts/JaydaadEstate.json', 'utf8'));
const files = (await readdir('deployments')).filter(f => /^diana-\d+\.json$/.test(f));
const records = (await Promise.all(files.map(async file => {
  const data = JSON.parse(await readFile('deployments/' + file, 'utf8'));
  if (data.chainId !== 9800 || data.network !== 'qorechain-diana') throw Error('Wrong network in ' + file);
  return data.records.filter(r => r.hash).map(r => ({ ...r, evidenceFile: file }));
}))).flat();
const events = [];
const verified = [];
const blockCache = new Map();
async function nativeWrapper(receipt, ethereumHash) {
  let block = blockCache.get(receipt.blockNumber);
  if (!block) { block = await readJson('/cosmos/base/tendermint/v1beta1/blocks/' + receipt.blockNumber); blockCache.set(receipt.blockNumber, block); }
  for (const raw of (block.block || block.sdk_block)?.data?.txs || []) {
    const hash = createHash('sha256').update(Buffer.from(raw, 'base64')).digest('hex').toUpperCase();
    const data = await readJson('/cosmos/tx/v1beta1/txs/' + hash);
    const msgs = data.tx?.body?.messages || [];
    if (msgs.some(m => m.hash?.replace(/^0x/i, '').toLowerCase() === ethereumHash.replace(/^0x/i, '').toLowerCase())) return { hash, data };
    // A block with exactly one transaction has an unambiguous native wrapper.
    if (((block.block || block.sdk_block)?.data?.txs || []).length === 1 && msgs.some(m => /MsgEthereumTx/.test(m['@type'] || ''))) return { hash, data };
  }
  throw Error('Could not match EVM receipt to its native wrapper: ' + ethereumHash);
}
try {
  for (const record of records) {
    let title, detail, hash = record.hash, height, time, shield;
    if (record.lane === 'native') {
      const data = await readJson('/cosmos/tx/v1beta1/txs/' + record.hash);
      if (Number(data.tx_response.code) !== 0) throw Error('Native transaction failed: ' + record.hash);
      const message = data.tx.body.messages.find(m => m['@type'] === record.action);
      if (!message) throw Error('Native transaction type mismatch: ' + record.hash);
      height = Number(data.tx_response.height); time = data.tx_response.timestamp;
      const ext = [...(data.tx.body.extension_options || []), ...(data.tx.body.non_critical_extension_options || [])];
      const hybrid = ext.some(e => /PQCHybridSignature/.test(e['@type'] || ''));
      if (record.hybrid && !hybrid) throw Error('Expected hybrid extension missing: ' + record.hash);
      shield = hybrid ? 'shielded' : 'classical';
      if (/MsgRegisterPQCKeyV2/.test(record.action)) { title = 'Post-quantum key enrolled'; detail = 'Possession-proven ML-DSA-87 enrollment for ' + record.actor; }
      else if (/MsgOpenEVMWindow/.test(record.action)) { title = 'EVM window opened'; detail = `${message.blocks} blocks, ${message.max_txs} transaction, ${Number(message.max_value) / 1e6} QOR cap; ${(message.allowed_targets || []).length ? 'vault-scoped to ' + message.allowed_targets.join(', ') : 'bounded deployment session'}.`; }
      else if (/MsgCloseEVMWindow/.test(record.action)) { title = 'EVM window closed'; detail = 'Hybrid authorization withdrawn after the operation.'; }
      else if (record.purpose === 'fund-vault-native') { title = record.estate?.toLowerCase() === demo.toLowerCase() ? 'Payout demo funded' : 'Vault funded'; detail = `${record.amountQor} test QOR sent by a hybrid native transfer to ${record.estate}.`; }
      else { title = 'Participant funded'; detail = 'Test QOR transferred to a disposable participant account.'; }
      const feeUqor = data.tx.auth_info.fee.amount.filter(c => c.denom === 'uqor').reduce((sum, c) => sum + BigInt(c.amount), 0n);
      verified.push({ ...record, nativeHash: record.hash, height, verified: true, hybrid, feeWei: (feeUqor * 1000000000000n).toString(), messages: data.tx.body.messages });
    } else {
      const receipt = await provider.getTransactionReceipt(record.hash);
      if (!receipt || receipt.status !== 1) throw Error('EVM transaction not successful: ' + record.hash);
      const wrapper = await nativeWrapper(receipt, record.hash);
      if (Number(wrapper.data.tx_response.code) !== 0) throw Error('Native EVM wrapper failed.');
      hash = wrapper.hash; height = receipt.blockNumber; time = wrapper.data.tx_response.timestamp;
      shield = record.action === 'deploy' ? 'window-authorized' : 'contract-verified';
      const isDemo = record.estate?.toLowerCase() === demo.toLowerCase();
      title = ({ deploy: isDemo ? 'Payout demo deployed' : 'Inheritance vault deployed', checkin: isDemo ? 'Payout demo activated' : 'Witnessed check-in confirmed', claim: 'Beneficiary payout completed', cancel: 'Vault cancelled', fund: 'Vault funded' })[record.action] || record.action;
      detail = `${isDemo ? 'Short-timer demo' : 'Primary vault'} on Diana; EVM transaction ${record.hash}.`;
      verified.push({ ...record, nativeHash: hash, height, verified: true, feeWei: receipt.fee.toString() });
    }
    if (!time) time = new Date((await provider.getBlock(height)).timestamp * 1000).toISOString();
    events.push({ title, detail, hash, evmHash: record.lane === 'evm' ? record.hash : null,
      block: height, time, mode: 'testnet', verified: true, shield, type: 'success' });
  }
  const [mainState, demoState] = await Promise.all([readVault(primary, artifact.abi), readVault(demo, artifact.abi)]);
  if (mainState.phase !== 'Active' || Number(mainState.balance) < 1) throw Error('Primary vault must be active with at least 1 test QOR.');
  if (demoState.phase !== 'Closed' || Number(demoState.balance) !== 0 || demoState.payoutRecipient.toLowerCase() !== demoState.heir.toLowerCase()) throw Error('Payout demo has not settled to the heir.');
  function publicState(state) {
    return { ...state, keys: state.keys.map(({ publicKey, ...key }) => ({ ...key, keyHash: keccak256(publicKey) })) };
  }
  const balances = await Promise.all(['owner', 'heir', 'witness'].map(async role => {
    const account = mainState[role]; return [role, { evm: account, balanceQor: formatEther(await provider.getBalance(account)) }];
  }));
  const metadata = { address: primary, name: 'Jaydaad family vault', heirName: 'Designated testnet beneficiary', witnessName: 'Independent witness · testnet harness' };
  const manifest = { network: 'qorechain-diana', chainId: 9800, recordedAt: new Date().toISOString(),
    deployment: metadata, snapshot: publicState(mainState), demo: publicState(demoState),
    balances: Object.fromEntries(balances), events: events.sort((a, b) => b.block - a.block),
    verifiedReceipts: verified, setupFeesQor: formatEther(verified.reduce((sum, r) => sum + BigInt(r.feeWei), 0n)),
    sourceSha256: createHash('sha256').update(await readFile('contracts/JaydaadEstate.sol')).digest('hex'),
    custody: 'Disposable local testnet harness. Each role has separate ECDSA and PQ secret files. No independent real-person liveness service is configured.',
    walletEvidence: 'Native transfers were executed by the CLI with the same protobuf/hybrid path supported by QoreX. No real QoreX extension approval is claimed.' };
  await writeFile('deployments/diana.json', JSON.stringify(manifest, null, 2));
  const directory = new Contract(DIANA.directory, ['function pqcKeyStatus(address) view returns (bool,uint8,bytes,bool)'], provider);
  const accounts = {};
  for (const [role, balance] of balances) {
    const status = await directory.pqcKeyStatus(balance.evm);
    accounts[role] = { ...balance, native: evmToQor(balance.evm), pqcRegistered: status[0], possessionProven: status[3], algorithm: Number(status[1]), publicKeyHash: keccak256(status[2]) };
  }
  await writeFile('deployments/diana-accounts.json', JSON.stringify({ kind: 'funded-registered-testnet-identities',
    network: 'qorechain-diana', chainId: 9800, checkedAt: manifest.recordedAt, estateDeployment: primary, accounts }, null, 2));
  console.log(JSON.stringify({ primary, phase: mainState.phase, balance: mainState.balance, demo, demoPhase: demoState.phase,
    payoutRecipient: demoState.payoutRecipient, verifiedReceipts: verified.length, balances: manifest.balances }, null, 2));
} finally { provider.destroy(); }
