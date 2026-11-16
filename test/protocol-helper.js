// Run in a plain Node subprocess: Playwright's TS transform currently conflicts
// with a CosmJS dependency's source-map loader when the SDK is imported in specs.
import { qorechainRegistry, hexToBech32 } from '@qorechain/sdk';
const [operation, json] = process.argv.slice(2);
const value = JSON.parse(json);
const result = operation === 'address' ? hexToBech32(value, 'qor') : qorechainRegistry().decode({ typeUrl: value.typeUrl, value: Uint8Array.from(value.value) });
console.log(JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v));
