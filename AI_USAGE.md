# AI usage in Jaydaad

Jaydaad’s maintainer chose the inheritance-vault concept, directed development on QoreChain Diana, and selected Handles for participant lookup and QoreSeal for private handover notes. OpenAI Codex helped write and revise the software, tests, and documentation.

## Where Codex contributed

- **Vault contract.** Codex helped implement the signing-key checks for the participant and witness, the rules for check-ins and claims, and the handling of deposits received after a vault closes.
- **Application and tooling.** Codex worked on the dashboard, QoreX funding and receipt verification, and the command-line tools for deploying and operating a vault. It also implemented signed handle lookup and browser-side encryption of handover notes.
- **Tests and documentation.** Codex wrote and ran contract and browser tests, including checks for changed handle addresses and a round trip from browser encryption to offline decryption. It also drafted the setup guide and threat model.

The browser tests use a QoreX test double. Public Diana receipts document the deployed vault’s transactions, including a witnessed check-in and a beneficiary payout. The maintainer decides which changes to publish. [Deployment records](deployments/README.md) · [Threat model](docs/THREAT_MODEL.md)
