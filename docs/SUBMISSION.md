# Build Before Q-Day submission packet

## Project

**Jaydaad — a little care for what comes next.**

Category: **Post-Quantum dApp** (confirm the current category details at submission).
Proposed short description:

> A witnessed inheritance vault for native QOR on QoreChain Diana. Owners check
> in, receive a grace period if they miss a deadline, and leave a single
> beneficiary a one-time claim. Sensitive actions require separate ML-DSA-87
> participant and witness approvals. QoreX funds the vault with hybrid native
> transfers; a transparent rehearsal shows how the boundaries work.

The differentiator is the actual application-level PQ signature gate plus an
independent witness, not simply an EVM wallet connection or a quantum label.
The limitations are part of the demo: missed check-ins are not proof of death,
and witness/key recovery remains future work.

## Current requirements and evidence

Checked against [the fest site](https://build.qorechain.io/) and
[official rules](https://build.qorechain.io/rules) on 14 November 2026.
Rules, dates, and prizes may change. The currently published deadline is
**2 December 2026 at 23:59 UTC / 3 December 2026 at 05:29 IST**.

| Requirement | Checkout status | Required submission evidence |
| --- | --- | --- |
| Original work during the event | Existing prototype expanded; inspiration and libraries credited | Public commit history and honest attribution |
| Public GitHub repository | Not created/published by this change | Actual repository URL |
| MIT or Apache-2.0 license | MIT `LICENSE` included | License file in public repository |
| README | Included with run/test/network instructions | Root README |
| Featured image | `docs/cover.svg` plus PNG export | Upload the image to the project page |
| Video at most 3 minutes | Timed script provided; recording pending | Actual hosted video URL |
| Used QoreChain testnet address(es) | Two real contracts deployed; participants funded and PQ-enrolled | `deployments/diana.json` and `diana-accounts.json` |
| QoreX connection and test QOR | QoreX path implemented; actual native funding executed with CLI hybrid signing | Native funding receipt present; real extension approval still needed |
| Scoped EVM window | Real scoped open/call/close operations confirmed | Native receipts and exact message fields in `deployments/diana.json` |
| `pqcVerify` | Real witnessed check-ins and 0.25-QOR beneficiary payout succeeded | Actual EVM receipts, native wrapper hashes, and payout accounting |
| Two-stage QCAI audit | Input preparation + process included; reports pending | Both official reports and input hashes |
| Hardhat or Foundry tests | Solidity tested on ephemeral Hardhat; tests included | Command output/CI run for final source |
| AI-native award disclosure | `AI_USAGE.md` included | Accurate workflow and human contribution disclosure |

Do not submit fabricated hashes, placeholder addresses, local fixture addresses,
mock-wallet results, AI audit scores, or claims of a prize. A passing local suite
does not complete the public-testnet requirements.

## Addresses and real receipts

- Owner, beneficiary, and witness addresses: funded and possession-proven,
  recorded in `deployments/diana-accounts.json`.
- Primary Diana vault: `0xA3a1e281C4Cf7fD73b922a074f9e59e666503b10`, Active with
  1 test QOR; 30-day check-in, 7-day grace.
- Short-timer payout demo: `0x91E8E55A52113D2Fdc2c3f13d3fC5A735632D4A4`, Closed;
  0.25 test QOR released to the designated heir after real time elapsed.
- Key registration, scoped window, deployment, check-in, native funding, and
  claim receipts: 22 independently re-read receipts in `deployments/diana.json`.
- First witnessed check-in EVM hash:
  `0x9194da507c3115d52fd4b706189e14e5d294feeaa6bf22728129c7430c8d620f`.
- Primary native funding hash:
  `DA53530553D2BF1ED9DDB2CE4A00C1E58A8B93E7F36FF765E726D6C858C64426`.
- Successful beneficiary claim EVM hash:
  `0xd81e0c8a7f2be059cef84cefdcf006240828be05d60ccaf9fc048aff420897e7`.
- Claim accounting: `deployments/payout-accounting.json`, status `verified`.
- Real QoreX extension funding approval: pending; the existing native funding
  receipt was generated with the CLI and must be labelled accurately.
- QCAI stage 1 report URL and SHA-256 input: pending.
- QCAI stage 2 report URL and SHA-256 input: pending.
- Public repo URL: pending.
- Video URL: pending.

## Three-minute demo plan (target 2:45)

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Dashboard and verified Diana contract address | People need an inheritance plan that protects assets without treating one missed check-in as an immediate handover. |
| 0:20–0:45 | Roles, pinned keys, and configured timers | Three distinct roles; participant plus independent witness approvals; one beneficiary; explicit grace period. |
| 0:45–1:10 | Real QoreX native funding prompt, actual receipt and balance | This is testnet QOR, sent with QoreX’s hybrid native signing. Show the real message, denomination, recipient, and hash. |
| 1:10–1:35 | Scoped-window evidence and witnessed action receipt | The network window bounds EVM activity; the vault independently verifies both PQ signatures. Current QoreX EVM limitations are handled through the disclosed CLI path. |
| 1:35–2:05 | Explicitly labelled local rehearsal | Fast-forward grace, recover, then let the beneficiary claim. Explain that public time is never fast-forwarded. |
| 2:05–2:25 | Four blocked local attack calls | Missing PQ proof, forged witness, early claim, and replay fail. This is local test evidence, separate from the official drill. |
| 2:25–2:45 | Actual audits, public repo, and limits | Show the real audit reports if obtained. Acknowledge trusted witness, public metadata, and key recovery still to build. |

## Official Q-Day Drill

The published rules currently describe a drill on **18 November 2026 UTC** with
registration before **17 November 2026 23:59 UTC**. Participation requires a fresh
testnet account with a registered ML-DSA-87 key, disclosure of that account's
classical private key to the organiser, up to five contract addresses, and a
normal transaction proof during the drill. Do not expose your QoreX seed phrase,
PQ entropy, any mainnet key, or other roles' secrets. This checkout does not
register or submit secrets for the drill. It is a distinct user action involving
secret-key disclosure and must be deliberately chosen by the participant.

## Final registration and publishing

Each team member completes their own GitHub, X, and QoreX connections on the fest
site. Confirm age, team size, represented country, originality, and category.
Publish only intended source, public evidence, and documentation. `.local/`,
`node_modules/`, test traces, and private account files must stay out of the repo.
The app's local rehearsal server is not a public-hosting configuration.
