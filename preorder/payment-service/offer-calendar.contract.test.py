"""Validate the founder-approved data-only prepay calendar; do not enable checkout."""
import json
from pathlib import Path
from datetime import date, timedelta

p = Path(__file__).with_name("offer-calendar.contract.json")
cfg = json.loads(p.read_text())
assert cfg["status"] == "founder_approved_schedule"
assert cfg["public_checkout_authorized"] is False
assert cfg["membership_activation_implemented"] is False
assert cfg["future_renewal_implemented"] is False
assert cfg["launch"]["application_target"] == "2027-01-01"

monthly = cfg["monthly_prepay"]
annual = cfg["annual_prepay"]
assert monthly["initial_one_time_price_cents"] == 999
assert monthly["covered_months"] == ["2027-01"]
assert monthly["bonus_free_months"] == ["2027-02"]
assert monthly["first_possible_new_paid_period"] == "2027-03"

assert annual["initial_one_time_price_cents"] == 9600
assert len(annual["covered_months"]) == len(set(annual["covered_months"])) == 12
assert annual["covered_months"][0] == "2027-01"
assert annual["covered_months"][-1] == "2028-01"
assert annual["bonus_free_months"] == ["2027-02"]
assert not set(annual["bonus_free_months"]) & set(annual["covered_months"])
assert annual["last_covered_date"] == "2028-01-31"
assert (date.fromisoformat(annual["last_covered_date"]) + timedelta(days=1)).strftime("%Y-%m") == annual["first_possible_new_paid_period"]
assert not monthly["renewal_authorized_by_one_time_prepayment"]
assert not annual["renewal_authorized_by_one_time_prepayment"]
assert cfg["new_january_customers"]["first_full_month_free"]
assert cfg["new_january_customers"]["trial_begins_on_usable_activation"]
assert not cfg["new_january_customers"]["automatic_recurring_charge_authorized_by_trial_alone"]
assert cfg["late_launch"]["exact_adjusted_start_dates"] == "UNAPPROVED"
assert cfg["late_launch"]["final_unresolved_order_resolution_date"] == "2027-01-15"
assert cfg["late_launch"]["cutoff_approval"] == "founder_approved_planning_only"
assert cfg["late_launch"]["contract_legal_review_status"] == "PENDING"
assert set(cfg["late_launch"]["resolution_choices"]) == {"usable_access_delivered", "affirmative_agreement_to_specific_extended_date", "full_refund_initiated"}
assert cfg["late_launch"]["silence_counts_as_extension_consent"] is False
assert cfg["late_launch"]["unresolved_without_extension_refund_initiation_business_days"] == 5
assert cfg["launch"]["application_target"] == "2027-01-01"
assert cfg["full_refund_reserve"]["covers_prepaid_and_new_customer_receipts"]
assert not cfg["full_refund_reserve"]["automatic_stripe_payout_means_spendable"]
assert not cfg["full_refund_reserve"]["revenue_released_to_discretionary_spend_on_purchase"]
print("PASS: prepay calendar, 12 paid annual months plus free February, and disabled billing gates")
