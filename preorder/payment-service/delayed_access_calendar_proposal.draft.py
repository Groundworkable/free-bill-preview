"""Illustrative offline calendar; NOT an approved late-delivery policy or entitlement engine.

Only the Jan 1 2027 on-time calendar is founder-approved. This module models
ONE possible shifted-anniversary treatment for late access, so the founder
and counsel can assess it. It never authorizes access, renewal, refund, email,
date publication, or live billing. No I/O other than approved local JSON.

It deliberately refuses unsupported day-29-31 anniversaries, because month
clamping rules are unresolved and should not be invented.
"""
from calendar import monthrange
from datetime import date, timedelta
from pathlib import Path
import json

CALENDAR=json.loads(Path(__file__).with_name("offer-calendar.contract.json").read_text(encoding="utf-8"))
TARGET=date.fromisoformat(CALENDAR["launch"]["application_target"])
CUTOFF=date.fromisoformat(CALENDAR["late_launch"]["final_unresolved_order_resolution_date"])


def _next_month_at_anchor(start: date, months: int) -> date:
    year = start.year + (start.month - 1 + months) // 12
    month = (start.month - 1 + months) % 12 + 1
    # Use only anchors without Feb28/29 clamping ambiguity for the proposal.
    assert start.day <= 28
    assert start.day <= monthrange(year,month)[1]
    return date(year,month,start.day)


def illustrative_late_calendar(*, hypothetical_usable_start: date, offer: str) -> dict:
    """Return a NONBINDING draft scenario; never customer-facing actual terms.

    A caller-provided date is not evidence of product availability or actual
    activation. Jan 15 buyer-resolution obligations exist independently.
    """
    base={
        "approved_for_use":False,
        "implemented":False,
        "customer_notification_authorized":False,
        "refund_authorized":False,
        "payment_or_renewal_authorized":False,
        "source_calendar":"founder_approved_on_time_only",
        "late_dates_status":CALENDAR["late_launch"]["exact_adjusted_start_dates"],
    }
    if type(hypothetical_usable_start) is not date or offer not in ("monthly","annual"):
        return {**base,"classification":"manual_review","reason":"invalid_scenario"}
    if hypothetical_usable_start < TARGET:
        return {**base,"classification":"manual_review","reason":"prelaunch_preview_is_separate"}
    if hypothetical_usable_start.day > 28:
        return {**base,"classification":"manual_review","reason":"month_end_anniversary_rule_unapproved"}
    if CALENDAR["late_launch"]["exact_adjusted_start_dates"]!="UNAPPROVED":
        return {**base,"classification":"manual_review","reason":"source_calendar_revised_reconcile_first"}

    paid_count=1 if offer=="monthly" else 12
    dates=[]
    # One purchased month, one separate full complimentary month, then
    # remaining purchased months. This proposal exactly reproduces the
    # approved Jan1 case but is NOT approved for any late activation.
    for slot in range(paid_count + 1):
        begin=_next_month_at_anchor(hypothetical_usable_start,slot)
        following=_next_month_at_anchor(hypothetical_usable_start,slot+1)
        is_free=slot==1
        dates.append({
            "kind":"complimentary" if is_free else "purchased",
            "paid_month_number":None if is_free else (1 if slot==0 else slot),
            "start":begin.isoformat(),
            "last_day":(following-timedelta(days=1)).isoformat(),
        })
    assert len([x for x in dates if x["kind"]=="purchased"])==paid_count
    assert len([x for x in dates if x["kind"]=="complimentary"])==1
    assert dates[0]["start"]==hypothetical_usable_start.isoformat()
    for a,b in zip(dates,dates[1:]):
        assert date.fromisoformat(a["last_day"])+timedelta(days=1)==date.fromisoformat(b["start"])

    end=_next_month_at_anchor(hypothetical_usable_start,paid_count+1)
    outcome={
        **base,
        "classification":"founder_approved_on_time_reference" if hypothetical_usable_start==TARGET
                         else "REVIEW_ONLY_alternative_not_approved",
        "hypothetical_start":hypothetical_usable_start.isoformat(),
        "offer":offer,
        "total_paid_months":paid_count,
        "full_bonus_months":1,
        "sequence":dates,
        "last_covered_day":(end-timedelta(days=1)).isoformat(),
        "earliest_separate_future_purchase_date":end.isoformat(),
        "requires_specific_dated_customer_extension_before_late_delivery":hypothetical_usable_start>CUTOFF,
        "unclaimed_invitation_never_starts_clock":True,
        "statutory_and_contract_refund_rights_preserved":True,
        "important_caveat":"If start shifts, the complimentary month may NOT be February 2027. This is a material policy decision needing the founder and legal review.",
    }
    # Only on-time output may be compared against approved dates; even it
    # grants NO actual membership or checkout permission.
    if hypothetical_usable_start==TARGET:
        cfg=CALENDAR["monthly_prepay"] if offer=="monthly" else CALENDAR["annual_prepay"]
        paid_months=[x["start"][:7] for x in dates if x["kind"]=="purchased"]
        gift_months=[x["start"][:7] for x in dates if x["kind"]=="complimentary"]
        assert paid_months==cfg["covered_months"]
        assert gift_months==cfg["bonus_free_months"]
        if offer=="annual":
            assert outcome["last_covered_day"]==cfg["last_covered_date"]
    return outcome
