# Public Diana evidence

`diana-capability.json` records a **read-only** check against the live Diana RPC:
chain ID, registry access, acceptance of a real ML-DSA-87 signature, and rejection
of an altered message. It is not a deployment, funding transaction, or wallet
approval receipt.

`diana-accounts.json` lists funded, registered disposable public addresses and
their possession-proven ML-DSA-87 key hashes. Secret files are ignored under
`.local/`, outside this directory.

`diana-<timestamp>.json` files contain the CLI's actual public operation receipts.
`diana.json` records receipts checked against Diana, maps EVM hashes to their
native wrapper hashes, and configures the app's primary vault. It also records
the closed short-timer payout demo. `payout-accounting.json` reconciles the
0.25-QOR payout exactly, including native and EVM fees. `diana-security.json`
records four real read-only rejection simulations against the vault named in that file.
Never place secret keys, mnemonics, or PQ entropy in this directory.

The current public explorer chooses its network through a persistent network
selector. A query parameter in a link may not change that selection. Select
**Testnet / Diana** in the explorer before inspecting receipts. The application's
own receipt verifier queries `api-testnet.qore.host` directly and never depends
on the explorer's selected network.
