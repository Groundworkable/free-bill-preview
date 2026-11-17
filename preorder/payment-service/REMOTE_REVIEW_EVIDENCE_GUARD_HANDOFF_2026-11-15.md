# Next remote D1 review-evidence protections checkpoint — founder-only test plan

**Prepared November 15, 2026. NOT executed against remote Cloudflare D1.**

The founder verified **5/5 schema clauses** in the new review-evidence table and four triggers in **`groundwork-payment-sandbox-isolated`**, bringing the expected remote object inventory to 22. The next step is behavioral validation. No payment/provider/Worker changes are authorized by this preparation.

## Scope and permanence

- The only target is isolated Cloudflare D1 **`groundwork-payment-sandbox-isolated`**. Never execute these scripts against the live app, other databases or Supabase.
- The plan reuses the **prior synthetic order** `cs_test_D1ONLY_GUARD_20261115`; it creates at most **one new synthetic pending notification**, keyed `gwn1_` plus 64 `9` characters, and **one dummy evidence row**. The prior notification with 64 `e` characters remains `manual_review` and is untouched.
- Fake recipient HMAC is 64 zeroes; all other evidence fingerprints use repeated `a`/`b`/`c` hex characters — **not valid cryptographic approval signatures**. The plan **never attempts a successful `review_verified` transition** and never invokes an email sender or Stripe API.
- The new test-only records remain **permanent append-only records** in the isolated sandbox. No cleanup via DROP/DELETE/trigger manipulation is permitted.
- This test would require **separate explicit approval for the remote synthetic INSERT**. "Onward" authorized preparation and read-only verification, not additional permanent data writes or automatic activation.

## Execution sequence — after separate approval for persistent synthetic writes

| Step | Script | Expected result | Stop if |
|---|---|---|---|
| 01 | `remote_d1_review_guard_01_readonly_preflight_2026-11-15.sql` | Six `READY` rows | Any `STOP` |
| 02 | `remote_d1_review_guard_02_insert_pending_fixture_2026-11-15.sql` | No SQL error; synthetic notification added once | Any error |
| 03 | `remote_d1_review_guard_03_readonly_fixture_check_2026-11-15.sql` | Four `PASS` rows | Any `STOP` |
| 04 | `remote_d1_review_guard_04_reject_approval_without_evidence_2026-11-15.sql` | Constraint error `independent review evidence required before approval` | Unexpected success/error |
| 05 | `remote_d1_review_guard_05_reject_mismatched_evidence_2026-11-15.sql` | Constraint error `review evidence must bind to a pending notice` | Unexpected success/error |
| 06 | `remote_d1_review_guard_06_insert_synthetic_evidence_2026-11-15.sql` | No error; fake proof inserted, still pending | Any error |
| 07 | `remote_d1_review_guard_07_reject_evidence_update_2026-11-15.sql` | Constraint error `review evidence is append-only` | Unexpected success/error |
| 08 | `remote_d1_review_guard_08_reject_evidence_delete_2026-11-15.sql` | Constraint error `review evidence is append-only` | Unexpected success/error |
| 09 | `remote_d1_review_guard_09_reject_approval_timestamp_mismatch_2026-11-15.sql` | Constraint error `independent review evidence required before approval` | Unexpected success/error |
| 10 | `remote_d1_review_guard_10_readonly_postcheck_2026-11-15.sql` | Six `PASS` rows; no `review_verified`, no Stripe event or financial change | Any `FAIL` |

All scripts must run **separately** in the same isolated D1 Console, in order, with screenshots at each verification/error gate. Never paste and execute the sequence as a combined SQL batch. A negative-test SQL constraint is **expected success of the guard**, not of the UPDATE/DELETE.

## Current status

- Existing payment Worker remains fail-closed: `PAYMENTS_MODE=disabled`, `TERMS_APPROVED=false`, `TERMS_VERSION=UNAPPROVED`.
- Stripe test Payment Links/webhook disabled; Resend templates unpublished, draft founder notification Worker **not deployed**, public checkout off.
- CI offline test: `remote_d1_review_guard_synthetic.test.py`; do not run remote SQL until this passes on PR #17 at the final test-plan commit.
- No new Cloudflare Access routes or operational customer notices in this phase.
