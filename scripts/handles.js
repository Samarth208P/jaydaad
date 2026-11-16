import { HandleClient, addressForNetwork, normalizeHandle, validateHandle } from '@qorechain/handles';
import { computeAddress, getAddress } from 'ethers';

// Public registry and Ed25519 trust anchor shipped in the QoreX Firefox 0.4.2 release.
const registry = new HandleClient({
  baseUrl: 'https://cadkdpvbuztgqexpwoxkikmxya0vtcvd.lambda-url.us-east-1.on.aws',
  registryPubkeyHex: '91098dc532956f330a92be5b2d8e6e82db7af896fa9f453c3387f8e28ca28bc3',
  fetchImpl: url => fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' }),
});

export async function resolveRoleHandle(input, client = registry) {
  const handle = normalizeHandle(input);
  validateHandle(handle);
  const { record } = await client.resolve(handle);
  if (record.handle !== handle) throw Error('The registry returned a different handle.');
  const address = addressForNetwork(record, 'eip155:9800');
  if (!address) throw Error('This handle has no linked Diana EVM address. Ask the participant for their EVM address.');
  const ownerKey = '0x' + record.ownerPubkeyHex.replace(/^0x/i, '');
  if (getAddress(address) !== computeAddress(ownerKey)) throw Error('The linked EVM address does not match the signed owner key. Confirm the EVM address directly with the participant.');
  return { handle, address: getAddress(address) };
}
