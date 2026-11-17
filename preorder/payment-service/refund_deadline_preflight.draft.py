"""Review-only operational deadline planning for Groundwork's PRE-PURCHASES.

Uses the founder-approved planning rule: initiate an eligible, verified ordinary
refund within five business days; January 15, 2027 is the unresolved-order
customer resolution cutoff, not a replacement launch date.

Requires the operator to supply a verified business-day closure calendar.
Weekends alone do not account for holidays. Unknown calendars or pending
identity verification return an urgent MANUAL REVIEW, never a false deadline.

No network, database, notifications, cancellations, authorizations, refunds or
customer data. This is not published policy, legal advice or a scheduler.
"""
from datetime import date, timedelta

CUTOFF = date(2027, 1, 15)
WINDOW_DAYS = 5


def _hold(reason: str) -> dict:
    return {
        "status": "manual_review_required",
        "reason": reason,
        "weekday_only_estimate": None,
        "confirmed_planning_deadline": None,
        "refund_initiated": False,
        "refund_authorized": False,
        "order_cancelled": False,
        "customer_notified": False,
    }


def _date(value) -> bool:
    return type(value) is date


def _business_day(day: date, closed_days: frozenset[date]) -> bool:
    return day.weekday() < 5 and day not in closed_days


def five_business_days_after(*, anchor: date, closed_days, calendar_verified: bool) -> dict:
    """Return a *planning* due-date, not a legal/payment processor guarantee.

    A fully verified closure list must be explicitly supplied, including holidays
    applicable to the business. The anchor date is excluded from the count.
    """
    if not _date(anchor) or type(calendar_verified) is not bool:
        return _hold("invalid_date_or_calendar")
    if not isinstance(closed_days, (set, frozenset)):
        return _hold("business_calendar_not_supplied")
    if not all(_date(x) for x in closed_days):
        return _hold("invalid_calendar_day")
    if calendar_verified is not True:
        return _hold("business_calendar_not_verified")
    closed = frozenset(closed_days)
    day = anchor
    count = 0
    while count < WINDOW_DAYS:
        day += timedelta(days=1)
        if _business_day(day, closed):
            count += 1
    return {
        "status": "planning_date_only",
        "reason": "verified_business_calendar_supplied",
        "weekday_only_estimate": None,
        "confirmed_planning_deadline": day.isoformat(),
        "refund_initiated": False,
        "refund_authorized": False,
        "order_cancelled": False,
        "customer_notified": False,
    }


def assess_verified_refund_request(*, requested_on: date, verified_on: date | None,
                                  as_of: date, closed_days, calendar_verified: bool) -> dict:
    """Review approved five-business-day initiation standard, not eligibility.

    Both the refund request and buyer/order verification must exist before a
    planning deadline is calculated. Unverified cases remain urgent: do not let
    verification delays erase customer rights or the original receipt timestamp.
    """
    if not _date(requested_on) or not _date(as_of) or as_of < requested_on:
        return _hold("request_or_review_date_invalid")
    if verified_on is None:
        return _hold("verification_pending_escalate_from_request_date")
    if not _date(verified_on) or verified_on > as_of:
        return _hold("verification_date_invalid")
    # Existing verification may predate a refund request; both are required.
    anchor = max(requested_on, verified_on)
    result = five_business_days_after(
        anchor=anchor, closed_days=closed_days, calendar_verified=calendar_verified
    )
    if result["confirmed_planning_deadline"] is not None:
        deadline = date.fromisoformat(result["confirmed_planning_deadline"])
        result["reason"] = ("planning_deadline_overdue_escalate"
                            if as_of > deadline else "planning_deadline_not_past")
        result["status"] = "human_action_required"
    return result


def assess_unresolved_prepurchase(*, as_of: date, usable_access_delivered: bool,
                                  affirmative_later_date_consent: bool,
                                  specific_later_date: date | None,
                                  consent_recorded_on: date | None,
                                  cancellation_verified: bool,
                                  provider_refund_initiation_verified: bool) -> dict:
    """Plan the January 15 resolution gate; never execute or assume an action.

    Silence, a generic promise, or an undated extension is NOT affirmative
    consent to defer delivery. A missed agreed date requires renewed review.
    Flags are caller assertions, not proof of real customer consent or delivery.
    """
    if (not _date(as_of) or type(usable_access_delivered) is not bool
        or type(affirmative_later_date_consent) is not bool
        or type(cancellation_verified) is not bool
        or type(provider_refund_initiation_verified) is not bool):
        return _hold("unverified_resolution_evidence")
    if usable_access_delivered:
        return _hold("delivery_asserted_independent_verification_required")
    valid_extension = (
        affirmative_later_date_consent is True
        and _date(specific_later_date) and specific_later_date > CUTOFF
        and _date(consent_recorded_on) and consent_recorded_on <= CUTOFF
        and consent_recorded_on <= as_of
    )
    if valid_extension and as_of <= specific_later_date:
        return _hold("dated_extension_asserted_independent_verification_required")
    if valid_extension and as_of > specific_later_date:
        return _hold("agreed_delivery_date_missed_escalate_refund")
    if as_of < CUTOFF:
        return _hold("cutoff_not_reached_continue_readiness_review")
    if provider_refund_initiation_verified and cancellation_verified:
        return _hold("cancellation_and_initiation_asserted_verify_provider_evidence")
    return _hold("cutoff_passed_unresolved_escalate_cancellation_and_full_refund")
