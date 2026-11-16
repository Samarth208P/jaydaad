import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

// Cosmos identifies the signed transaction by the SHA-256 of its wire bytes.
// Reserve that hash before the first network write, including on SDK retries.
export async function broadcastOnce(transport, bytes, path) {
  const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  await writeFile(path, hash + '\n', { flag: 'wx', flush: true });
  return transport.broadcastTx(bytes);
}
