"""Draft-only voluntary refund arithmetic for the founder-approved January 2027 prepay schedule.

Offline review only: no Stripe, provider SDK, network, database, customer data,
entitlement change or refund execution. This is NOT a final legal decision.
All quoted amounts EXCLUDE tax and require independent human verification.

Source: preorder/CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md
and preorder/REFUND_DELAY_POLICY_FOR_APPROVAL.md.
Customer-facing wording is already founder-approved for legal review, NOT published.
"""
from datetime import date, datetime
from pathlib import Path
import json

CALENDAR = json.loads(Path(__file__).with_name("offer-calendar.contract.json").read_text())
PRICES = {"monthly": 999, "annual": 9600}


def _unverified(reason):
    return {
        "classification": "manual_review",
        "reason": reason,
        "baseline_usd_cents_excluding_tax": None,
        "tax_adjustment": "manual_required",
        "refund_authorized": False,
        "refund_executed": False,
        "account_access_modified": False,
    }


def quote_prepaid_voluntary_refund(*, offer, request_date, paid_access_start,
                                   status_verified, purchase_base_cents):
    """Nonbinding base-only quote; never a Stripe refund instruction.

    The caller must independently verify the actual usable paid-access status:
    paid_access_start=None means verified *not yet delivered*, which includes
    complimentary previews that do not consume the purchased period.

    Only the founder-approved JANUARY 1, 2027 launch calendar is supported.
    Delayed or mid-month starts, unclaimed access, disputed or defective service,
    tax adjustments, identity verification and statutory rights require a person
    to review them. No automatic quote authorizes a refund.
    """
    if offer not in PRICES or type(purchase_base_cents) is not int or type(status_verified) is not bool:
        return _unverified("invalid_or_unsupported_order")
    if (purchase_base_cents != PRICES[offer] or type(request_date) is not date):
        return _unverified("invalid_or_unsupported_order")
    if not status_verified:
        return _unverified("usable_access_not_verified")

    if paid_access_start is None:
        amount, rationale = purchase_base_cents, "verified_pre_activation_full_base"
    elif type(paid_access_start) is not date:
        return _unverified("invalid_or_unsupported_activation")
    elif paid_access_start != date(2027, 1, 1):
        return _unverified("delayed_or_midmonth_calendar_not_approved")
    elif request_date < paid_access_start:
        return _unverified("start_date_conflicts_with_request")
    elif (request_date - paid_access_start).days <= 6:
        # Seven calendar DATES, counting actual usable start date as day one.
        # Boundary timing needs final operational/legal review before use.
        amount, rationale = purchase_base_cents, "within_first_seven_calendar_dates"
    elif offer == "monthly":
        amount, rationale = 0, "monthly_used_period_after_seven_day_window"
    else:
        # Entirely FUTURE paid months ONLY. Current/part-used paid month is not
        # assumed unused based on a timestamp; free February never counts.
        paid_months = CALENDAR["annual_prepay"]["covered_months"]
        if (CALENDAR.get("status") != "founder_approved_schedule" or
            len(paid_months) != 12 or len(set(paid_months)) != 12 or
            paid_months[0] != "2027-01" or paid_months[-1] != "2028-01" or
            CALENDAR["annual_prepay"]["bonus_free_months"] != ["2027-02"]):
            return _unverified("contract_calendar_drift")
        future = sum(date.fromisoformat(month + "-01") > request_date for month in paid_months)
        amount, rationale = future * 800, "annual_entirely_future_paid_months_only"

    return {
        "classification": "draft_voluntary_policy_arithmetic",
        "reason": rationale,
        "baseline_usd_cents_excluding_tax": amount,
        "tax_adjustment": "manual_required",
        "refund_authorized": False,
        "refund_executed": False,
        "account_access_modified": False,
    }
