import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Contract, ContractFactory, Wallet, getBytes, hexlify, parseEther } from 'ethers';
import { mldsa } from '@qorechain/pqc';
import { StargateClient } from '@cosmjs/stargate';
import { EthNativeSigner, unifiedAccountFromSeed, openEvmWindowMsg, closeEvmWindowMsg, bank,
  buildRegisterPqcKeyMsg, signProofOfPossession } from '@qorechain/sdk';
import { DIANA, provider, networkHealth, readJson, keyStatus, readVault } from './network.js';
import { buildProject } from './build.js';

const { values: options, positionals } = parseArgs({ allowPositionals: true, options: {
  config: { type: 'string', default: '.local/diana.json' }, vault: { type: 'string' }, action: { type: 'string' },
  amount: { type: 'string' }, 'register-keys': { type: 'boolean', default: false },
  'export-proof': { type: 'string' }, help: { type: 'boolean', short: 'h' }
} });
const command = positionals[0] || options.action || 'status';
const configPath = resolve(options.config);
const publicRecords = [];
let transport;
const out = message => console.log(message);

async function init() {
  await mkdir(dirname(configPath), { recursive: true });
  // Refuse to replace existing secrets or a configuration.
  try { await readFile(configPath); throw Error('Configuration already exists. Choose a different --config path.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const config = { network: 'qorechain-diana', interval: 3600, grace: 1800, accounts: {} };
  const accounts = {};
  for (const role of ['owner', 'heir', 'witness']) {
    const key = Wallet.createRandom().privateKey;
    const entropy = randomBytes(32);
    const classicalPath = resolve(dirname(configPath), 'classical', `${role}.key`);
    const pqPath = resolve(dirname(configPath), 'post-quantum', `${role}.entropy`);
    await mkdir(dirname(classicalPath), { recursive: true }); await mkdir(dirname(pqPath), { recursive: true });
    await writeFile(classicalPath, key, { flag: 'wx', mode: 0o600 });
    await writeFile(pqPath, entropy.toString('hex'), { flag: 'wx', mode: 0o600 });
    config.accounts[role] = { classicalKeyFile: classicalPath, pqEntropyFile: pqPath };
    const account = unifiedAccountFromSeed(getBytes(key), { pqcSecret: entropy });
    accounts[role] = { evm: account.evm, native: account.cosmos };
  }
  await writeFile(configPath, JSON.stringify(config, null, 2), { flag: 'wx', mode: 0o600 });
  out('Created three disposable Diana identities. Secret files are under .local/ and are ignored by Git.');
  out('Fund these PUBLIC addresses with free test QOR at https://dashboard.qorechain.io/faucet:');
  out(JSON.stringify(accounts, null, 2));
  out('For independent custody, move each role’s two key files to its own device and update the file paths.');
}
async function load() {
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') throw Error('No private configuration. Run: npm run estate -- init. Read docs/TESTNET.md.'); throw e; }
  if (config.network !== DIANA.nativeChainId) throw Error('Configuration must explicitly name qorechain-diana. Mainnet is disabled.');
  if (!Number.isInteger(config.interval) || !Number.isInteger(config.grace) || config.interval < 60 || config.grace < 60 || config.interval > 31536000 || config.grace > 31536000) throw Error('Use integer timer values between 60 and 31536000 seconds.');
  const accounts = {};
  for (const role of ['owner', 'heir', 'witness']) {
    const record = config.accounts?.[role];
    if (!record?.classicalKeyFile || !record?.pqEntropyFile) throw Error(`Missing ${role} key file references.`);
    const key = (await readFile(resolve(dirname(configPath), record.classicalKeyFile), 'utf8')).trim();
    const entropy = (await readFile(resolve(dirname(configPath), record.pqEntropyFile), 'utf8')).trim();
    if (!/^(0x)?[a-f\d]{64}$/i.test(key) || !/^[a-f\d]{64}$/i.test(entropy)) throw Error(`Invalid ${role} key file format.`);
    accounts[role] = unifiedAccountFromSeed(getBytes(key.startsWith('0x') ? key : '0x' + key), { pqcSecret: getBytes('0x' + entropy) });
  }
  if (new Set(Object.values(accounts).map(a => a.evm)).size !== 3) throw Error('Owner, heir, and witness must be distinct.');
  return { config, accounts };
}
async function native(account, message, classical = false) {
  transport ||= await StargateClient.connect('https://rpc-testnet.qore.host');
  const auth = await readJson('/cosmos/auth/v1beta1/accounts/' + account.cosmos);
  let base = auth.account;
  for (let i = 0; i < 5 && base?.account_number === undefined; i++) base = base?.base_account || base?.base_vesting_account || base?.baseAccount;
  if (!base?.account_number || base.sequence === undefined) throw Error('Account is not funded/initialized on Diana. Use the faucet first.');
  const signer = new EthNativeSigner(account, { signMode: classical ? 'classical' : 'hybrid', rest: DIANA.rest });
  const result = await signer.signAndBroadcast(transport, { chainId: DIANA.nativeChainId,
    accountNumber: BigInt(base.account_number), sequence: BigInt(base.sequence), messages: [message],
    fee: { gas: '1800000', amount: [{ denom: 'uqor', amount: '180000' }] }, memo: 'Jaydaad inheritance vault' });
  if (result.code !== 0) throw Error(`Native transaction failed: ${result.rawLog || result.code}`);
  const record = { lane: 'native', action: message.typeUrl, hash: result.transactionHash, block: result.height,
    actor: account.evm, hybrid: !classical, time: new Date().toISOString() };
  publicRecords.push(record); out(`${message.typeUrl.split('.').at(-1)} confirmed: ${record.hash}`);
  return record;
}
async function enroll(accounts) {
  for (const [role, account] of Object.entries(accounts)) {
    const k = await keyStatus(account.evm);
    if (k.registered) {
      if (k.publicKey.toLowerCase() !== hexlify(account.pqc.publicKey).toLowerCase()) throw Error(`${role} has a different PQ key registered. Refusing to replace it.`);
      if (!k.proven) throw Error(`${role} key lacks proof of possession. Use the official possession-proof flow before enrollment.`);
      continue;
    }
    if (!options['register-keys']) throw Error(`${role} has no PQ key. Fund it, then run with --register-keys to explicitly enroll.`);
    await native(account, buildRegisterPqcKeyMsg(account.cosmos, { pqcKeypair: account.pqc,
      ecdsaPubkey: getBytes(account.publicKey), keyType: 'hybrid',
      proofOfPossession: signProofOfPossession({ chainId: DIANA.nativeChainId, account: account.cosmos, keypair: account.pqc }) }), true);
    const verified = await keyStatus(account.evm);
    if (!verified.proven || !verified.registered) throw Error(`Diana did not confirm a possession-proven key for ${role}.`);
  }
}
async function withWindow(account, target, fn) {
  await native(account, openEvmWindowMsg({ sender: account.cosmos, blocks: 100, maxTxs: 1,
    maxValue: '5000000', ...(target ? { allowedTargets: [target] } : {}) }));
  try { return await fn(); }
  finally {
    try { await native(account, closeEvmWindowMsg(account.cosmos)); }
    catch (e) { out('WINDOW CLOSE FAILED. Revoke it in QoreX or with the native CLI. It expires after 100 blocks.'); throw e; }
  }
}
async function run() {
  if (options.help) { out('Commands: init, status, bootstrap, deploy, checkin, cancel, claim, fund, fund-native, recover. See docs/TESTNET.md.'); return; }
  if (command === 'init') return init();
  if (!['status', 'bootstrap', 'deploy', 'checkin', 'cancel', 'claim', 'fund', 'fund-native', 'recover'].includes(command)) throw Error('Unknown command. Use --help.');
  await networkHealth();
  const { config, accounts } = await load();
  if (command === 'status') {
    for (const [role, a] of Object.entries(accounts)) out(JSON.stringify({ role, evm: a.evm, native: a.cosmos,
      balance: (await provider.getBalance(a.evm)).toString(), key: await keyStatus(a.evm) }));
    return;
  }
  if (command === 'bootstrap') {
    // One legitimate faucet claim to the owner can fund both other disposable
    // roles. This is an ordinary hybrid bank transfer, not extra faucet claims.
    await enroll({ owner: accounts.owner });
    for (const role of ['heir', 'witness']) {
      const balance = await provider.getBalance(accounts[role].evm);
      if (balance < parseEther('2')) {
        if (await provider.getBalance(accounts.owner.evm) < parseEther('3')) throw Error('The owner needs at least 3 test QOR before funding another role.');
        await native(accounts.owner, bank.send({ fromAddress: accounts.owner.cosmos, toAddress: accounts[role].cosmos,
          amount: [{ denom: 'uqor', amount: '2000000' }] }));
      }
    }
    await enroll(accounts);
    out('All three disposable roles have funded, possession-proven Diana identities.');
    return;
  }
  await buildProject();
  const artifact = JSON.parse(await readFile('artifacts/JaydaadEstate.json', 'utf8'));
  await enroll(accounts);
  if (command === 'deploy') {
    const address = await withWindow(accounts.owner, null, async () => {
      const factory = new ContractFactory(artifact.abi, artifact.bytecode, new Wallet(accounts.owner.privateKey, provider));
      const estate = await factory.deploy(accounts.heir.evm, accounts.witness.evm, config.interval, config.grace);
      const r = await estate.deploymentTransaction().wait();
      const address = await estate.getAddress();
      publicRecords.push({ lane: 'evm', action: 'deploy', hash: r.hash, block: r.blockNumber, estate: address });
      out('Diana vault deployed: ' + address); return address;
    });
    publicRecords.push({ estate: address, owner: accounts.owner.evm, heir: accounts.heir.evm, witness: accounts.witness.evm, interval: config.interval, grace: config.grace });
    return;
  }
  if (!options.vault) throw Error('Provide --vault 0xCONTRACT_ADDRESS.');
  const vault = await readVault(options.vault, artifact.abi);
  const actor = command === 'claim' ? accounts.heir : accounts.owner;
  const expectedRole = command === 'claim' ? vault.heir : vault.owner;
  if (actor.evm.toLowerCase() !== expectedRole.toLowerCase() || accounts.witness.evm.toLowerCase() !== vault.witness.toLowerCase()) throw Error('Configuration participants do not match this vault.');
  if (command === 'fund-native') {
    if (vault.phase !== 'Active') throw Error('Native funding requires an active vault at preflight.');
    if (!options.amount || !/^(0|[1-9]\d{0,7})(\.\d{1,6})?$/.test(options.amount) || parseEther(options.amount) <= 0n) throw Error('Provide a positive --amount with at most six decimals.');
    const { parseUnits } = await import('ethers');
    const { evmToQor } = await import('@qorechain/sdk');
    const record = await native(actor, bank.send({ fromAddress: actor.cosmos, toAddress: evmToQor(vault.estate),
      amount: [{ denom: 'uqor', amount: parseUnits(options.amount, 6).toString() }] }));
    record.estate = vault.estate; record.amountQor = options.amount; record.purpose = 'fund-vault-native';
    const after = await readVault(vault.estate, artifact.abi);
    out('Vault native funding confirmed. Actual EVM balance: ' + after.balance + ' QOR');
    return;
  }
  await withWindow(actor, vault.estate, async () => {
    const estate = new Contract(vault.estate, artifact.abi, new Wallet(actor.privateKey, provider));
    if (command === 'fund') {
      if (!options.amount || !/^\d+(\.\d{1,6})?$/.test(options.amount) || parseEther(options.amount) <= 0n) throw Error('Provide a positive --amount in QOR with at most 6 decimal places.');
      const r = await (await estate.fund({ value: parseEther(options.amount) })).wait();
      publicRecords.push({ lane: 'evm', action: 'fund', hash: r.hash, block: r.blockNumber, estate: vault.estate }); return;
    }
    if (command === 'recover') {
      const r = await (await estate.recoverLateDeposit()).wait();
      publicRecords.push({ lane: 'evm', action: 'recover', hash: r.hash, block: r.blockNumber, estate: vault.estate }); return;
    }
    const action = { checkin: 0, cancel: 1, claim: 2 }[command];
    if (action === undefined) throw Error('Unknown action. Use checkin, cancel, claim, fund, or recover.');
    const validUntil = (await provider.getBlock('latest')).timestamp + 300;
    async function proof(a) {
      const message = getBytes(await estate.message(action, a.evm, validUntil));
      const signature = mldsa.sign(a.pqc.secretKey, message);
      if (!mldsa.verify(a.pqc.publicKey, message, signature)) throw Error('Local signature verification failed.');
      return { key: hexlify(a.pqc.publicKey), signature: hexlify(signature) };
    }
    const packet = { chainId: 9800, estate: vault.estate, action, validUntil,
      participant: await proof(actor), approval: await proof(accounts.witness) };
    if (options['export-proof']) {
      await writeFile(options['export-proof'], JSON.stringify(packet, null, 2));
      out('Public approval packet exported. It expires in five minutes.'); return;
    }
    const r = await (await estate.execute(action, validUntil, packet.participant, packet.approval)).wait();
    publicRecords.push({ lane: 'evm', action: command, hash: r.hash, block: r.blockNumber, estate: vault.estate,
      participant: actor.evm, witness: accounts.witness.evm });
    out(`${command} confirmed: ${r.hash}`);
  });
}
try { await run(); }
catch (e) { console.error(e.shortMessage || e.message); process.exitCode = 1; }
finally {
  if (publicRecords.length) {
    await mkdir('deployments', { recursive: true });
    const name = `deployments/diana-${Date.now()}.json`;
    await writeFile(name, JSON.stringify({ chainId: 9800, network: 'qorechain-diana', recordedAt: new Date().toISOString(), records: publicRecords }, null, 2));
    out('Public evidence saved to ' + name);
  }
  transport?.disconnect(); provider.destroy();
}
