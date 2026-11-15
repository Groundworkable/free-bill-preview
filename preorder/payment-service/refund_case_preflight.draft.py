"""Offline Stripe test-mode refund preflight; NO network, D1 writes, emails or refunds.

Inputs are independently collected snapshots with CALLER-ASSERTED provenance;
assertions do not authenticate evidence, owner, or mailbox. A positive result is
a base-only arithmetic quote for human review; it never authorizes any action.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import re
from purchase_contact_check import inspect_test_purchase_contact
from refund_reconciliation import reconcile_test_snapshots

s = importlib.util.spec_from_file_location("refund_policy_quote_draft",Path(__file__).with_name("refund_policy_quote.draft.py"))
_policy = importlib.util.module_from_spec(s)
s.loader.exec_module(_policy)

_OFFERS = {
 "monthly":{"base":999,"price":"price_1UbK2YJK9stEim4wCsZ0tyao","link":"plink_1UbK33JK9stEim4w7BvY2CnM"},
 "annual":{"base":9600,"price":"price_1UbK2aJK9stEim4wgnY5LRVR","link":"plink_1UbK3MJK9stEim4w2nS3loNW"},
}
_REQUIRED_EVIDENCE = frozenset({
 "order_from_isolated_d1","session_from_authenticated_stripe_test",
 "line_items_from_authenticated_stripe_test","refunds_complete_from_stripe_test",
 "disputes_complete_from_stripe_test","journal_complete_from_isolated_d1",
 "charges_complete_from_stripe_test",
})

def _stop(*reasons):
    return dict(classification="manual_review_required",
        base_refund_quote_cents_excluding_tax=None,
        review_reasons=sorted(set(reasons)), tax_adjustment="manual_required",
        refund_authorized=False,refund_executed=False,
        customer_contact_authorized=False,membership_modified=False)

def inspect_refund_case(*,order,session,stripe_line_items,requester_email,
    claimant_identity_verified,source_assertions,refunds,disputes,journal,
    charge_snapshots,request_date,paid_access_start,access_status_verified):
    """Never returns PII/Stripe IDs or refund authorization; test snapshots only."""
    errors=[]
    asserted=(isinstance(source_assertions,dict)
      and set(source_assertions)==_REQUIRED_EVIDENCE
      and all(source_assertions[k] is True for k in _REQUIRED_EVIDENCE))
    if not asserted:errors.append("snapshot_provenance_or_completeness_unverified")
    if claimant_identity_verified is not True:errors.append("requester_identity_not_independently_verified")
    if not isinstance(order,dict) or not isinstance(session,dict):
        return _stop(*(errors+["invalid_order_or_checkout_snapshot"]))
    term=order.get("term")
    offer=_OFFERS.get(term) if isinstance(term,str) else None
    if offer is None:return _stop(*(errors+["unknown_prepaid_offer"]))
    cents=("subtotal_cents","tax_cents","total_cents")
    if any(type(order.get(k)) is not int for k in cents):
        errors.append("invalid_order_amount_fields")
    elif (order["subtotal_cents"]!=offer["base"] or order["tax_cents"]<0
      or order["total_cents"]!=order["subtotal_cents"]+order["tax_cents"]):
        errors.append("purchase_amount_or_tax_mismatch")
    if (order.get("stripe_price_id")!=offer["price"]
      or order.get("payment_link_id")!=offer["link"]):
        errors.append("offer_price_or_payment_link_mismatch")
    tv=order.get("terms_version")
    if not isinstance(tv,str) or not re.fullmatch(r"prepurchase-v\d{4}-\d{2}-\d{2}",tv):
        errors.append("recorded_terms_version_unverified")

    try:
        contact=inspect_test_purchase_contact(order,session,
            requester_email=requester_email,provider_verified=asserted)
        if not contact["evidence_consistent_for_manual_review"]:
            errors.append("checkout_order_or_claimant_mismatch")
    except (TypeError,ValueError,KeyError,AttributeError):
        errors.append("invalid_checkout_contact_evidence")

    if not isinstance(stripe_line_items,list) or len(stripe_line_items)!=1:
        errors.append("stripe_line_items_missing_or_ambiguous")
    else:
        item=stripe_line_items[0]
        price=item.get("price") if isinstance(item,dict) else None
        if (not isinstance(price,dict) or price.get("id")!=offer["price"]
          or price.get("type")!="one_time" or price.get("currency")!="usd"
          or type(price.get("unit_amount")) is not int
          or price["unit_amount"]!=offer["base"]
          or type(item.get("quantity")) is not int or item["quantity"]!=1
          or type(item.get("amount_subtotal")) is not int
          or item["amount_subtotal"]!=offer["base"]):
            errors.append("stripe_line_item_price_or_quantity_mismatch")

    details=session.get("total_details")
    if (type(session.get("amount_subtotal")) is not int
      or session["amount_subtotal"]!=offer["base"] or not isinstance(details,dict)
      or type(details.get("amount_tax")) is not int
      or details["amount_tax"]!=order.get("tax_cents")):
        errors.append("checkout_subtotal_or_tax_mismatch")

    if any(not isinstance(x,list) for x in (refunds,disputes,journal,charge_snapshots)):
        errors.append("invalid_financial_snapshot_collection")
    else:
        if refunds or disputes or journal:
            errors.append("prior_payment_change_requires_manual_review")
        try:
            result=reconcile_test_snapshots(order,refunds,disputes,journal,
                complete=asserted,charge_snapshots=charge_snapshots)
            if result["requires_manual_review"]:
                errors.append("financial_reconciliation_not_clear")
        except (TypeError,ValueError,KeyError,AttributeError):
            errors.append("invalid_financial_reconciliation")
    if errors:return _stop(*errors)

    quote=_policy.quote_prepaid_voluntary_refund(
        offer=term,request_date=request_date,paid_access_start=paid_access_start,
        status_verified=access_status_verified,purchase_base_cents=offer["base"])
    if quote.get("classification")!="draft_voluntary_policy_arithmetic":
        return _stop("policy_"+str(quote.get("reason","unverified")))
    return dict(classification="base_arithmetic_for_human_review_only",
        base_refund_quote_cents_excluding_tax=quote["baseline_usd_cents_excluding_tax"],
        review_reasons=[],tax_adjustment="manual_required",
        refund_authorized=False,refund_executed=False,
        customer_contact_authorized=False,membership_modified=False)
