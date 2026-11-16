import { readFile, writeFile } from 'node:fs/promises';
import { envelopeFromText, open, sealKeysFromSeed } from '@qorechain/qoreseal';
import { getBytes } from 'ethers';
import { notePurpose } from '../web/handover.js';

const [packetFile, seedFile, outputFile] = process.argv.slice(2);
if (!packetFile || !seedFile || !outputFile) throw Error('Usage: npm run note:open -- ENVELOPE.json QORESEAL_SEED_FILE OUTPUT.txt');
const packet = JSON.parse(await readFile(packetFile, 'utf8'));
if (packet.version !== 1 || packet.chainId !== 'qorechain-diana') throw Error('Unsupported handover file or network.');
const seed = (await readFile(seedFile, 'utf8')).trim().replace(/^0x/i, '');
if (!/^[a-f0-9]{64}$/i.test(seed)) throw Error('Expected a 32-byte QoreSeal encryption seed in hexadecimal.');
const plaintext = open({ chainId: packet.chainId, purpose: notePurpose(packet.vault),
  keys: sealKeysFromSeed(getBytes('0x' + seed)), envelope: envelopeFromText(packet.envelope) });
await writeFile(outputFile, plaintext, { flag: 'wx', mode: 0o600 });
console.log('Handover note decrypted to the requested file.');
