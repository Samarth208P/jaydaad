import { Wallet, getBytes, hexlify } from 'ethers';
import { mldsa } from '@qorechain/pqc';
import { bech32 } from 'bech32';
import { generateSealKeys, signRecipientCard } from '@qorechain/qoreseal';

export function recipientFixture() {
  const heir = Wallet.createRandom();
  const pqKey = mldsa.keygen();
  const keys = generateSealKeys();
  const address = bech32.encode('qor', bech32.toWords(getBytes(heir.address)));
  const card = signRecipientCard({ chainId: 'qorechain-diana', address,
    keys, pqKey, classicalKey: { type: 'eth_secp256k1', privateKey: getBytes(heir.privateKey),
      publicKey: getBytes(heir.signingKey.compressedPublicKey) } });
  const vault = { verified: true, estate: '0x2222222222222222222222222222222222222222',
    heir: heir.address, keys: [{ address: heir.address, publicKey: hexlify(pqKey.publicKey), pinned: true, proven: true }] };
  return { card, keys, vault, kem: hexlify(keys.mlkemPublicKey) };
}
