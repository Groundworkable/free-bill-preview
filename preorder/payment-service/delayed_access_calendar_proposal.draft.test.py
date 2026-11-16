"""Offline negative and positive checks for NONBINDING proposed late-start calendar."""
from datetime import date, timedelta
from pathlib import Path
from runpy import run_path
scenario = run_path(str(Path(__file__).with_name("delayed_access_calendar_proposal.draft.py")))["illustrative_late_calendar"]

for offer,paid,total in (("monthly",1,2),("annual",12,13)):
    on_time=scenario(hypothetical_usable_start=date(2027,1,1),offer=offer)
    assert on_time["classification"]=="founder_approved_on_time_reference"
    assert on_time["total_paid_months"]==paid
    assert on_time["full_bonus_months"]==1
    assert len(on_time["sequence"])==total
    assert on_time["sequence"][0]["start"]=="2027-01-01"
    assert on_time["sequence"][0]["last_day"]=="2027-01-31"
    assert on_time["sequence"][1]["start"]=="2027-02-01"
    assert on_time["sequence"][1]["last_day"]=="2027-02-28"
    assert on_time["earliest_separate_future_purchase_date"] == ("2027-03-01" if offer=="monthly" else "2028-02-01")
    assert on_time["last_covered_day"] == ("2027-02-28" if offer=="monthly" else "2028-01-31")
    assert not on_time["approved_for_use"]
    assert not on_time["implemented"]
    assert not on_time["customer_notification_authorized"]
    assert not on_time["refund_authorized"]
    assert not on_time["payment_or_renewal_authorized"]

    for start in [date(2027,1,8),date(2027,1,15),date(2027,1,20),date(2027,1,28),date(2027,2,1),date(2027,3,10)]:
        draft=scenario(hypothetical_usable_start=start,offer=offer)
        assert draft["classification"]=="REVIEW_ONLY_alternative_not_approved"
        assert draft["late_dates_status"]=="UNAPPROVED"
        assert not draft["approved_for_use"] and not draft["implemented"]
        assert draft["total_paid_months"]==paid
        assert draft["full_bonus_months"]==1
        assert len(draft["sequence"])==total
        assert draft["sequence"][0]["start"]==start.isoformat()
        assert draft["requires_specific_dated_customer_extension_before_late_delivery"] == (start>date(2027,1,15))
        assert draft["unclaimed_invitation_never_starts_clock"]
        assert draft["statutory_and_contract_refund_rights_preserved"]
        assert sum(x["kind"]=="purchased" for x in draft["sequence"])==paid
        assert sum(x["kind"]=="complimentary" for x in draft["sequence"])==1
        assert [x["paid_month_number"] for x in draft["sequence"] if x["kind"]=="purchased"]==list(range(1,paid+1))
        for first,second in zip(draft["sequence"],draft["sequence"][1:]):
            assert date.fromisoformat(first["last_day"])+timedelta(days=1)==date.fromisoformat(second["start"])
        assert date.fromisoformat(draft["last_covered_day"])+timedelta(days=1)==date.fromisoformat(draft["earliest_separate_future_purchase_date"])
        assert not draft["payment_or_renewal_authorized"]

    for invalid,reason in [
        (date(2026,12,14),"prelaunch_preview_is_separate"),
        (date(2027,1,29),"month_end_anniversary_rule_unapproved"),
        (date(2027,1,30),"month_end_anniversary_rule_unapproved"),
        (date(2027,1,31),"month_end_anniversary_rule_unapproved"),
    ]:
        case=scenario(hypothetical_usable_start=invalid,offer=offer)
        assert case["classification"]=="manual_review" and case["reason"]==reason
        assert "sequence" not in case
        assert not case["approved_for_use"]

for value in ["annual",None,123]:
    assert scenario(hypothetical_usable_start=value,offer="monthly")["classification"]=="manual_review"
assert scenario(hypothetical_usable_start=date(2027,1,1),offer="founding_access")["classification"]=="manual_review"
print("PASS: delayed-access model preserves purchased time, tests Jan1 approved baseline, flags all late scenarios as unapproved; no billing or activation")
