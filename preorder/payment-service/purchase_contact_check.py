"""Read-only verification aid for isolated Stripe test pre-purchase support.

No network access, secrets, writes, emails, refunds or membership operations.
Inputs must be independently retrieved provider/test-mode snapshots; the
caller-asserted provider_verified flag does NOT authenticate that evidence.
Matching a customer-supplied email is NOT proof of control of that mailbox.
Only return booleans/concern codes, never personally identifying contact values.
"""
from __future__ import annotations

import re
from typing import Any

_ID = re.compile(r"^[A-Za-z0-9]+$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().casefold()
    if len(normalized) > 254 or not _EMAIL.fullmatch(normalized):
        return None
    return normalized


def _id(value: Any, prefix: str) -> bool:
    return isinstance(value, str) and value.startswith(prefix) and bool(_ID.fullmatch(value[len(prefix):]))


def inspect_test_purchase_contact(
    order: dict, session: dict, *,
    requester_email: str | None,
    provider_verified: bool,
) -> dict:
    """Flag mismatched Stripe Checkout/D1 evidence without exporting contact PII.

    The caller must have obtained the Checkout Session independently through an
    authenticated Stripe TEST API retrieval. A true provider_verified flag is
    an assertion by the caller, not independently proven by this pure function.
    Neither email equality nor a matching purchase gives refund/fulfillment
    authority. D1 continues to store no email, app account, or entitlement.
    """
    if not isinstance(order, dict) or not isinstance(session, dict):
        raise ValueError("Order and Checkout Session snapshots must be objects")
    if type(provider_verified) is not bool:
        raise ValueError("Provider verification must be explicitly true or false")

    concerns: list[str] = []
    if not provider_verified:
        concerns.append("stripe_snapshot_not_independently_verified")

    if (order.get("status") != "paid_unfulfilled" or
        order.get("currency") != "usd" or
        not _id(order.get("checkout_session_id"), "cs_test_") or
        not _id(order.get("payment_intent_id"), "pi_") or
        type(order.get("total_cents")) is not int or order["total_cents"] <= 0):
        concerns.append("invalid_isolated_order")

    if (session.get("object") != "checkout.session" or
        session.get("livemode") is not False or
        session.get("mode") != "payment" or
        session.get("payment_status") != "paid" or
        not _id(session.get("id"), "cs_test_")):
        concerns.append("not_verified_paid_test_checkout")

    for field, provider_field in (
        ("checkout_session_id", "id"),
        ("payment_intent_id", "payment_intent"),
        ("payment_link_id", "payment_link"),
    ):
        if order.get(field) != session.get(provider_field) or order.get(field) is None:
            concerns.append(field + "_mismatch")

    stored_customer = order.get("stripe_customer_id")
    provider_customer = session.get("customer")
    if stored_customer != provider_customer:
        concerns.append("stripe_customer_id_mismatch")

    if session.get("currency") != "usd":
        concerns.append("currency_mismatch")
    if (type(session.get("amount_total")) is not int or
        session.get("amount_total") != order.get("total_cents")):
        concerns.append("total_mismatch")
    consent = session.get("consent")
    if not isinstance(consent, dict) or consent.get("terms_of_service") != "accepted":
        concerns.append("terms_acceptance_missing")

    details = session.get("customer_details")
    if details is not None and not isinstance(details, dict):
        concerns.append("invalid_customer_details")
        details = {}
    detail_email = _email((details or {}).get("email"))
    supplied_email = _email(session.get("customer_email"))

    if not detail_email and not supplied_email:
        concerns.append("stripe_contact_email_missing")
    if detail_email and supplied_email and detail_email != supplied_email:
        concerns.append("stripe_contact_email_conflict")

    customer_email = detail_email or supplied_email
    claim = _email(requester_email)
    if claim is None:
        concerns.append("claimant_email_missing_or_invalid")
    elif customer_email is not None and claim != customer_email:
        concerns.append("claimant_email_mismatch")

    return {
        "isolated_test_only": True,
        "provider_evidence_asserted_verified": provider_verified,
        "stored_purchase_matches_provider": not any(
            code in concerns for code in (
                "invalid_isolated_order", "not_verified_paid_test_checkout",
                "checkout_session_id_mismatch", "payment_intent_id_mismatch",
                "payment_link_id_mismatch", "stripe_customer_id_mismatch",
                "currency_mismatch", "total_mismatch", "terms_acceptance_missing"
            )
        ),
        "requester_email_matches_provider": bool(
            claim and customer_email and claim == customer_email and
            "stripe_contact_email_conflict" not in concerns
        ),
        "evidence_consistent_for_manual_review": not concerns,
        "requires_identity_verification_by_operator": True,
        "authorizes_refund": False,
        "authorizes_customer_message": False,
        "authorizes_membership": False,
        "concerns": sorted(set(concerns)),
    }
