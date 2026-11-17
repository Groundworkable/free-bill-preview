"""Synthetic tests for voluntary refund initiation and unresolved January 15 gate."""
from datetime import date
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("refund_deadline_preflight.draft.py")
spec=importlib.util.spec_from_file_location("refund_deadline",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=date.fromisoformat
def deadline(anchor, closed=set(), verified=True):
    return m.five_business_days_after(
        anchor=d(anchor),closed_days=set(map(d,closed)),calendar_verified=verified)
def request(r,verified,on,closed=set(),calendar=True):
    return m.assess_verified_refund_request(
        requested_on=d(r),verified_on=d(verified) if verified else None,as_of=d(on),
        closed_days=set(map(d,closed)),calendar_verified=calendar)
def cutoff(on,**overrides):
    x=dict(as_of=d(on),usable_access_delivered=False,
           affirmative_later_date_consent=False,specific_later_date=None,
           consent_recorded_on=None,cancellation_verified=False,
           provider_refund_initiation_verified=False)
    x.update(overrides)
    return m.assess_unresolved_prepurchase(**x)

# Jan 15, 2027 is Friday. Holiday/closure dates are PROVIDED rather than guessed.
assert deadline("2027-01-15")["confirmed_planning_deadline"]=="2027-01-22"
assert deadline("2027-01-15", {"2027-01-18"})["confirmed_planning_deadline"]=="2027-01-25"
assert deadline("2027-01-15",verified=False)["confirmed_planning_deadline"] is None
assert m.five_business_days_after(anchor=d("2027-01-15"),closed_days=None,
                                 calendar_verified=True)["status"]=="manual_review_required"
assert deadline("2026-12-31",{"2027-01-01"})["confirmed_planning_deadline"]=="2027-01-08"
assert request("2027-01-12",None,"2027-01-18")["reason"]=="verification_pending_escalate_from_request_date"
assert request("2027-01-12","2027-01-14","2027-01-15")["confirmed_planning_deadline"]=="2027-01-21"
assert request("2027-01-12","2027-01-14","2027-01-22")["reason"]=="planning_deadline_overdue_escalate"
assert request("2027-01-12","2027-01-14","2027-01-15",calendar=False)["status"]=="manual_review_required"
assert request("2027-01-12","2027-01-16","2027-01-15")["status"]=="manual_review_required"
assert request("2027-01-16","2027-01-14","2027-01-15")["status"]=="manual_review_required"

assert cutoff("2027-01-14")["reason"]=="cutoff_not_reached_continue_readiness_review"
assert cutoff("2027-01-15")["reason"]=="cutoff_passed_unresolved_escalate_cancellation_and_full_refund"
assert cutoff("2027-01-16")["reason"]=="cutoff_passed_unresolved_escalate_cancellation_and_full_refund"
# Mere yes/consent without a SPECIFIC, timely recorded later date cannot extend it.
assert cutoff("2027-01-16",affirmative_later_date_consent=True)["reason"]=="cutoff_passed_unresolved_escalate_cancellation_and_full_refund"
assert cutoff("2027-01-16",affirmative_later_date_consent=True,
              specific_later_date=d("2027-01-30"))["reason"]=="cutoff_passed_unresolved_escalate_cancellation_and_full_refund"
assert cutoff("2027-01-16",affirmative_later_date_consent=True,
              specific_later_date=d("2027-01-30"),consent_recorded_on=d("2027-01-18"))["reason"]=="cutoff_passed_unresolved_escalate_cancellation_and_full_refund"
assert cutoff("2027-01-16",affirmative_later_date_consent=True,
              specific_later_date=d("2027-01-30"),consent_recorded_on=d("2027-01-10"))["reason"]=="dated_extension_asserted_independent_verification_required"
assert cutoff("2027-02-01",affirmative_later_date_consent=True,
              specific_later_date=d("2027-01-30"),consent_recorded_on=d("2027-01-10"))["reason"]=="agreed_delivery_date_missed_escalate_refund"
assert cutoff("2027-01-17",usable_access_delivered=True)["reason"]=="delivery_asserted_independent_verification_required"
assert cutoff("2027-01-17",cancellation_verified=True,
              provider_refund_initiation_verified=True)["reason"]=="cancellation_and_initiation_asserted_verify_provider_evidence"
for output in (
    deadline("2027-01-15"),
    request("2027-01-12","2027-01-14","2027-01-22"),
    cutoff("2027-01-15"),
):
    assert all(output[x] is False for x in ("refund_initiated","refund_authorized","order_cancelled","customer_notified"))
print("PASS: deadline planner requires verified calendar, escalates late requests and unresolved January 15 orders; never executes actions")
