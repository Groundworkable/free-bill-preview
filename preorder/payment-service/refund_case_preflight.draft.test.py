"""Synthetic-only checks for the offline pre-purchase refund case preflight."""
from copy import deepcopy
from datetime import date
from pathlib import Path
import importlib.util

p=Path(__file__).with_name("refund_case_preflight.draft.py")
s=importlib.util.spec_from_file_location("review_case",p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
FLAGS={k:True for k in m._REQUIRED_EVIDENCE}
def case(term="annual"):
    offer=m._OFFERS[term]
    tax=600 if term=="annual" else 60
    order=dict(status="paid_unfulfilled",currency="usd",term=term,
       checkout_session_id="cs_test_Synthetic123",payment_intent_id="pi_Synthetic123",
       stripe_customer_id="cus_Synthetic123",stripe_price_id=offer["price"],
       payment_link_id=offer["link"],subtotal_cents=offer["base"],tax_cents=tax,
       total_cents=offer["base"]+tax,terms_version="prepurchase-v2026-12-01")
    session=dict(object="checkout.session",id=order["checkout_session_id"],
       livemode=False,mode="payment",payment_status="paid",payment_intent=order["payment_intent_id"],
       payment_link=offer["link"],customer=order["stripe_customer_id"],
       currency="usd",amount_total=order["total_cents"],amount_subtotal=offer["base"],
       total_details={"amount_tax":tax},consent={"terms_of_service":"accepted"},
       customer_details={"email":"synthetic.buyer@example.invalid"},customer_email=None)
    item=dict(price={"id":offer["price"],"type":"one_time","currency":"usd",
                     "unit_amount":offer["base"]},quantity=1,amount_subtotal=offer["base"])
    return dict(order=order,session=session,stripe_line_items=[item],
       requester_email="SYNTHETIC.BUYER@example.invalid",
       claimant_identity_verified=True,source_assertions=deepcopy(FLAGS),
       refunds=[],disputes=[],journal=[],charge_snapshots=[],
       request_date=date(2027,5,15),paid_access_start=date(2027,1,1),
       access_status_verified=True)

def output(d):return m.inspect_refund_case(**d)
def stopped(d,reason):
    r=output(d)
    assert r["classification"]=="manual_review_required",r
    assert reason in r["review_reasons"],r
    assert r["base_refund_quote_cents_excluding_tax"] is None

r=output(case())
assert r["classification"]=="base_arithmetic_for_human_review_only",r
assert r["base_refund_quote_cents_excluding_tax"]==6400
for key in ("refund_authorized","refund_executed","customer_contact_authorized","membership_modified"):
    assert r[key] is False
assert r["tax_adjustment"]=="manual_required"
monthly=case("monthly"); monthly["request_date"]=date(2027,1,6)
assert output(monthly)["base_refund_quote_cents_excluding_tax"]==999
early=case();early["paid_access_start"]=None;early["request_date"]=date(2026,12,20)
assert output(early)["base_refund_quote_cents_excluding_tax"]==9600

d=case();d["claimant_identity_verified"]=False;stopped(d,"requester_identity_not_independently_verified")
d=case();d["source_assertions"]={};stopped(d,"snapshot_provenance_or_completeness_unverified")
d=case();d["requester_email"]="stranger@example.invalid";stopped(d,"checkout_order_or_claimant_mismatch")
d=case();d["session"]["payment_intent"]="pi_wrong";stopped(d,"checkout_order_or_claimant_mismatch")
d=case();d["session"]["livemode"]=True;stopped(d,"checkout_order_or_claimant_mismatch")
d=case();d["session"]["consent"]={};stopped(d,"checkout_order_or_claimant_mismatch")
d=case();d["session"]["total_details"]["amount_tax"]=0;stopped(d,"checkout_subtotal_or_tax_mismatch")
d=case();d["stripe_line_items"][0]["quantity"]=2;stopped(d,"stripe_line_item_price_or_quantity_mismatch")
d=case();d["stripe_line_items"][0]["price"]["id"]="price_wrong";stopped(d,"stripe_line_item_price_or_quantity_mismatch")
d=case();d["order"]["tax_cents"]=-1;stopped(d,"purchase_amount_or_tax_mismatch")
d=case();d["order"]["terms_version"]="UNAPPROVED";stopped(d,"recorded_terms_version_unverified")
d=case();d["refunds"]=[dict(id="re_test",amount=200,status="pending",payment_intent="pi_Synthetic123",currency="usd",livemode=False)]
stopped(d,"prior_payment_change_requires_manual_review")
d=case();d["disputes"]=[dict(id="dp_test",amount=10200,status="needs_response",payment_intent="pi_Synthetic123",currency="usd",livemode=False)]
stopped(d,"prior_payment_change_requires_manual_review")
d=case();d["access_status_verified"]=False;stopped(d,"policy_usable_access_not_verified")
d=case();d["paid_access_start"]=date(2027,1,20);stopped(d,"policy_delayed_or_midmonth_calendar_not_approved")
d=case();d["refunds"]="not-list";stopped(d,"invalid_financial_snapshot_collection")

for secret in ("synthetic.buyer@example.invalid","pi_Synthetic123","cs_test_Synthetic123","cus_Synthetic123"):
    assert secret not in repr(r)
print("PASS: Stripe test purchase evidence, contact, reconciliation, refund arithmetic and manual holds")
