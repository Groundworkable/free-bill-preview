"""Read-only refund/dispute reconciliation rehearsal for the isolated Stripe sandbox.

No credentials, network operations, database writes, refund execution, or entitlements.
The caller must supply COMPLETE, independently obtained Stripe test-mode snapshots.
Synthetic fixtures never establish that an actual refund was performed.
"""
from collections import Counter
from typing import Any

FINAL_REFUNDS = {"succeeded"}
OPEN_REFUNDS = {"pending", "requires_action"}
FAILED_REFUNDS = {"failed", "canceled"}
REFUND_STATUSES = FINAL_REFUNDS | OPEN_REFUNDS | FAILED_REFUNDS
DISPUTE_STATUSES = {
    "warning_needs_response", "warning_under_review", "warning_closed",
    "needs_response", "under_review", "won", "lost", "prevented",
}


def _valid_amount(value: Any) -> bool:
    return type(value) is int and value > 0


def reconcile_test_snapshots(order: dict, refunds: list[dict], disputes: list[dict],
                             journal: list[dict], *, complete: bool,
                             expected_refund_id: str | None = None,
                             expected_refund_amount: int | None = None) -> dict:
    """Compare provided Stripe snapshots with an isolated D1 event journal.

    Never infer current provider state from the latest arriving webhook. Each
    refund is counted ONCE by provider refund ID, regardless of journal length.
    `complete=True` is a caller assertion, not evidence that Stripe was queried.
    This function does not verify payment-to-card settlement or authorize use.
    """
    if type(complete) is not bool:
        raise ValueError("Snapshot completeness must be explicit")
    if not isinstance(order, dict) or not isinstance(refunds, list) or not isinstance(disputes, list) or not isinstance(journal, list):
        raise ValueError("Invalid reconciliation input")
    if order.get("status") != "paid_unfulfilled" or order.get("currency") != "usd" or not _valid_amount(order.get("total_cents")):
        raise ValueError("Only an existing immutable USD paid_unfulfilled order is supported")
    intent = order.get("payment_intent_id")
    if not isinstance(intent, str) or not intent.startswith("pi_"):
        raise ValueError("Purchase is missing a valid PaymentIntent")
    if expected_refund_id is not None and (not isinstance(expected_refund_id, str) or not expected_refund_id.startswith("re_")):
        raise ValueError("Invalid requested refund ID")
    if expected_refund_amount is not None and not _valid_amount(expected_refund_amount):
        raise ValueError("Invalid expected amount")
    if (expected_refund_id is None) != (expected_refund_amount is None):
        raise ValueError("Specify both the expected refund ID and expected amount")

    concerns = []
    if not complete:
        concerns.append("provider_snapshot_completeness_unverified")
    refunds_by_id = {}
    totals = Counter({"succeeded_cents": 0, "in_flight_cents": 0, "failed_or_canceled_cents": 0})
    for refund in refunds:
        rid, amount = refund.get("id"), refund.get("amount")
        if (not isinstance(rid, str) or not rid.startswith("re_") or rid in refunds_by_id or
            refund.get("livemode") is not False or not _valid_amount(amount) or
            refund.get("currency") != "usd" or refund.get("status") not in REFUND_STATUSES):
            raise ValueError("Incomplete, duplicate, or invalid provider refund snapshot")
        if refund.get("payment_intent") != intent:
            concerns.append("provider_refund_wrong_or_missing_payment_intent:" + rid)
        refunds_by_id[rid] = refund
        if refund["status"] in FINAL_REFUNDS:
            totals["succeeded_cents"] += amount
        elif refund["status"] in OPEN_REFUNDS:
            totals["in_flight_cents"] += amount
        else:
            totals["failed_or_canceled_cents"] += amount

    if totals["succeeded_cents"] + totals["in_flight_cents"] > order["total_cents"]:
        concerns.append("succeeded_plus_in_flight_exceeds_purchase")

    dispute_ids = set()
    for dispute in disputes:
        did = dispute.get("id")
        if (not isinstance(did, str) or not did.startswith("dp_") or did in dispute_ids or
            dispute.get("livemode") is not False or
            not _valid_amount(dispute.get("amount")) or dispute.get("currency") != "usd" or
            dispute.get("status") not in DISPUTE_STATUSES):
            raise ValueError("Incomplete, duplicate, or invalid provider dispute snapshot")
        dispute_ids.add(did)
        if dispute.get("payment_intent") != intent:
            concerns.append("provider_dispute_wrong_or_missing_payment_intent:" + did)
    if disputes:
        concerns.append("dispute_present_requires_manual_review")

    # Journal observations are only audit evidence; never sum them or choose a
    # financial status by received_at/event ID / delivery order.
    observed_refunds = set()
    observed_disputes = set()
    event_ids = set()
    for row in journal:
        eid, kind, oid = row.get("event_id"), row.get("event_type"), row.get("object_id")
        if not isinstance(eid, str) or eid in event_ids:
            raise ValueError("Invalid or repeated journal event ID")
        event_ids.add(eid)
        if row.get("payment_intent_id") is None:
            concerns.append("unresolved_charge_only_event:" + eid)
            continue
        if row.get("payment_intent_id") != intent:
            concerns.append("journal_wrong_payment_intent:" + eid)
            continue
        if kind in {"refund.created", "refund.updated", "refund.failed"}:
            observed_refunds.add(oid)
            if oid not in refunds_by_id:
                concerns.append("journal_refund_not_in_provider_snapshot:" + str(oid))
            elif row.get("amount_cents") != refunds_by_id[oid]["amount"]:
                concerns.append("journal_refund_amount_mismatch:" + str(oid))
        elif kind in {"charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"}:
            observed_disputes.add(oid)
            if oid not in dispute_ids:
                concerns.append("journal_dispute_not_in_provider_snapshot:" + str(oid))
        else:
            raise ValueError("Unexpected journal event type")

    for rid in refunds_by_id:
        if rid not in observed_refunds:
            concerns.append("provider_refund_missing_from_journal:" + rid)
    for did in dispute_ids:
        if did not in observed_disputes:
            concerns.append("provider_dispute_missing_from_journal:" + did)

    requested = refunds_by_id.get(expected_refund_id) if expected_refund_id else None
    if expected_refund_id and requested is None:
        concerns.append("expected_refund_not_found")
    elif requested and requested["amount"] != expected_refund_amount:
        concerns.append("expected_refund_amount_mismatch")
    elif requested and requested["status"] != "succeeded":
        concerns.append("expected_refund_not_succeeded")

    return {
        "purchase_status_unchanged": order["status"] == "paid_unfulfilled",
        "payment_intent_id": intent,
        "provider_refund_count": len(refunds_by_id),
        "journal_event_count": len(journal),
        "succeeded_refunds_cents": totals["succeeded_cents"],
        "pending_refunds_cents": totals["in_flight_cents"],
        "failed_or_canceled_refunds_cents": totals["failed_or_canceled_cents"],
        "dispute_count": len(disputes),
        "requires_manual_review": bool(concerns),
        "concerns": sorted(set(concerns)),
        "snapshot_indicates_requested_refund_succeeded": bool(
            complete and requested and requested.get("status") == "succeeded" and
            requested.get("amount") == expected_refund_amount and not concerns
        ),
        "real_refund_execution_verified": False,  # Rehearsal only; requires external evidence.
    }
