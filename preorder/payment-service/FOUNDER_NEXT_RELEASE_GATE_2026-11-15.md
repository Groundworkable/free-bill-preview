# Founder Worker — CURRENT next gate after accidental deployment and rollback

**Status Nov 15, 2026:** The founder manually deployed a candidate version (`22367a82` short ID shown in Cloudflare) and **rolled back**. A screenshot confirms original bootstrap `1f97ea8e-4ba6-47d9-87f6-11594c938cc1` restored at **100%** production traffic. The historical candidate version is listed as Ready but **not receiving production traffic**.

The previous instruction to stage via Cloudflare Edit code is **superseded**. **Do not paste, Save, Deploy, Rollback or upload again.** The version may already exist and should be inspected without another account mutation.

See [post-rollback checkpoint](./FOUNDER_POST_ROLLBACK_CHECKPOINT_2026-11-15.md) for exact evidence and remaining gaps.

## Read-only actions that can proceed

- GitHub CI: fresh unauthenticated Cloudflare Access smoke; separate disabled-payment Worker check. Both are credential-free.
- Cloudflare owner (only if needed later): inspect historical version `22367a82` and compare its source and metadata to the CI-tested artifact. Do not send variable values, audience tag or raw JSON.
- Keep `1f97ea8e` at 100% until version integrity, Access and rollback controls are verified.

GitHub CI source: `124f9ea5775788842907b984489327d2a0c0ee4f`, [run 43762783601](https://github.com/Groundworkable/free-bill-preview/actions/runs/43762783601), review artifact `founder-runtime-review-124f9ea5775788842907b984489327d2a0c0ee4f`.

**No new deployment, notification dispatch, email, payment activation, database migration, or PR merge is approved.**
