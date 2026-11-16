import { envelopeToText, seal, verifyRecipientCard } from '@qorechain/qoreseal';
import { hexToBech32 } from '@qorechain/sdk';
import { getAddress, getBytes } from 'ethers';

export function notePurpose(estate) {
  return 'jaydaad.handover.v1/' + getAddress(estate).toLowerCase();
}

export function encryptHandover(vault, card, kemPublicKey, note) {
  const beneficiary = vault.keys.find(key => getAddress(key.address) === getAddress(vault.heir));
  if (!vault.verified || !beneficiary?.proven || !beneficiary.pinned) throw Error('The beneficiary signing key must match the key enrolled in this vault.');
  if (!note.trim() || note.length > 8000) throw Error('Enter a note of up to 8,000 characters.');
  const chainId = 'qorechain-diana';
  const recipient = verifyRecipientCard({
    card, chainId, address: hexToBech32(vault.heir, 'qor'),
    pqPublicKey: getBytes(beneficiary.publicKey), mlkemPublicKey: getBytes(kemPublicKey),
  });
  const encrypted = seal({ chainId, purpose: notePurpose(vault.estate), mode: 'hybrid',
    recipients: [recipient], plaintext: new TextEncoder().encode(note) });
  return { version: 1, chainId, vault: getAddress(vault.estate), envelope: envelopeToText(encrypted) };
}
