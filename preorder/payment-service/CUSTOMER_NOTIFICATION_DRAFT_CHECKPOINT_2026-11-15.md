# Groundwork customer purchase notifications — draft-only checkpoint

**Prepared November 15, 2026 (US Eastern). No messages sent, no template published, no payment processing enabled.**

## Resend connected account — read-only readiness check

- Resend sending domain: `groundworkbyable.com` — **verified**; sending **enabled**. Receiving through Resend **disabled**; the founder has separately tested shared-inbox inbound alias routing for `billing@` and `business@`.
- Resend contained **zero templates** before this work. The three templates below were created as **drafts** only; no publish action and no send action was taken.
- Default From: `Groundwork by Able <billing@groundworkbyable.com>`; Reply-To: `billing@groundworkbyable.com`.
- The sending domain's verification is not evidence that a buyer can receive a message or that replies/cases are properly handled. A controlled outbound test must be authorized and independently checked later.

## Draft template inventory (Resend)

| Purpose | Resend template ID | Status |
| --- | --- | --- |
| One-time purchase confirmation | `9e7fdf05-a547-4b9d-82f6-3251574ef27f` | Draft, unpublished |
| Pre-purchase delivery status/update | `b76db4ed-07d4-4b1a-9231-abb426379ec5` | Draft, unpublished |
| Refund initiated (not refund completed) | `d1976df7-1215-4e74-807c-093d5fe9b9b2` | Draft, unpublished |

Drafts are editable under `https://resend.com/templates`; their IDs above are exact, not invented.

### Template data contracts

**Purchase confirmation:** `ORDER_REFERENCE`, `OFFER_NAME`, `SUBTOTAL`, `TAX`, `TOTAL_PAID`, `ACCESS_SCHEDULE`.

**Delivery status:** `ORDER_REFERENCE`, `UPDATE_DATE`, `DELIVERY_STATUS`, `NEXT_STEP`.

**Refund initiated:** `ORDER_REFERENCE`, `REFUND_REFERENCE`, `REFUND_AMOUNT`, `INITIATED_DATE`.

The prepared content says a payment receipt **does not grant paid app access**; a purchase **does not authorize auto-renewal**; pre-activation refunds and post-activation voluntary seven-day full refund eligibility remain distinct; January 15, 2027 unresolved-order deadline is a **resolution cutoff**, not an app launch promise; initiated refunds do **not** imply bank settlement.

## Required gates before **any** delivery to a customer

1. Founder/legal review of transactional wording and exact link to the published approved customer terms and refund policy. Do not publish these drafts as binding contractual communications until approved.
2. Do not infer `to:` address from isolated D1: it stores **no purchaser email**. Obtain it from an independently authenticated Stripe provider record or separately verified customer contact process. Compare IDs, amounts, consent and terms version with immutable D1 order. The offline `purchase_contact_check.py` helps flag inconsistencies but is **not identity authentication** and does **not authorize messaging**.
3. Verify no conflicting contact emails, ensure address belongs to purchase and delivery method is permitted; prevent leaks, duplicate sends, unauthorized entitlement or unsolicited marketing.
4. Confirm amount, tax, original purchase schedule and actual app-access readiness from reliable records. No invented date; delayed/partial activation calendar requires separate implementation verification.
5. Refund notice requires **independent provider confirmation** that refund has actually been initiated, refund ID, amount and initiation date. Never send it for a merely requested, queued or disputed refund.
6. Design approved notification triggers, retry/deduplication, suppression on cancellation, bounce/complaint handling, delivery logs, minimum-retention recordkeeping, and manual support escalation. All are **not implemented** by draft templates.
7. Conduct controlled tests using sandbox provider events and founder-controlled inbox with explicit authorization; confirm delivery and matching identifiers/amounts without exposing card data.

**Safety:** Resend templates are still drafts; no payment URLs, Stripe Payment Links, webhooks, Cloudflare Worker flags, public pages, Groundwork app entitlements, or subscription billing settings were changed.


