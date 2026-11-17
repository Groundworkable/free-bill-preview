# Groundwork pre-purchase refund deadlines — offline planning only

Founder-approved policy sources: `preorder/REFUND_DELAY_POLICY_FOR_APPROVAL.md` and `preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md`. These are **not published legal terms**.

- Eligible, verified ordinary refund requests: planning target to **initiate through Stripe within five business days after both request receipt and buyer/order verification**. This is **not** a promise of settlement or bank receipt.
- A pending verification request remains urgent and carries its original receipt date; the code never uses delay as permission to ignore a customer.
- January 1, 2027 remains the application target. January 15, 2027 is the **unresolved-prepurchase customer-resolution cutoff**, not a postponed launch date. If service is undelivered and no authenticated affirmative agreement to a specifically dated later delivery exists at cutoff, **escalate cancellation and full-refund initiation**. No silence-is-consent.
- An agreed specific date missed later also escalates. Customer consent, verified access, refunds or cancellation are **caller assertions requiring independent corroboration**.
- Business-day calculation requires an **explicit operator-verified closure/holiday calendar**. An unknown holiday calendar never yields a supposedly definitive due date. A sample exclusion of 2027-01-18 in synthetic tests is a *test fixture*, not a determination that a holiday governs the actual customer's deadline.
- All results are advisory. The helper never issues a refund, schedules work, writes D1, sends messages, changes membership or determines statutory rights. Additional legal/regional requirements may override these planning dates.

Run offline: `python3 preorder/payment-service/refund_deadline_preflight.draft.test.py`.

**No Cloudflare, Stripe, Resend, checkout, policy publication or PR merge authorization.**
