import { Contract, FetchRequest, JsonRpcProvider, formatEther, getAddress, keccak256, ZeroAddress } from 'ethers';
import { readFileSync } from 'node:fs';
import solc from 'solc';

export const DIANA = Object.freeze({ name: 'Diana testnet', chainId: 9800,
  nativeChainId: 'qorechain-diana', rpc: 'https://evm-testnet.qore.host',
  rest: 'https://api-testnet.qore.host', explorer: 'https://explore.qore.network',
  directory: '0x0000000000000000000000000000000000000A02',
  verifier: '0x0000000000000000000000000000000000000A01' });
const request = new FetchRequest(DIANA.rpc);
request.timeout = 10000;
export const provider = new JsonRpcProvider(request, { chainId: 9800, name: 'Diana' }, { staticNetwork: true, cacheTimeout: -1 });
const directory = new Contract(DIANA.directory,
  ['function pqcKeyStatus(address) view returns (bool,uint8,bytes,bool)'], provider);

export async function readJson(path) {
  const r = await fetch(DIANA.rest + path, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Object.assign(Error(`Diana returned HTTP ${r.status}. Try again shortly.`), { status: r.status });
  return r.json();
}
export async function readReceipt(hash) {
  const clean = hash.replace(/^0x/i, '');
  if (!/^[a-f0-9]{64}$/i.test(clean)) throw Error('Invalid transaction hash.');
  try { return { lane: 'native', ...await readJson('/cosmos/tx/v1beta1/txs/' + clean) }; }
  catch (error) {
    if (![400, 404].includes(error.status)) throw error;
    const receipt = await provider.getTransactionReceipt('0x' + clean);
    if (!receipt) throw Error('Transaction not found on Diana. Check the hash or wait for inclusion.');
    return { lane: 'evm', tx_response: { txhash: clean.toUpperCase(), code: receipt.status === 1 ? 0 : 1,
      height: String(receipt.blockNumber), raw_log: receipt.status === 1 ? '' : 'EVM execution reverted' },
      tx: { body: { messages: [], extension_options: [], non_critical_extension_options: [] } },
      evm_receipt: { transactionHash: receipt.hash, from: receipt.from, to: receipt.to,
        status: receipt.status, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), feeWei: receipt.fee.toString() } };
  }
}
export async function keyStatus(address) {
  const [registered, algorithm, key, proven] = await directory.pqcKeyStatus(getAddress(address));
  return { registered, algorithm: Number(algorithm), proven, bytes: (key.length - 2) / 2, publicKey: key };
}
let healthCache;
export async function networkHealth() {
  if (healthCache && Date.now() - healthCache.at < 15000) return healthCache.value;
  const [chain, block, registry] = await Promise.all([
    provider.send('eth_chainId', []), provider.getBlock('latest'), keyStatus(ZeroAddress)
  ]);
  if (Number(BigInt(chain)) !== 9800) throw Error('RPC is not QoreChain Diana. Transactions are disabled.');
  const value = { ...DIANA, connected: true, block: block.number, blockTime: block.timestamp,
    registryAvailable: typeof registry.registered === 'boolean', checkedAt: new Date().toISOString() };
  healthCache = { at: Date.now(), value };
  return value;
}
let runtimeReference;
export function matchesRuntime(code) {
  // Previously deployed immutable vaults remain attachable and redeemable.
  if (['0x3ba3322f57b186f95d1185ce6412be1daa7a34614074b781d35b0f81ef1b70aa',
       '0x13839e9cd866ac1e0f91530992b86949e15cf439cd0ce950c4e0d776df3238df',
       '0xfa74f2b289d8aeb6fa7bce5190fff9b9dea9b57e1ed6f69e9d99e7c3c9c6e1aa'].includes(keccak256(code))) return true;
  if (!runtimeReference) {
    const result = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity',
      sources: { 'contracts/JaydaadEstate.sol': { content: readFileSync('contracts/JaydaadEstate.sol', 'utf8') } },
      settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['evm.deployedBytecode'] } } }
    })));
    const { object, immutableReferences } = result.contracts['contracts/JaydaadEstate.sol'].JaydaadEstate.evm.deployedBytecode;
    const mask = new Set(Object.values(immutableReferences).flat().flatMap(r => Array.from({ length: r.length * 2 }, (_, i) => r.start * 2 + i)));
    runtimeReference = { object, mask };
  }
  code = code.slice(2).toLowerCase();
  const { object, mask } = runtimeReference;
  return code.length === object.length && [...object].every((v, i) => mask.has(i) || v.toLowerCase() === code[i]);
}
export async function readVault(address, abi) {
  await networkHealth();
  address = getAddress(address);
  const code = await provider.getCode(address);
  if (code === '0x') throw Error('No contract at this Diana address. Deploy a Jaydaad vault first.');
  if (!matchesRuntime(code)) throw Error('Contract bytecode does not match this Jaydaad release. Attach the correct deployment.');
  const c = new Contract(address, abi, provider);
  const [owner, heir, witness, interval, grace, last, nonce, phase, balance, block, payoutRecipient] = await Promise.all([
    c.owner(), c.heir(), c.witness(), c.interval(), c.grace(), c.lastCheckIn(), c.nonce(), c.phase(),
    provider.getBalance(address), provider.getBlock('latest'), c.payoutRecipient()
  ]);
  const keys = await Promise.all([owner, heir, witness].map(async account => {
    const status = await keyStatus(account);
    return { address: account, ...status, pinned: status.registered && keccak256(status.publicKey) === await c.enrolledKey(account) };
  }));
  return { mode: 'testnet', estate: address, owner, heir, witness, interval: Number(interval), grace: Number(grace),
    lastCheckIn: Number(last), nonce: Number(nonce), phase: ['Enrollment', 'Active', 'Grace', 'Claimable', 'Closed'][Number(phase)],
    balance: formatEther(balance), now: block.timestamp, block: block.number, keys, verified: true, payoutRecipient,
    due: last ? Number(last + interval) : null, release: last ? Number(last + interval + grace) : null, events: [] };
}
