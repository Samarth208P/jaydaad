# Diana + QoreX runbook

Jaydaad uses only **qorechain-diana**, EVM chain ID **9800**, with valueless test
QOR. It has no mainnet configuration. Never paste a seed phrase or secret key
into the browser application.

## Run the application

This checkout is configured with a live primary vault at
`0xA3a1e281C4Cf7fD73b922a074f9e59e666503b10`. It holds 1 test QOR, is Active,
and uses a 30-day check-in interval plus 7-day grace. The app reads
`deployments/diana.json` and attaches it automatically when no other vault is
selected. A separate short-timer demo completed a real 0.25-QOR payout; its
receipt and fee-adjusted balance proof are under `deployments/`.

```sh
npm ci
npm start
```

Open <http://127.0.0.1:4173>. Install the official
[QoreX extension](https://chromewebstore.google.com/detail/qorex/cflpnggbnnifibblifgbeobogdpfjpcg),
select Diana inside QoreX, and choose **Connect QoreX**. The application checks
the native provider's `signAndBroadcast` capability; it never uses
`window.ethereum` or a generic wallet in QoreX's place. The native account and
its matching 0x form are displayed together. QoreX's separately derived EVM
account can differ from the native account.

Get free test QOR from the [official faucet](https://dashboard.qorechain.io/faucet).
It requires dashboard sign-in and has an account/address cooldown. Do not try
to bypass that limit. Native transactions use `uqor` (1 QOR = 1,000,000 uqor).
EVM balances and values have 18 decimals. The UI builds amounts with integer
arithmetic and accepts at most six input decimal places.

## Current QoreX boundary

As documented on 14 November 2026, QoreX can connect on EVM and can build, sign,
and broadcast hybrid **native** transactions. Its current store builds reject
EVM `eth_sendTransaction` and arbitrary PQ message signing. Therefore:

| Operation | Path available today |
| --- | --- |
| Wallet connection, balance, registry check | QoreX native provider + Diana reads |
| Funding an active deployed vault | QoreX native hybrid `MsgSend` |
| Open/close a scoped EVM window | QoreX native hybrid message, if displayed by the installed build |
| Solidity deployment | CLI, using an independently managed eth-native owner |
| Witnessed check-in, cancellation, claim | CLI, with participant and witness ML-DSA keys |
| EVM sends from future QoreX releases | Browser path is implemented; unsupported methods remain explicit errors |

The interface never requests a wallet's PQ secret, pretends that an unsupported
method succeeded, or labels a local Hardhat action a live testnet transaction.

## Prepare disposable CLI identities

The current local identities already exist and are registered. Do not run
`init` again for the existing deployment. The steps below explain fresh setup.
On Windows PowerShell, use `node scripts/diana-cli.js ...` if the `npm.ps1`
wrapper consumes command flags; this is the direct CLI path used for deployment.

```sh
npm run estate -- init
```

This writes `.local/diana.json` plus two independent secret files for each of
owner, heir, and witness. The classical keys and PQ entropy are generated
independently. None of the classical keys alone derives a PQ key. Only public
addresses are printed. `.local/` is ignored by Git. Windows users must apply
appropriate ACLs: POSIX file modes are not a substitute for Windows permissions.
For real role separation, hand custody of each role's files to the intended
participant on separate devices; the generated config is only a local testnet
harness, not an independent witness service.

The generated configuration has this shape; paths can be absolute or relative
to the configuration directory:

```json
{
  "network": "qorechain-diana",
  "interval": 3600,
  "grace": 1800,
  "accounts": {
    "owner": {"classicalKeyFile":"classical/owner.key","pqEntropyFile":"post-quantum/owner.entropy"},
    "heir": {"classicalKeyFile":"classical/heir.key","pqEntropyFile":"post-quantum/heir.entropy"},
    "witness": {"classicalKeyFile":"classical/witness.key","pqEntropyFile":"post-quantum/witness.entropy"}
  }
}
```

Classical files contain a 32-byte hex ECDSA private key (optional `0x` prefix).
PQ files contain a different 32-byte hex entropy value (no prefix). The official
SDK `unifiedAccountFromSeed(..., {pqcSecret})` derives the registered ML-DSA key
from independent entropy and the account address. Do not point these entries at
an existing QoreX wallet: its account derivation and registered PQ key may differ.
The CLI refuses a mismatched registered key rather than rotating it.

Use one legitimate faucet claim to fund the **owner's** public native address.
Then initialize the owner, send 2 test QOR from it to each other role, and enroll
their possession-proven PQ keys:

```sh
npm run estate -- bootstrap --register-keys
```

This uses ordinary hybrid bank transfers, not additional faucet claims or a
cooldown workaround. Alternatively, fund the three addresses with ordinary
native transfers from your already-funded QoreX wallet. Inspect public balances
and registry records:

```sh
npm run estate -- status
npm run diana:check
```

## Deploy and activate

After funding, explicitly request possession-proven enrollment for fresh keys:

```sh
npm run deploy:diana -- --config .local/diana.json --register-keys
```

The CLI checks the Diana chain, verifies/initializes all three registry keys,
opens an unscoped deployment window (100 blocks, one transaction, 5 QOR cap
including fees), deploys, and closes that window in `finally`. Enrollment and
native operations use a conservative fixed gas/fee budget; unused gas is not
promised to be refunded. Keep enough test QOR for registration and window fees.
The script refuses mainnet configuration or a mismatched registered PQ key.

Use the printed contract address as `0xYOUR_VAULT` below:

```sh
npm run estate -- --config .local/diana.json --vault 0xYOUR_VAULT --action checkin
```

The CLI opens a **vault-scoped** window, retrieves fresh block time and nonce,
builds participant and witness approvals, sends the EVM action, and closes the
window. Each action generates a public receipt file under `deployments/`.
Sensitive application messages use Jaydaad's own domain
`jaydaad-estate-diana-v1|` and the exact bytes returned by `message()`. This is
not QoreSign arbitrary-message format or a claim of current wallet support.

To export a short-lived public approval package instead of executing it:

```sh
npm run estate -- --config .local/diana.json --vault 0xYOUR_VAULT --action checkin --export-proof .local/checkin-proof.json
```

The current export command still opens/closes an EVM window. The package binds
the current nonce and expires in five minutes. It is not a secret key. A real
distributed witness service must review and independently approve the same
payload; this single-config CLI signs for all locally supplied roles.

## Fund using QoreX

1. In Jaydaad select **Attach a Diana vault**, enter the deployment address, and
   review the discovered roles, timers, balance, and PQ key health. The server
   compares runtime bytecode with this release, allowing for immutable slots.
2. Complete the first check-in by CLI; choose **Refresh vault**. It must be Active.
3. Connect QoreX with a funded Diana **native** account. It may be a different
   depositor from the owner; any account can fund an active plan.
4. Select **Add funds**, enter test QOR, and review the QoreX native prompt. The
   recipient is the contract's qor1 encoding. The message is
   `/cosmos.bank.v1beta1.MsgSend`, denomination `uqor`.
5. Approve in QoreX. Jaydaad reads the transaction back from Diana, records its
   actual hash, height, inclusion status, and hybrid-extension presence, and
   rereads the actual EVM vault balance. Pending inclusion is displayed as pending.

The explorer persists its network selection separately. Choose **Testnet / Diana**
in its header if an explorer link shows a transaction as missing; a URL query
parameter may not switch it. Jaydaad's built-in receipt verifier always uses
the Diana REST endpoint directly.

Native bank sends bypass `receive()` and `fund()`. They add to the actual QOR
balance without a Solidity `Funded` event. A state change between preflight and
inclusion is possible. Late deposits after closure can be recovered exclusively
to the original payout recipient; they can never be redirected by the recovery
caller. Do not treat a missed native deposit event as a missing balance.

## Rehearse recovery and payout on Diana

Use short test intervals when creating the config if recording a live demo.
Public time cannot be fast-forwarded. In grace, another check-in restarts the
clock. Before claimability, cancellation returns funds to the owner:

```sh
npm run estate -- --config .local/diana.json --vault 0xYOUR_VAULT --action cancel
```

After the real check-in interval and grace expire:

```sh
npm run estate -- --config .local/diana.json --vault 0xYOUR_VAULT --action claim
```

The heir receives the complete balance. The heuristic missed-check-in clock is
not proof that the owner died. A payout requires the independent witness.

Recover coins arriving after a settlement:

```sh
npm run estate -- --config .local/diana.json --vault 0xYOUR_VAULT --action recover
```

The command uses the owner's configured account to pay gas; the contract's fixed
payout recipient receives the coins. Save the public receipt files, compare
before/after balances, and add actual explorer links to your submission.

## Evidence and things not yet verified

The repository contains public live deployment, hybrid-native funding,
possession-proven enrollment, scoped-window, check-in, and beneficiary-payout
receipts. Secret files remain under ignored `.local/`. The 0.25-QOR payout was
reconciled exactly against the heir's balance after native-window fees and EVM
gas. The app starts with the live primary vault configured.

The CLI used the three local disposable role keys; it did not verify independent
human liveness. A real QoreX extension approval is still separate evidence, as
are the official QCAI reports and any public deployment of the website. Tests
against the wallet API test double do not substitute for those results.

Official references: [QoreX integrations](https://docs.qorechain.io/developer-tools/qorex-integrations),
[EVM window reference](https://docs.qorechain.io/developer-guide/evm-window-reference),
[precompiles](https://docs.qorechain.io/developer-guide/evm-precompiles),
[faucet](https://docs.qorechain.io/dashboard/faucet).
