# AI usage disclosure

Jaydaad is being developed with OpenAI Codex at the project owner's direction.
The owner chose the inheritance-vault concept and requested adaptation to the
QoreChain Developer Fest, QoreX, and testnet QOR. Codex inspected the existing
prototype and official documentation, implemented the application and CLI,
modified the Solidity contract, and wrote automated tests and documentation.

## Work generated or edited with AI

- Dashboard, vault setup, beneficiary view, activity view, security rehearsal,
  responsive CSS, icons, and featured image source.
- QoreX native-provider connection, protobuf message construction, QOR unit
  conversion, scoped EVM windows, and receipt read-back.
- Local HTTP server, isolated Hardhat rehearsal, Diana query helpers, and
  deployment/action CLI.
- Contract changes to recheck registry keys on sensitive actions and route late
  deposits to the original payout recipient.
- Contract, message-encoding, and browser integration tests; submission and
  threat-model documentation.

## Human contribution and review

The owner supplies product decisions, account custody, real witness and
beneficiary selection, and the decision to publish or submit. Human security
review, legal review, and real-user wallet approval are not claimed by this file.
Review the code and actual evidence before making those claims in a submission.

## Verification boundaries

Automated checks compile Solidity 0.8.30, exercise an ephemeral Hardhat EVM,
verify real ML-DSA-87 signatures locally, and test browser behavior against a
clearly identified QoreX API test double. The read-only Diana probe separately
checks the real chain's PQ verification precompile.

The local fixture is not the public-chain verifier. Browser test-double results
are not evidence of a real extension approval or a live broadcast. No testnet
deployment, official Q-Day Drill result, formal security audit, prize, or jury
score is implied by AI-generated code or documentation.

QCAI reports should be added only after running the official auditor and
preserving its result. A locally generated audit input is not an audit report.
