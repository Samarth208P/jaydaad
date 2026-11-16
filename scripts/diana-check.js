import { Contract, FetchRequest, JsonRpcProvider, ZeroAddress, toUtf8Bytes } from 'ethers';
import { mldsa } from '@qorechain/pqc';
import { mkdir, writeFile } from 'node:fs/promises';

const request = new FetchRequest('https://evm-testnet.qore.host');
request.timeout = 12000;
const rpc = new JsonRpcProvider(request, { chainId: 9800, name: 'Diana' }, { staticNetwork: true });
try {
  if (BigInt(await rpc.send('eth_chainId', [])) !== 9800n) throw new Error('Unexpected network');
  const directory = new Contract('0x0000000000000000000000000000000000000A02',
    ['function pqcKeyStatus(address) view returns (bool,uint8,bytes,bool)'], rpc);
  await directory.pqcKeyStatus(ZeroAddress);
  const verifier = new Contract('0x0000000000000000000000000000000000000A01',
    ['function pqcVerify(bytes,bytes,bytes) view returns (bool)'], rpc);
  const { publicKey, secretKey } = mldsa.keygen();
  const message = toUtf8Bytes('jaydaad-estate-diana-v1|read-only capability check');
  const signature = mldsa.sign(secretKey, message);
  if (!await verifier.pqcVerify(publicKey, signature, message)) throw new Error('Valid signature rejected');
  if (await verifier.pqcVerify(publicKey, signature, toUtf8Bytes('changed'))) throw new Error('Changed message accepted');
  const block = await rpc.getBlock('latest');
  await mkdir('deployments', { recursive: true });
  await writeFile('deployments/diana-capability.json', JSON.stringify({
    kind: 'read-only-capability-probe', recordedAt: new Date().toISOString(), network: 'qorechain-diana',
    chainId: 9800, rpc: 'https://evm-testnet.qore.host', block: block.number,
    registryResponds: true, validSignatureAccepted: true, alteredMessageRejected: true,
    transactionBroadcast: false, estateDeployment: null,
    note: 'This proves a live precompile capability check, not a deployed estate or a QoreX transaction.'
  }, null, 2));
  console.log('Live Diana registry responds. ML-DSA-87 signature accepted and changed message rejected.');
  console.log('Public read-only evidence saved to deployments/diana-capability.json');
} finally {
  rpc.destroy();
}
