import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { compile } from './compile.js';

export async function buildProject() {
  const contract = compile('contracts/JaydaadEstate.sol', 'JaydaadEstate');
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/JaydaadEstate.json', JSON.stringify({
    contractName: 'JaydaadEstate', chainId: 9800, compiler: '0.8.30',
    abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object
  }, null, 2));
  await build({ entryPoints: ['web/app.js'], bundle: true, format: 'esm',
    platform: 'browser', target: ['es2022'], outfile: 'dist/app.js', minify: true,
    sourcemap: true, define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' } });
  console.log('Built Jaydaad contract and browser application.');
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/build.js')) await buildProject();
