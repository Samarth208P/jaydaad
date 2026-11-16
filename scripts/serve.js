import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fetchMlkemPublicKey } from '@qorechain/qoreseal/network';
import { resolveRoleHandle } from './handles.js';
import { formatEther, parseEther, isAddress } from 'ethers';
import { buildProject } from './build.js';
import { networkHealth, readVault, readJson, readReceipt, keyStatus, provider } from './network.js';

await buildProject();
const artifact = JSON.parse(await readFile('artifacts/JaydaadEstate.json', 'utf8'));
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const origin = `http://${host}:${port}`;
const files = new Map([['/', ['web/index.html', 'text/html']], ['/app.js', ['dist/app.js', 'text/javascript']],
  ['/style.css', ['web/style.css', 'text/css']], ['/favicon.svg', ['web/favicon.svg', 'image/svg+xml']],
  ['/cover.png', ['docs/cover-jaydaad-ui.png', 'image/png']],
  ['/qorex-icon.png', ['web/qorex-icon.png', 'image/png']],
  ['/fonts/manrope.woff2', ['node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', 'font/woff2']]]);
const server = http.createServer(async (req, res) => {
  const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://evm-testnet.qore.host https://api-testnet.qore.host; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  if (req.headers.host !== `${host}:${port}`) return json(403, { error: 'Local access only.' });
  try {
    const url = new URL(req.url, origin);
    if (req.method === 'GET') {
      if (files.has(url.pathname)) {
        const [file, type] = files.get(url.pathname);
        res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(await readFile(file));
      }
      if (url.pathname === '/api/network') return json(200, await networkHealth());
      if (url.pathname.startsWith('/api/handles/')) {
        return json(200, await resolveRoleHandle(url.pathname.slice('/api/handles/'.length)));
      }
      if (url.pathname.startsWith('/api/encryption-key/')) {
        const address = url.pathname.slice('/api/encryption-key/'.length);
        if (!/^qor1[a-z0-9]{38}$/.test(address)) throw Error('Enter a Diana account address.');
        const key = await fetchMlkemPublicKey({ rest: 'https://api-testnet.qore.host', address,
          fetch: url => fetch(url, { signal: AbortSignal.timeout(8000) }) });
        return json(200, { publicKey: '0x' + Buffer.from(key).toString('hex') });
      }
      if (url.pathname === '/api/artifact') return json(200, artifact);
      if (url.pathname === '/api/deployment') {
        try {
          const saved = JSON.parse(await readFile('deployments/diana.json', 'utf8'));
          if (saved.chainId !== 9800 || saved.network !== 'qorechain-diana' || !isAddress(saved.deployment?.address)) throw Error('Invalid public Diana deployment manifest.');
          return json(200, { deployment: saved.deployment, events: saved.events || [], demo: saved.demo || null });
        } catch (e) { if (e.code === 'ENOENT') return json(200, null); throw e; }
      }
      if (url.pathname.startsWith('/api/vault/')) return json(200, await readVault(url.pathname.split('/').at(-1), artifact.abi));
      if (url.pathname.startsWith('/api/key/')) {
        const address = url.pathname.split('/').at(-1);
        if (!isAddress(address)) throw Error('Enter a valid EVM address.');
        return json(200, await keyStatus(address));
      }
      if (url.pathname.startsWith('/api/account/')) {
        const address = url.pathname.split('/').at(-1);
        if (!/^qor1[a-z0-9]{38}$/.test(address)) throw Error('Invalid QoreChain account address.');
        const [balances, window] = await Promise.all([readJson(`/cosmos/bank/v1beta1/balances/${address}`), readJson(`/qorechain/pqc/v1/evm_window/${address}`)]);
        return json(200, { balances: balances.balances, window });
      }
      if (url.pathname.startsWith('/api/receipt/')) {
        const hash = url.pathname.split('/').at(-1).replace(/^0x/i, '');
        if (!/^[a-f0-9]{64}$/i.test(hash)) throw Error('Invalid transaction hash.');
        return json(200, await readReceipt(hash));
      }
      return json(404, { error: 'Page not found.' });
    }
    return json(405, { error: 'Read-only Diana gateway.' });
  } catch (error) { json(400, { error: error.shortMessage ?? error.message }); }
});
server.listen(port, host, () => console.log(`Jaydaad is ready at ${origin} · QoreX / Diana testnet`));
process.on('SIGTERM', () => { provider.destroy(); server.close(); });
