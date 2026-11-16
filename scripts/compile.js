import fs from 'node:fs';
import solc from 'solc';
import { pathToFileURL } from 'node:url';

export function compile(file, name) {
  const input = {
    language: 'Solidity',
    sources: { [file]: { content: fs.readFileSync(file, 'utf8') } },
    settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }
  };
  const result = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = result.errors?.filter(x => x.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(x => x.formattedMessage).join('\n'));
  return result.contracts[file][name];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const contract = compile('contracts/JaydaadEstate.sol', 'JaydaadEstate');
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/JaydaadEstate.json', JSON.stringify({
    abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object
  }, null, 2));
  console.log('Built artifacts/JaydaadEstate.json');
}
