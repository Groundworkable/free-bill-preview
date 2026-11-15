# Notification safeguards — local offline validation checkpoint

**Date:** November 15, 2026 (US Eastern). **Scope:** offline reconstruction and source review. **No remote database changes or real provider calls.**

## Work performed

The GitHub connector continued returning **no workflow runs or commit statuses** for the current head of Draft PR #17. Rather than claiming GitHub Actions passed, a local Node.js/Python/SQLite rehearsal was conducted with **manually reconstructed local copies** of the branch's staged notification logic and mocked provider responses.

| Local probe | Results |
| --- | --- |
| Draft notification ledger SQL recreated in SQLite (foreign keys enabled) | **10** unsafe duplicate/null/foreign-key/illegal-transition/mutation attempts rejected; approved state transitions and audit trail matched expected sequence |
| Stripe / Resend provider adapter logic recreated in Node.js (mock `fetch`) | **5/5** test groups passed; simulated authenticated test GETs, invalid provider data, unpublished template refusal, allowlisted recipient and Resend idempotency |
| Founder-only notification sender logic recreated in Node.js (synthetic Stripe purchase verifier + mocked adapters) | **6/6** test groups passed; disabled gates, publisher/approver checks, identity and amounts, one claim before send, ambiguous outcomes, no entitlement |
| Read-only notification preflight logic recreated in Python | **16** synthetic assertion groups passed; repeats, invalid revisions, refund evidence, recipient mismatches, invalid input, no authorization |

**Additional source inspection on the exact GitHub branch** confirmed all relevant files exist, the draft sender has no public handler, the DB claim appears before the transport call, the Resend adapter restricts destination and published templates, and `.github/workflows/public-site-qa.yml` includes the ledger, sender, and provider adapter test scripts.

## Evidence limitations

- These local runs used **reconstructed copies**, not byte-for-byte GitHub checkout. They are **preliminary code review evidence**, not an independent execution of the exact committed test files.
- The local sender rehearsal used a reconstructed `verifyPaidPurchase` helper rather than loading the entire GitHub `worker.mjs`. It does not establish that the full repository test matrix passes.
- There is **no verified successful CI run** for the latest PR head. The missing run is an outstanding verification gate; do not mark CI green based on this checkpoint.
- The DB rehearsal was **in-memory SQLite**, not the isolated Cloudflare D1 database; the draft notification ledger has **not** been migrated remotely.
- All Stripe and Resend calls in the local tests were mocked, so there was no actual authenticated test session, signed webhook delivery, Resend send, customer email, refund, or membership activation.

## Release gate

Keep Draft PR #17 unmerged and the checkout/notification sending gates disabled. Next validation should run the **exact committed** `notification_ledger.test.py`, `notification_sender.sandbox.test.mjs`, `notification_provider_adapters.sandbox.test.mjs`, `notification_preflight.test.py` and remaining CI matrix in the GitHub runner or authenticated checkout before deployment.

**Result:** Local safety-check rehearsal passed; **CI and end-to-end sandbox integration unverified**.

## Exact-source JavaScript review and branch CI route — November 15, 2026

The exact committed JavaScript sender/provider-adapter source and test bodies were fetched from GitHub and executed in a restricted JS harness. **5/5 provider adapter cases** and **6/6 sender cases** passed using mock HTTP responses, an assertion shim, and synthetic cryptography. This does **not** replace native Node.js or GitHub Actions execution; the source-level tests cover the intended disabled gates, Stripe/Resend API mock behavior, published-template requirement, atomic claim ordering, receipt handling and ambiguous send denial.

Added `.github/workflows/prepurchase-notification-ci.yml` as a **branch-scoped push/PR** no-secret workflow running the exact committed Python SQLite and Node mock tests. The workflow has no deploy, payment, email, remote database or provider action. It checks out the commit SHA and runs the existing test scripts. It was added on commit `4fdb02576d52510a62d4c722042d5be9b6c66a11`.

At the time of the check, the GitHub connector returned **zero CI workflow runs and zero commit status checks** for that head; a passing native CI execution **remains unverified**. The connected GitHub interface has no start-workflow dispatch action, and local GitHub cloning is unavailable due to hostname resolution in the execution environment. Do **not** infer an Actions run from the existence of the workflow file.
