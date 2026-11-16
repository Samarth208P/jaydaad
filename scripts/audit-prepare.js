import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { stage: { type: 'string', default: 'stage-1' } } });
if (!['stage-1', 'stage-2'].includes(values.stage)) throw Error('Stage must be stage-1 or stage-2.');
const source = await readFile('contracts/JaydaadEstate.sol', 'utf8');
const hash = createHash('sha256').update(source).digest('hex');
const directory = 'docs/audits/inputs';
await mkdir(directory, { recursive: true });
const name = `${directory}/${values.stage}-${hash.slice(0, 12)}`;
await writeFile(name + '.sol', source, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
await writeFile(name + '.json', JSON.stringify({ stage: values.stage, status: 'input-prepared-not-audited',
  preparedAt: new Date().toISOString(), sha256: hash, source: 'contracts/JaydaadEstate.sol', compiler: '0.8.30',
  evmVersion: 'paris', optimizerRuns: 200, officialAuditor: 'https://dashboard.qorechain.io/audit',
  reportUrl: null, findings: null,
  instructions: 'Paste the exact adjacent Solidity source into QCAI. Preserve the public report URL and PDF. Resolve findings before stage-2. A code change requires a new source hash and re-audit.' }, null, 2));
console.log(`Prepared ${values.stage} source ${hash}. No audit was performed. Upload ${name}.sol to the official auditor.`);
