# Founder-only notification runtime — offline Wrangler bundle checkpoint

**November 15, 2026 — Draft PR #17. Staged and CI-verified; not deployed.**

## Verified release candidate boundary

The separate Cloudflare Worker `groundwork-founder-notifications-isolated` already exists, is protected by Cloudflare Access on **All traffic**, and its approved founder policy identifies `groundworkbyable@gmail.com`. The founder has verified authentication and the inert live page `Founder service disabled`, including after adding separate `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` Worker variables. No application database binding or notification credentials are present in the confirmed cloud setup.

The draft operational entrypoint `founder_notification_worker.draft.mjs` imports the sender, Stripe-test/Resend provider adapters and independent review module, which import the payment verification module; it **must be bundled** rather than pasted directly into Cloudflare's single-file editor.

## Local-only build and tests

CI now installs Wrangler in the existing test job and runs:

```sh
npx wrangler deploy ./founder_notification_worker.draft.mjs --name groundwork-founder-notifications-isolated --dry-run --outdir ./.founder-runtime-build --compatibility-date 2026-11-15
node founder_runtime_bundle.dry_run.test.mjs
```

Despite the `deploy` subcommand, `--dry-run` **does not deploy**. The resulting local artifact is in a temporary GitHub Actions runner directory, **not published**. Do **not** rerun without `--dry-run` and do not replace the Cloudflare live Worker source.

`founder_runtime_bundle.dry_run.test.mjs` loads the **actual compiled bundle** and checks:
- One JS bundle, no unresolved relative or Node-only imports and no test-only or payment-webhook routes.
- With administrative gates disabled, the status/review/dispatch endpoints return 503 `service_disabled` and `Cache-Control: no-store, private`.
- Non-founder Access identity, invalid Access audience and absent Access context all return 403 when only the administrative gate is hypothetically enabled in a local mock.
- Even with valid mocked Access context, separately disabled review/dispatch routes refuse operations.
- No network calls occur to Stripe, Resend or any provider in this disabled-state test.

CI job `notification-safe-tests` passed on [GitHub Actions run 43729344664](https://github.com/Groundworkable/free-bill-preview/actions/runs/43729344664), along with `remote-worker-fail-closed`, at commit `2c48051d6d70c74142635f270c881518745e7e06`. This is **offline evidence**, not a live service check.

## Blocking gates before any Cloudflare runtime deployment

1. Founder explicitly approves replacing the 503-only bootstrap on **the same separate founder Worker**, not the deployed payment receiver, with the **reviewed bundle**. No such authorization is implied by 'onward'.
2. Review how the bundle artifact will be deployed. Current `wrangler.founder-notification.draft.toml` is a preparation scaffold with `workers_dev=false` and `preview_urls=false`, and is **not** approved for live deployment. A blind Wrangler deployment could alter the now-Access-protected workers.dev route or overwrite dashboard-managed identity variables. Confirm `FOUNDER_ACCESS_AUD` and `FOUNDER_ACCESS_EMAIL` will be preserved and routing remains Access-protected before deploying.
3. Document and verify disabled-by-default runtime variables and their exact case/values. Admin must remain **disabled**, review **false**, dispatch **false**, send mode **disabled**, operator release **false**, templates approved **false**, payments **disabled**, terms approved **false**, terms version **UNAPPROVED**. Note that the live bootstrap doesn't use these operational gates.
4. No DB binding until separate exact database scope and read-only behavior is verified; no Stripe or Resend credentials until a separately approved narrow integration test. No customer-facing send, payment or refund is authorized.
5. After separately approved runtime deployment, independently check Cloudflare Access unauthenticated denial, authorized identity, wrong identity, disabled endpoints, absence of customer data leakage and rollback to the 503 bootstrap. Ensure `ctx.access` behavior is verified in the target Cloudflare environment; mocked signed-in identities alone do not demonstrate that.

**Current action:** commit bundle test and checkpoint only. **No Cloudflare code, vars, DB bindings or Access policies changed.** Do not merge PR #17 or switch on Stripe/Resend/checkout.
