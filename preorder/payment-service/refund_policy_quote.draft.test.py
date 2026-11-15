"""Synthetic, offline-only assertions of the approved prepay refund base arithmetic."""
import importlib.util
from datetime import date
from pathlib import Path

path = Path(__file__).with_name("refund_policy_quote.draft.py")
spec = importlib.util.spec_from_file_location("refund_quote", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def quote(offer, when, started=date(2027, 1, 1), verified=True):
    return module.quote_prepaid_voluntary_refund(
        offer=offer,
        request_date=date.fromisoformat(when),
        paid_access_start=started,
        status_verified=verified,
        purchase_base_cents={"monthly": 999, "annual": 9600}[offer],
    )


# Verified not delivered: full pre-activation refund, December preview doesn't count.
assert quote("monthly", "2026-12-20", started=None)["baseline_usd_cents_excluding_tax"] == 999
assert quote("annual", "2027-01-15", started=None)["baseline_usd_cents_excluding_tax"] == 9600

# Seven calendar dates starting from usable purchased access on Jan 1.
for day in range(1, 8):
    when = date(2027, 1, day).isoformat()
    assert quote("monthly", when)["baseline_usd_cents_excluding_tax"] == 999
    assert quote("annual", when)["baseline_usd_cents_excluding_tax"] == 9600
assert quote("monthly", "2027-01-08")["baseline_usd_cents_excluding_tax"] == 0

# Unused complete annual PAID months only; February bonus excluded.
assert quote("annual", "2027-01-08")["baseline_usd_cents_excluding_tax"] == 8800
assert quote("annual", "2027-02-15")["baseline_usd_cents_excluding_tax"] == 8800
assert quote("annual", "2027-05-15")["baseline_usd_cents_excluding_tax"] == 6400
assert quote("annual", "2028-01-15")["baseline_usd_cents_excluding_tax"] == 0
assert quote("annual", "2028-02-01")["baseline_usd_cents_excluding_tax"] == 0

# Unsupported start dates, conflicting chronology, wrong status, invalid amount: STOP.
for case in (
    quote("annual", "2027-01-20", started=date(2027, 1, 20)),
    quote("monthly", "2027-01-01", verified=False),
    quote("annual", "2026-12-31", started=date(2027, 1, 1)),
    module.quote_prepaid_voluntary_refund(
        offer="annual", request_date=date(2027, 1, 15),
        paid_access_start=None, status_verified=True, purchase_base_cents=1),
    module.quote_prepaid_voluntary_refund(
        offer="monthly", request_date=date(2027, 1, 1),
        paid_access_start=date(2027, 1, 1), status_verified=True,
        purchase_base_cents=999.0),
):
    assert case["classification"] == "manual_review"
    assert case["baseline_usd_cents_excluding_tax"] is None

for case in (quote("annual", "2027-05-15"),
             quote("monthly", "2026-11-30", started=None)):
    assert not case["refund_authorized"]
    assert not case["refund_executed"]
    assert not case["account_access_modified"]
    assert case["tax_adjustment"] == "manual_required"

print("PASS: synthetic monthly/annual policy arithmetic, free-month exclusion and fail-closed exceptions")
