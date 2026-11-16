import hre from 'hardhat';
import { BrowserProvider, Contract, ContractFactory, getBytes, parseEther } from 'ethers';
import { mldsa } from '@qorechain/pqc';
import { compile } from '../scripts/compile.js';

const fixture = compile('test/DianaFixture.sol', 'DianaFixture');
const contract = compile('contracts/JaydaadEstate.sol', 'JaydaadEstate');
export const deposit = parseEther('1');

export async function sandbox({ interval = 3600, grace = 1800 } = {}) {
  if (!Number.isInteger(interval) || !Number.isInteger(grace) || interval < 60 || grace < 60 || interval > 31536000 || grace > 31536000) throw Error('Windows must be between one minute and one year.');
  const rpc = hre.network.provider;
  await rpc.send('hardhat_reset');
  const provider = new BrowserProvider(rpc, undefined, { cacheTimeout: -1 });
  const [owner, heir, witness] = await Promise.all([0, 1, 2].map(i => provider.getSigner(i)));
  const actors = [owner, heir, witness];
  const keys = actors.map(() => mldsa.keygen());
  async function install(address) {
    await rpc.send('hardhat_setCode', [address, '0x' + fixture.evm.deployedBytecode.object]);
    return new Contract(address, fixture.abi, owner);
  }
  const directory = await install('0x0000000000000000000000000000000000000A02');
  const verifier = await install('0x0000000000000000000000000000000000000A01');
  for (const [i, actor] of actors.entries()) {
    await (await directory.enroll(actor.address, keys[i].publicKey)).wait();
  }
  const factory = new ContractFactory(contract.abi, contract.evm.bytecode.object, owner);
  const estate = await factory.deploy(heir.address, witness.address, interval, grace);
  await estate.waitForDeployment();
  async function proof(i, action, expiry) {
    const message = getBytes(await estate.message(action, actors[i].address, expiry));
    const { publicKey, secretKey } = keys[i];
    const signature = mldsa.sign(secretKey, message);
    if (!mldsa.verify(publicKey, message, signature)) throw new Error('Local ML-DSA verification failed');
    await (await verifier.record(publicKey, signature, message)).wait();
    return { key: publicKey, signature };
  }
  async function approvals(action) {
    const expiry = (await provider.getBlock('latest')).timestamp + 300;
    return [action, expiry, await proof(action === 2 ? 1 : 0, action, expiry), await proof(2, action, expiry)];
  }
  async function execute(action) {
    const caller = action === 2 ? heir : owner;
    return (await estate.connect(caller).execute(...await approvals(action))).wait();
  }
  async function advanceTo(timestamp) {
    await rpc.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
    await rpc.send('evm_mine');
  }
  return { estate, owner, heir, witness, provider, execute, approvals, advanceTo, directory, verifier, keys };
}
