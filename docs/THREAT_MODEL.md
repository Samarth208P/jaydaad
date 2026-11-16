# Jaydaad threat model

## Assets and actors

One immutable estate holds native Diana testnet QOR. The owner opts in; one
beneficiary receives the entire balance after the clock and grace expire; one
independent witness co-signs sensitive actions. The three addresses are distinct.
There is no administrator, upgrade key, keeper, or beneficiary-edit function.

## Authorization boundaries

The constructor accepts only chain ID 9800 and possession-proven ML-DSA-87 keys
from the QoreChain registry at `0x0A02`. The pinned hashes must match the current
registry records at execution time. An owner's or beneficiary's EVM transaction
alone is insufficient: its application-specific ML-DSA approval and a separate
witness approval must verify through `0x0A01`.

Messages bind chain ID, contract address, all three roles, both timers, action,
signer, nonce, and approval expiry. Participant and witness sign different
messages. Expiry is at most ten minutes from block time. Successful execution
increments the nonce before making a payout. Closed status and the recipient
are set before the external call; a reverted payout reverts those changes.

QoreChain additionally requires a registered PQ key and live EVM window for the
transaction sender. The application opens vault-scoped windows of 100 blocks,
three transactions, and a cap of 1 QOR including fees. The CLI deploys through an
unscoped window limited to one transaction, 100 blocks, and 5 QOR, and closes it
in a finally block. Subsequent CLI actions use one-target, one-transaction windows.

## Native QoreX funding

QoreX's supported native `signAndBroadcast` receives a protobuf `MsgSend` using
`uqor`. Native address and EVM contract address encode the same 20 bytes. Native
bank sends do not invoke Solidity `fund()` or `receive()` and emit no Solidity
`Funded` event. The contract uses its actual balance for payouts. The UI verifies
the vault runtime and Active phase before prompting and reads a committed Diana
receipt after broadcasting. Phase can change between preflight and inclusion;
this is not an atomic phase check for a native transfer.

A native bank send or forced EVM transfer can arrive after settlement. Anyone
can invoke `recoverLateDeposit()`, but it sends exclusively to the already-fixed
`payoutRecipient`, never to the caller. Incoming native sends cannot be rejected
by Solidity. This behavior must remain explicit in the UI and documentation.

## Attacks covered by tests

Missing PQ signature with a correct classical caller; wrong or forged witness;
wrong caller; early beneficiary claim; signature replay; expired approvals;
key replacement in the registry; check-in recovery during grace; owner refusal
after claim opens; one-time payout; native deposits after closure; direct EVM
funding restrictions; six-decimal amount conversion; single-target scoped-window
encoding; mainnet selection refusal; wallet rejection with no false success.

The browser attack lab uses an isolated Hardhat snapshot. It is not the official
Q-Day Drill and does not attack the public network.

## Trust assumptions and unresolved risks

- The witness is honest and available and performs a real identity/liveness
  check. The prototype simulates this check. It does not verify death, a legal
  document, biometric identity, or AI impersonation.
- An attacker with both the participant PQ key and witness cooperation/key can
  authorize a sensitive action during the applicable phase. Quantum resistance
  is not protection against loss of both signing secrets.
- Key pinning prevents substitution but has no re-enrollment flow. Rotation,
  revocation, or loss of any required key can lock a vault indefinitely. Long
  term use needs delayed re-enrollment, witness succession, notification, and
  a reviewed recovery protocol.
- The chain's registry, precompiles, hybrid validation, clocks, and RPC are
  trusted. An RPC can misreport state or censor the interface. Final receipts
  should also be checked through an independent node/explorer.
- Vault existence, roles, funding, and deadlines are public. This is not private
  inheritance, an encrypted document store, or an integration with QoreSeal.
- The local rehearsal server holds all three disposable identities. It binds to
  loopback, checks Host and Origin, and must not be exposed as a public service.
  It never accepts testnet secret keys. The CLI config is a single-operator
  testnet harness; independent human custody is a separate operational design.
- QoreX discovery names can be spoofed by another extension. Install from the
  official store; inspect the actual recipient, amount, and network in its prompt.
- The deployed-runtime comparison masks Solidity immutable byte ranges and
  compares all remaining bytecode. It establishes release identity, not a
  security certification. The queried roles and timers still require review.
- Current QoreX store builds cannot send EVM transactions or sign arbitrary PQ
  application messages. The CLI holds independently supplied role secrets for
  those steps. The app reports that boundary instead of inventing support.
- No formal audit, financial suitability, legal enforceability, or guarantee of
  indefinite cryptographic security is claimed. No real assets belong here.

## Before any real-asset release

Independent contract and operational security reviews; recovery and key rotation;
real liveness integration; notification delivery; multiple-beneficiary design;
private instructions; griefing and rejecting-recipient tests; browser-extension
interoperability validation; reproducible public testnet receipts; and both QCAI
stages with resolved findings.
