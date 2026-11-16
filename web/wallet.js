import { discoverQorexEip1193, getQorexNative, hasCapability, qorexSignAndBroadcast, QOREX_DOWNLOAD_URLS } from '@qorechain/qorex-types';
import { bank, openEvmWindowMsg, closeEvmWindowMsg, qorechainRegistry, bech32ToHex, hexToBech32 } from '@qorechain/sdk';
import { BrowserProvider, Contract, ContractFactory, JsonRpcProvider, getAddress, getBytes, hexlify, keccak256, parseUnits } from 'ethers';
import { mldsa } from '@qorechain/pqc';

export const CHAIN = 'qorechain-diana';
export const RPC = 'https://evm-testnet.qore.host';
export const WALLET_URL = QOREX_DOWNLOAD_URLS.chrome;
export const FAUCET_URL = 'https://dashboard.qorechain.io/faucet';
export const explorerTx = hash => `https://explore.qore.network/tx/${encodeURIComponent(hash.replace(/^0x/i, ''))}?network=testnet`;
export const explorerAddress = address => `https://explore.qore.network/address/${encodeURIComponent(hexToBech32(address, 'qor'))}?network=testnet`;
let connected;
let evm;
const rpc = new JsonRpcProvider(RPC, { chainId: 9800, name: 'Diana' }, { staticNetwork: true });
const registry = qorechainRegistry();