## Founder-authorized controlled outbound transport test — 2026-11-15 09:14 UTC

Authorized by founder for recipient `ablejr30@gmail.com`; sender `Groundwork by Able <billing@groundworkbyable.com>`. The following individually sent **simulated** notifications were verified as **delivered by Resend** using read-only provider retrieval of each email ID:

| Test purpose | Subject | Resend email ID | Provider status |
| --- | --- | --- | --- |
| Purchase confirmation | `[GROUNDWORK TEST 1/3] Purchase confirmation — NO CHARGE` | `01a1de7c-664c-7a96-9e4c-f8a9589c1ee1` | delivered |
| Delivery status | `[GROUNDWORK TEST 2/3] Delivery update — NO ACTUAL ORDER` | `01a1de7c-8afd-7510-acfc-c2c81801ed2c` | delivered |
| Refund initiated | `[GROUNDWORK TEST 3/3] Refund initiated notice — NO REFUND` | `01a1de7c-91f6-7ed3-ab2c-071c279b2327` | delivered |

Test payloads used fabricated `GW-TEST-NO-ORDER-001` purchase reference, no real Stripe objects or monetary transactions, explicit simulation labeling, and per-email idempotency keys. Only the purchase-confirmation probe included HTML; all had plain-text content. These were standalone **test sends**, not a publish or rendering of the three Resend draft templates. **The draft templates remain unpublished.**

**Verified:** Provider transport accepted and marked all three messages delivered to the chosen destination address. **Not verified:** physical inbox placement or rendering, replies, automated sends tied to signed Stripe events, customer-email authentication, suppression/retry/duplicate handling within a production notification pipeline, real refund initiation, or app fulfillment.

The isolated Worker and Stripe checkout remain disabled. No public deployment or production app changes.


## Founder Gmail screenshot confirmation — November 15, 2026

The founder supplied Gmail screenshots of all three controlled emails at the `ablejr30@gmail.com` recipient address, showing `Groundwork by Able <billing@groundworkbyable.com>` as sender and the simulated content readable in Gmail. The `[GROUNDWORK TEST 2/3]` and `[GROUNDWORK TEST 3/3]` screenshots visibly show Gmail's **Inbox** label. The purchase confirmation is also visibly opened in Gmail and the green/gold branded HTML renders with the test warning, mock order reference, monetary amounts and footer intact. These screenshots supplement, rather than replace, Resend's provider-delivered status.

**Rendering distinction:** Tests 2/3 (delivery status) and 3/3 (refund initiated) were intentionally sent as **plain text** and consequently look unbranded in Gmail. This is not a failure of the separately saved Resend draft templates, which have branded HTML versions. The controlled sends did **not** use or publish those templates. Their actual dynamic HTML rendering and placeholder substitution, automated Stripe-to-recipient correlation, duplicate prevention and real event-triggered delivery remain unverified.

All three tests are *simulations*. No actual transaction or refund occurred. No further test messages should be sent without another user direction or authorization.


## Georgia wordmark + full HTML preview — November 15, 2026 09:32 UTC

The founder requested use of the **Georgia serif typeface** for the Groundwork wordmark. The three existing Resend draft templates were updated **in place**: brand word `Groundwork` now uses `font-family:Georgia,'Times New Roman',serif` with email-safe fallback; `by Able` and the body remain readable sans serif, and the green/gold table-based email layout and business-copy variables were retained. The original three Resend template IDs and aliases remain unchanged, and each remains **unpublished**.

A second founder-authorized controlled test sent the actual saved HTML layouts (read from the Resend drafts) after replacing all variables with explicitly **fictional** example fields and adding a conspicuous simulation warning. No real Stripe purchase, tax, refund, activation, or customer data was used. Messages were sent to the founder-controlled `ablejr30@gmail.com` from `billing@groundworkbyable.com`. Provider retrieval verified **delivered** for all three:

