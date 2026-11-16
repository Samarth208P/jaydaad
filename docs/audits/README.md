# QCAI audit evidence

The Post-Quantum dApp category lists a **two-stage QCAI audit** requirement.
This directory separates reproducible audit inputs from actual auditor results.
No QCAI report has been obtained for this checkout. There is no audit score.

1. Run `npm run audit:prepare -- --stage stage-1`.
2. Sign in to the [official Contract Auditor](https://dashboard.qorechain.io/audit),
   select the Diana testnet, and paste the exact generated `.sol` input. The
   official [auditor documentation](https://docs.qorechain.io/dashboard/contract-auditor)
   describes the sign-in, daily free audit, and test-QOR payment for extra audits.
3. Export the report PDF. Make the report public if you intend to submit its URL.
   Save the actual report URL, timestamp, input hash, findings, and remediation
   decisions under `reports/stage-1/`.
4. Fix applicable findings and run the tests. Prepare the final source with
   `npm run audit:prepare -- --stage stage-2`. Run the second official audit and
   preserve its PDF/URL under `reports/stage-2/`.
5. Link both actual reports in `docs/SUBMISSION.md`. Re-audit after contract
   changes. Do not relabel a report for an older source hash as a final audit.

An AI audit is a source-only review, not a formal security guarantee. The input
manifest's `input-prepared-not-audited` state must not be changed to a pass until
the official result actually exists. The category's detailed judging rubric and
any organiser changes remain authoritative.