export const toNative = address => hexToBech32(getAddress(address), 'qor');
export function toMicroQor(input) {
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,6})?$/.test(String(input))) throw Error('Enter a positive QOR amount with at most 6 decimal places.');
  const value = parseUnits(String(input), 6);
  if (value <= 0n) throw Error('Amount must be greater than zero.');
  return value.toString();
}
export async function api(path, data) {
  const r = await fetch('/api' + path, { ...(data !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  const result = await r.json();
  if (!r.ok) throw Error(result.error || 'Request failed.');
  return result;
}
export async function connectQorex() {
  const native = getQorexNative();
  if (!native) throw Object.assign(Error('Install QoreX, select Diana testnet, then reconnect. You can also open Jaydaad inside QoreX.'), { installWallet: true });
  if (!hasCapability(native, 'signAndBroadcast')) throw Error('Update QoreX to a version with native signAndBroadcast support.');
  evm = await discoverQorexEip1193({ timeoutMs: 500 });
  // Native getKey(chainId) alone does not prove the active EVM network. When the
  // EVM surface is present, require its Diana chain id as an additional check.
  if (evm && Number(BigInt(await evm.request({ method: 'eth_chainId' }))) !== 9800) throw Error('Select Diana testnet in QoreX, then reconnect. Mainnet is disabled.');
  await api('/network');
  await native.enable(CHAIN);
  const key = await native.getKey(CHAIN);
  if (!key.bech32Address?.startsWith('qor1')) throw Error('QoreX did not return a QoreChain account.');
  connected = { address: key.bech32Address, evmAddress: getAddress(bech32ToHex(key.bech32Address)), name: key.name || 'QoreX account', native };
  return { ...connected, native: undefined, ...await walletState() };
}
export function disconnectQorex() { connected = undefined; evm = undefined; }
export async function walletState() {
  if (!connected) return null;
  const current = await connected.native.getKey(CHAIN);
  if (current.bech32Address !== connected.address) { disconnectQorex(); throw Error('The QoreX account changed. Reconnect to review the new account.'); }
  if (evm && Number(BigInt(await evm.request({ method: 'eth_chainId' }))) !== 9800) { disconnectQorex(); throw Error('QoreX is no longer on Diana. Reconnect after selecting testnet.'); }
  const [account, key] = await Promise.all([api('/account/' + connected.address), api('/key/' + connected.evmAddress)]);
  return { ...account, key, balance: Number(account.balances.find(c => c.denom === 'uqor')?.amount || 0) / 1e6 };
}
async function broadcast(message, memo) {
  if (!connected) throw Error('Connect QoreX first.');
  await walletState();
  await api('/network');
  const encoded = registry.encodeAsAny(message);
  const result = await qorexSignAndBroadcast({ chainId: CHAIN, messages: [{ typeUrl: encoded.typeUrl, value: Array.from(encoded.value) }], memo, gasLimit: 500000 }, { native: connected.native });
  if (Number(result.code) !== 0) throw Error(`QoreX transaction failed with code ${result.code}. No success was recorded.`);
  if (!/^(0x)?[a-f\d]{64}$/i.test(result.txHash || '')) throw Error('QoreX returned no valid transaction hash. Check the wallet history before retrying.');
  // Re-read inclusion from Diana; a wallet's success response is not itself a receipt.
  let committed;
  for (let i = 0; i < 8; i++) {
    try { committed = await api('/receipt/' + result.txHash); break; } catch { await new Promise(r => setTimeout(r, 1500)); }
  }
  if (!committed) return { ...result, verified: false, shield: 'pending', pending: true };
  const tx = committed.tx_response;
  if (Number(tx.code) !== 0) throw Error(`Diana rejected the transaction: ${tx.raw_log || tx.code}`);
  if (tx.txhash.toLowerCase() !== result.txHash.replace(/^0x/i, '').toLowerCase()) throw Error('Diana receipt hash does not match the wallet result.');
  const body = committed.tx?.body;
  const included = body?.messages;
  const expected = message.value;
  const actual = included?.[0];
  let matches = included?.length === 1 && actual?.['@type'] === message.typeUrl;
  if (message.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
    matches &&= actual.from_address === expected.fromAddress && actual.to_address === expected.toAddress
      && actual.amount?.length === 1 && actual.amount[0].denom === 'uqor'
      && actual.amount[0].amount === expected.amount[0].amount;
  } else if (message.typeUrl === '/qorechain.pqc.v1.MsgOpenEVMWindow') {
    matches &&= actual.sender === expected.sender && String(actual.blocks) === String(expected.blocks)
      && String(actual.max_txs) === String(expected.maxTxs) && actual.max_value === expected.maxValue
      && JSON.stringify(actual.allowed_targets || []) === JSON.stringify(expected.allowedTargets)
      && !actual.native_only;
  } else if (message.typeUrl === '/qorechain.pqc.v1.MsgCloseEVMWindow') matches &&= actual.sender === expected.sender;
  if (!matches) throw Error('The included transaction does not match the action you approved. Review the wallet history before retrying.');
  const options = [...(body?.extension_options || []), ...(body?.non_critical_extension_options || [])];
  const hybrid = options.some(o => /PQCHybridSignature/.test(o['@type'] || o.type_url || ''));
  return { ...result, height: Number(tx.height), verified: true, shield: hybrid ? 'shielded' : 'downgraded', receipt: committed };
}
export async function fundVault(vault, amount) {
  if (!connected) throw Error('Connect QoreX before funding your vault.');
  const fresh = await api('/vault/' + vault.estate);
  if (fresh.phase !== 'Active') throw Error('Only fund an active vault. Complete its first witnessed check-in first.');
  const micro = toMicroQor(amount);
  const wallet = await walletState();
  if (BigInt(micro) >= BigInt(wallet.balances.find(c => c.denom === 'uqor')?.amount || '0')) throw Error('Leave some test QOR in your wallet for the network fee.');
  return broadcast(bank.send({ fromAddress: connected.address, toAddress: toNative(vault.estate), amount: [{ denom: 'uqor', amount: micro }] }), 'Jaydaad: fund inheritance vault');
}
export async function openWindow(vault, { blocks = 100, maxTxs = 3, maxValue = '1' } = {}) {
  if (!connected) throw Error('Connect QoreX first.');
  await api('/vault/' + vault.estate);
  return broadcast(openEvmWindowMsg({ sender: connected.address, blocks, maxTxs,
    maxValue: toMicroQor(maxValue), allowedTargets: [getAddress(vault.estate)] }), 'Jaydaad: authorize this vault only');
}
export async function closeWindow() {
  if (!connected) throw Error('Connect QoreX first.');
  return broadcast(closeEvmWindowMsg(connected.address), 'Jaydaad: close EVM authorization');
}
async function evmSigner() {
  if (!connected || !evm) throw Error('Connect the QoreX EVM provider.');
  await walletState();
  const accounts = await evm.request({ method: 'eth_requestAccounts' });
  if (!Array.isArray(accounts) || !accounts[0]) throw Error('QoreX did not return an EVM account.');
  return new BrowserProvider(evm).getSigner(accounts[0]);
}
export async function deployVault({ heir, witness, interval, grace }) {
  // Ready for QoreX builds with eth_sendTransaction. Current store builds refuse
  // it explicitly; the UI explains the supported CLI path instead of faking a tx.
  if (getAddress(heir) === getAddress(witness)) throw Error('The beneficiary and witness must be different people and addresses.');
  const artifact = await api('/artifact');
  const signer = await evmSigner();
  const owner = await signer.getAddress();
  if ([heir, witness].some(a => getAddress(a) === owner)) throw Error('Owner, beneficiary and witness need distinct addresses.');
  for (const address of [owner, heir, witness]) {
    const k = await api('/key/' + getAddress(address));
    if (!k.registered || !k.proven || k.algorithm !== 1 || k.bytes !== 2592) throw Error(`Register a possession-proven ML-DSA-87 key for ${address} before deploying.`);
  }
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(getAddress(heir), getAddress(witness), interval, grace);
  await contract.waitForDeployment();
  return { address: await contract.getAddress(), hash: contract.deploymentTransaction().hash };
}
export async function executeProof(vault, packet, expectedAction) {
  await api('/vault/' + vault.estate);
  const artifact = await api('/artifact');
  const c = new Contract(vault.estate, artifact.abi, rpc);
  if (packet.chainId !== 9800 || getAddress(packet.estate) !== getAddress(vault.estate)) throw Error('Approval package is for a different vault or chain.');
  if (packet.action !== expectedAction) throw Error('Approval action does not match the selected operation.');
  const block = await rpc.getBlock('latest');
  if (!Number.isSafeInteger(packet.validUntil) || packet.validUntil < block.timestamp || packet.validUntil > block.timestamp + 600) throw Error('Approvals expired or have an invalid time window. Generate fresh approvals.');
  const actor = expectedAction === 2 ? await c.heir() : await c.owner();
  const witness = await c.witness();
  for (const [address, proof] of [[actor, packet.participant], [witness, packet.approval]]) {
    const key = getBytes(proof.key), signature = getBytes(proof.signature);
    if (keccak256(key) !== await c.enrolledKey(address)) throw Error('Approval key does not match the enrolled participant.');
    if (!mldsa.verify(key, getBytes(await c.message(expectedAction, address, packet.validUntil)), signature)) throw Error('Invalid post-quantum approval signature.');
  }
  const signer = await evmSigner();
  if (getAddress(await signer.getAddress()) !== getAddress(actor)) throw Error('Select the account authorized for this action in QoreX.');
  const tx = await c.connect(signer).execute(expectedAction, packet.validUntil, packet.participant, packet.approval);
  const receipt = await tx.wait();
  return { txHash: tx.hash, height: receipt.blockNumber, verified: receipt.status === 1, shield: 'contract-verified' };
}