| Preview | Resend email ID | Status |
| --- | --- | --- |
| Georgia purchase confirmation `[GROUNDWORK GEORGIA TEST 1/3]` | `01a1de8c-bfdd-7102-b68e-6af664240a3d` | delivered |
| Georgia delivery status `[GROUNDWORK GEORGIA TEST 2/3]` | `01a1de8c-cbd8-7080-afb4-419d1a4e9b4b` | delivered |
| Georgia refund initiated `[GROUNDWORK GEORGIA TEST 3/3]` | `01a1de8c-d2e2-7a2d-8c8d-5c9a79d71548` | delivered |

Verification confirmed all three outgoing HTML bodies include Georgia font styling and zero unresolved `{{{VARIABLE}}}` placeholders. **Gmail rendering of this newer Georgia set has not yet been confirmed by founder screenshots**. Resend drafts have **not** been published; the control used API sends with hydrated HTML to avoid activating production template publication. Payment links/webhook, isolated Worker disabled flags, and public website remain unchanged.


## Founder Gmail visual verification — Georgia branded HTML set (November 15, 2026)

The founder supplied seven Gmail screenshots showing the **second**, Georgia-style test set (subjects `[GROUNDWORK GEORGIA TEST 1/3]`, `2/3`, `3/3`) in the Gmail Inbox. All three messages display the intended dark-green header, **Georgia serif `Groundwork` wordmark**, smaller `by Able` label, readable sans-serif message title and body, conspicuous red/orange simulation warning, and billing contact. Screenshots show the purchase-confirmation body and footer, delivery-update body and footer, and refund-initiated body and footer; the Gmail list view shows all three messages. No obvious clipping, missing placeholder, or rendering error is visible at the supplied desktop Gmail viewport.

**Verification now complete:** Sending-domain SMTP delivery (Resend status), founder-confirmed Gmail inbox placement, desktop-Gmail HTML visual inspection of all three **manually hydrated** preview messages.

**Not yet verified:** Branded HTML on mobile/other mail clients, approval of final transactional copy, actual Resend template publish/send-variable rendering, event-driven delivery, recipient identity controls, duplicate sends, receipt/case management, actual Stripe payment/refund webhook and D1 reconciliation. Drafts remain **unpublished** and payment gates disabled. A screenshot is **not** express founder approval of live notifications or payments.


## Offline notification eligibility/deduplication preflight (PR #17 only)

`notification_preflight.py` and its synthetic tests have been added as an additional **read-only design checkpoint**. It requires a matching isolated `paid_unfulfilled` test order, coherent externally verified Stripe/recipient evidence (as asserted by the caller), and a distinct logical notice identity:

- `purchase_confirmation`: one logical confirmation per Checkout Session
- `delivery_update`: one notice per explicit approved revision/date token and Checkout Session
- `refund_initiated`: one notice per verified provider refund ID and Checkout Session, only when a test-mode refund has an eligible initiated/current status and a matching PaymentIntent

It computes stable SHA-256-derived **review keys**, includes no contact email in results, and checks the supplied collection of already-sent keys to identify duplicate logical notices. Each output categorically sets `authorization_to_send=false`, `authorization_to_refund=false`, `authorization_to_activate_membership=false`, `identity_proven=false`, and `delivery_verified=false`. Passing a caller assertion is **not proof** of authentic Stripe records or recipient ownership.

**Major remaining implementation gap:** the `previously_sent_keys` collection is in-memory caller input, **not an authoritative atomic send ledger**. A durable idempotent send log, race protection, retries after ambiguous provider timeouts, recipient verification and secure outbound orchestration must be designed and verified before any automated customer messages. No such service was deployed by this checkpoint; all Resend templates remain unpublished.



## Durable notification outbox design — draft-only, November 15, 2026

Files staged in PR #17: `notification_ledger.draft.sql` and `notification_ledger.test.py`. They are **not included in `schema.sql`**, not migrated to the remote isolated D1 database, and not connected to the deployed Worker, Stripe, Resend templates or existing Groundwork app.

