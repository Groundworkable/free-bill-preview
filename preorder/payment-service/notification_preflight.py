"""Offline notification preflight for the isolated Groundwork test payment service.

This is a pure, draft-only validation gate. It does not query Stripe, authenticate
the recipient, write a database, invoke Resend or authorize a notification.
The operator must independently validate provider evidence and claimant identity.
The passed-in previously_sent_keys list is not an atomic send ledger.
"""
from __future__ import annotations

import hashlib
import re
from collections.abc import Collection
from typing import Any

TEST_SESSION = re.compile(r"^cs_test_[A-Za-z0-9]+$")
TEST_REFUND = re.compile(r"^re_[A-Za-z0-9]+$")
REVISION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$")
KINDS = {"purchase_confirmation", "delivery_update", "refund_initiated"}


def inspect_notification_preflight(
    *,
    kind: str,
    order: dict[str, Any],
    contact_check: dict[str, Any],
    provider_event_verified: bool,
    notice_revision: str | None = None,
    refund: dict[str, Any] | None = None,
    previously_sent_keys: Collection[str] = (),
) -> dict[str, Any]:
    """Review a potential notice without returning personal information.

    The evidence flags are caller assertions, NOT independent verification.
    The caller must independently obtain test-mode Stripe records and, before any
    actual notification, validate recipient ownership and authorization.
    """
    if not isinstance(kind, str) or kind not in KINDS:
        raise ValueError("Unrecognized notification kind")
    if not isinstance(order, dict) or not isinstance(contact_check, dict):
        raise ValueError("Order/contact evidence must be objects")
    if type(provider_event_verified) is not bool:
        raise ValueError("Provider verification must be boolean")
    if isinstance(previously_sent_keys, (str, bytes)) or not isinstance(
        previously_sent_keys, Collection
    ) or not all(isinstance(k, str) for k in previously_sent_keys):
        raise ValueError("Previously sent keys must be a collection of strings")

    concerns: list[str] = []
    session = order.get("checkout_session_id")
    if (not isinstance(session, str) or not TEST_SESSION.fullmatch(session)
        or order.get("status") != "paid_unfulfilled"
        or order.get("currency") != "usd"):
        concerns.append("unverified_isolated_test_order")
    if not provider_event_verified:
        concerns.append("provider_event_not_independently_verified")

    # These are review flags, NOT identity proof. A copied purchase reference
    # or equal email address never establishes control of the recipient inbox.
    if not (
        contact_check.get("isolated_test_only") is True
        and contact_check.get("provider_evidence_asserted_verified") is True
        and contact_check.get("stored_purchase_matches_provider") is True
        and contact_check.get("requester_email_matches_provider") is True
        and contact_check.get("evidence_consistent_for_manual_review") is True
        and contact_check.get("requires_identity_verification_by_operator") is True
        and not contact_check.get("concerns")
    ):
        concerns.append("recipient_purchase_evidence_not_consistent")

    logical_id = None
    if kind == "purchase_confirmation":
        if notice_revision is not None or refund is not None:
            concerns.append("unexpected_purchase_notice_fields")
        logical_id = "purchase"

    elif kind == "delivery_update":
        if refund is not None:
            concerns.append("unexpected_refund_in_delivery_update")
        if not isinstance(notice_revision, str) or not REVISION.fullmatch(notice_revision):
            concerns.append("missing_or_invalid_notice_revision")
        else:
            logical_id = "delivery:" + notice_revision

    else:
        if notice_revision is not None:
            concerns.append("unexpected_refund_notice_revision")
        if not isinstance(refund, dict):
            concerns.append("refund_evidence_missing")
        elif (
            refund.get("livemode") is not False
            or not isinstance(refund.get("id"), str)
            or not TEST_REFUND.fullmatch(refund["id"])
            or refund.get("currency") != "usd"
            or type(refund.get("amount")) is not int or refund["amount"] <= 0
            or refund.get("payment_intent") != order.get("payment_intent_id")
            or refund.get("status") not in {"pending", "requires_action", "succeeded"}
            or refund.get("provider_initiation_verified") is not True
        ):
            concerns.append("refund_initiation_not_verified")
        else:
            logical_id = "refund:" + refund["id"]

    key = None
    if isinstance(session, str) and TEST_SESSION.fullmatch(session) and logical_id:
        # No email, dollar amount, raw event body, or secrets are placed in
        # the key. The namespace prevents collisions across different notices.
        seed = "groundwork-sandbox-notice-v1|" + session + "|" + logical_id
        key = "gwn1_" + hashlib.sha256(seed.encode("ascii")).hexdigest()
        if key in previously_sent_keys:
            concerns.append("logical_notice_already_sent")

    return {
        "kind": kind,
        "review_key": key,
        "manual_review_candidate": len(concerns) == 0,
        "concerns": sorted(set(concerns)),
        "identity_proven": False,
        "delivery_verified": False,
        "authorization_to_send": False,
        "authorization_to_refund": False,
        "authorization_to_activate_membership": False,
    }