The draft adds a unique notification key and logical `(checkout_session_id, notice_type, notice_ref)` constraint, a recipient **HMAC** fingerprint (not an unkeyed hash of email), constrained state transitions, a single attempt token, recorded provider acceptance and delivery, and a database-enforced append-only state audit journal. The transition test exercises duplicate collisions, immutable identities, forbidden transitions, missing evidence, foreign keys, a manual-review hold and deletion/alteration rejection. It explicitly protects the SQLite nullable primary-key corner case.

**Safety boundary:** This is a database *design* and synthetic test, not a functional or independently authenticated mail service. The database cannot independently prove Stripe authenticity, recipient ownership, a correct email address, approval of customer copy or provider delivery. A `review_verified` state does **not** establish those facts by itself.

A provider request can time out after sending. The draft deliberately treats `attempt_started` with uncertain outcome as **manual review**, never an automatic retry. A robust future sender must durably claim the row before network activity, use provider-side idempotency, reconcile ambiguous outcomes by provider reference, prevent multiple workers from sending, and establish authenticated recipient, security, delivery evidence, failure handling and authorized deletion/retention rules. It must never claim exactly-once delivery from this local schema alone.

**No notification ledger migration has been run, and no customer sending is authorized.**


## Isolated founder-only sender CORE — draft-only, November 15, 2026

Source: `notification_sender.sandbox.mjs` and `notification_sender.sandbox.test.mjs`. The sender is a **non-deployed JavaScript module** with no default `fetch` handler, public route, built-in Resend transport, scheduled job, durable recipient mapping, or ordinary user-accessible entry point. It was not attached to the app Worker and not deployed to the isolated payment Worker.

### Double fail-closed boundary

The sender refuses work unless all independent environment flags are explicitly configured, including `NOTIFICATION_SEND_MODE=sandbox_founder_test`, `NOTIFICATION_OPERATOR_RELEASE=true`, `NOTIFICATION_TEMPLATES_APPROVED=true`, test-only provider credentials and approved test recipient/HMAC secret, plus the approved payment terms/configuration. **None of these notification enablement flags or secrets was added to Cloudflare**. The current isolated Worker remains `PAYMENTS_MODE=disabled` and `TERMS_APPROVED=false`; the Resend notification templates remain draft/unpublished.

### Verification and attempt lifecycle

Before any send request, this draft requires trusted caller-supplied adapters to obtain an authenticated Stripe **test-mode** Checkout Session and line items; verify paid, one-time purchase, accepted terms, offer/amount/tax/links and immutable D1 order; compare customer email fields for conflicts, enforce the founder-controlled test recipient allowlist and an HMAC-only ledger fingerprint, and require separate operator approval plus published template status. A refund-initiated notice additionally requests test-mode refund evidence corroborated by the stored `refund.created` journal. Delivery updates require separately reviewed copy.

The sender then calls the draft D1 adapter's atomic `UPDATE ... WHERE state='review_verified'` before invoking transport with a stable Resend idempotency key. If the atomic claim fails, **no provider send request occurs**. If the provider outcome is ambiguous or accepted receipt cannot be written, it returns a manual-reconciliation status and does not retry sending. Resend delivery status, final identity assurance, and any real customer notification remain unsupported.

Tests use a synthetic Stripe Session, fake test-only IDs, mock database, mock provider and mock transport; they do not call Stripe, Resend or Cloudflare. The tests cover disabled gates, unavailable template, missing approval, identity/amount/terms conflicts, atomic claim rejection, idempotency key, provider timeout and missing acknowledgement. These tests are wired into `.github/workflows/public-site-qa.yml`; **CI result has not yet been verified**.

**Remaining release blockers:** implement independently reviewed and authenticated real adapters; ensure exact Stripe-email identity verification and HMAC key management; verify and publish templates with approval; validate provider-side idempotency and reconciliation; approve a bounded test-only deployment, then conduct a separate audited signed-webhook-to-D1-to-Resend flow. No live payment or customer email path is authorized.
