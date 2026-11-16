/**
 * EXECUTABLE DESIGN CONTRACT ONLY — no exported production implementation.
 * Groundwork's purchaser-email invitation approach was founder-approved;
 * exact claim/entitlement operations, data retention, delayed month arithmetic,
 * published Terms, and live payment release are NOT approved or implemented.
 *
 * This file uses synthetic evidence exclusively and asserts fail-closed
 * invariants for the future separately authorized trusted backend.
 * These tests DO NOT validate security, atomicity, RLS or a running app.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const calendar=JSON.parse(readFileSync(new URL("./offer-calendar.contract.json", import.meta.url),"utf8"));
const UUID="11111111-1111-4111-8111-111111111111";
const OTHER_UUID="22222222-2222-4222-8222-222222222222";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hasOwn=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);

// This is a POLICY ORACLE, not a server and not an authorization decision.
// All evidence fields must later be derived by a trusted, authenticated service.
function mayProposePurchaseClaim({purchase,session,claim}={}) {
  if(!purchase||!session||!claim) return false;
  return purchase.verifiedByProvider===true &&
    purchase.livemode===false &&
    /^cs_test_[A-Za-z0-9]+$/.test(purchase.checkoutSessionId||"") &&
    purchase.status==="paid_unfulfilled" &&
    purchase.termsConsent==="accepted" &&
    purchase.termsVersionApproved===true &&
    purchase.refundOrDisputeOpen===false &&
    (purchase.offer==="monthly"||purchase.offer==="annual") &&
    session.verifiedServerSide===true &&
    session.validSession===true &&
    UUID_RE.test(session.userId||"") &&
    session.mfaPolicySatisfied===true &&
    claim.orderRef===purchase.checkoutSessionId &&
    claim.customerContactIndependentlyVerified===true &&
    claim.mailboxControlIndependentlyVerified===true &&
    claim.claimSecretVerifiedOnServer===true &&
    claim.claimIssuedToCorrectPurchaser===true &&
    claim.expired===false &&
    claim.revoked===false &&
    claim.consumed===false &&
    claim.purchaseAlreadyBound===false &&
    (!hasOwn(claim,"previouslyBoundUserId") || claim.previouslyBoundUserId===null);
}
const baseClaim=()=>({
  purchase:{
    verifiedByProvider:true,livemode:false,
    checkoutSessionId:"cs_test_ProposedClaim001",
    status:"paid_unfulfilled",termsConsent:"accepted",
    termsVersionApproved:true,refundOrDisputeOpen:false,offer:"monthly",
  },
  session:{verifiedServerSide:true,validSession:true,userId:UUID,mfaPolicySatisfied:true},
  claim:{
    orderRef:"cs_test_ProposedClaim001",
    customerContactIndependentlyVerified:true,
    mailboxControlIndependentlyVerified:true,
    claimSecretVerifiedOnServer:true,
    claimIssuedToCorrectPurchaser:true,
    expired:false,revoked:false,consumed:false,purchaseAlreadyBound:false,
    previouslyBoundUserId:null,
  },
});

function mayProposePaidServiceStart({purchase,claim,session,readiness,calendarGate}={}) {
  if(!purchase||!claim||!session||!readiness||!calendarGate) return false;
  return mayProposePurchaseClaim({purchase,session,
    claim:{...claim,consumed:false,purchaseAlreadyBound:false,previouslyBoundUserId:null}}) &&
    claim.claimRecordedByTrustedBackend===true &&
    claim.boundUserId===session.userId &&
    purchase.refundOrDisputeOpen===false &&
    readiness.paidFeatureSetVerifiedUsable===true &&
    readiness.accountCanActuallyUsePaidFeatures===true &&
    readiness.cohortReleased===true &&
    readiness.supportOperational===true &&
    calendarGate.legalPublicationApproved===true &&
    calendarGate.deliveryCalendarApproved===true &&
    calendarGate.actualUsableStartVerified===true &&
    calendarGate.prepaidMonthsFullyPreserved===true &&
    calendarGate.februaryBonusPreserved===true &&
    calendarGate.autoRenewalAuthorized===false;
}
const baseStart=()=>{
  const {purchase,session,claim}=baseClaim();
  return {
    purchase,session,
    claim:{...claim,claimRecordedByTrustedBackend:true,boundUserId:UUID},
    readiness:{
      paidFeatureSetVerifiedUsable:true,accountCanActuallyUsePaidFeatures:true,
      cohortReleased:true,supportOperational:true,
    },
    calendarGate:{
      legalPublicationApproved:true,deliveryCalendarApproved:true,
      actualUsableStartVerified:true,prepaidMonthsFullyPreserved:true,
      februaryBonusPreserved:true,autoRenewalAuthorized:false,
    },
  };
};

test("current release is explicitly NOT eligible for automated claim or paid activation",()=>{
  const current=baseStart();
  current.purchase.termsVersionApproved=false; // unpublished terms
  current.readiness.cohortReleased=false;        // paid app release not attested
  current.calendarGate.legalPublicationApproved=false;
  current.calendarGate.deliveryCalendarApproved=false;
  current.calendarGate.actualUsableStartVerified=false;
  assert.equal(mayProposePurchaseClaim(current),false);
  assert.equal(mayProposePaidServiceStart(current),false);
  assert.equal(calendar.public_checkout_authorized,false);
  assert.equal(calendar.membership_activation_implemented,false);
  assert.equal(calendar.future_renewal_implemented,false);
  assert.equal(calendar.late_launch.exact_adjusted_start_dates,"UNAPPROVED");
});

test("email equality, app login, Stripe receipt, and invitation receipt alone cannot claim",()=>{
  const x=baseClaim();
  for(const patch of [
    {customerContactIndependentlyVerified:false},
    {mailboxControlIndependentlyVerified:false},
    {claimSecretVerifiedOnServer:false},
    {claimIssuedToCorrectPurchaser:false},
    {expired:true},{revoked:true},{consumed:true},
    {purchaseAlreadyBound:true},{previouslyBoundUserId:OTHER_UUID},
  ]) assert.equal(mayProposePurchaseClaim({...x,claim:{...x.claim,...patch}}),false);
  assert.equal(mayProposePurchaseClaim({...x,claim:{...x.claim,orderRef:"cs_test_OTHER"}}),false);
  assert.equal(mayProposePurchaseClaim({...x,session:{...x.session,verifiedServerSide:false}}),false);
  assert.equal(mayProposePurchaseClaim({...x,session:{...x.session,validSession:false}}),false);
  assert.equal(mayProposePurchaseClaim({...x,session:{...x.session,mfaPolicySatisfied:false}}),false);
  assert.equal(mayProposePurchaseClaim({...x,session:{...x.session,userId:"user@example.invalid"}}),false);
});

test("provider evidence, one-time consent, refund/dispute state, and offer must all match",()=>{
  const x=baseClaim();
  for(const patch of [
    {verifiedByProvider:false},{livemode:true},
    {checkoutSessionId:"cs_live_123"},
    {status:"unpaid"},{status:"active_membership"},
    {termsConsent:"not_accepted"},
    {termsVersionApproved:false},{refundOrDisputeOpen:true},
    {offer:"advanced"},{offer:"founding_reservation"},
    {offer:"organization"},{offer:"lite"},
  ]) assert.equal(mayProposePurchaseClaim({...x,purchase:{...x.purchase,...patch}}),false);
  assert.equal(mayProposePurchaseClaim(baseClaim()),true);
});

test("a validated claim still does NOT start membership without independent readiness",()=>{
  const x=baseStart();
  for(const patch of [
    {paidFeatureSetVerifiedUsable:false},
    {accountCanActuallyUsePaidFeatures:false},
    {cohortReleased:false},
    {supportOperational:false},
  ]) assert.equal(mayProposePaidServiceStart({...x,readiness:{...x.readiness,...patch}}),false);
  assert.equal(mayProposePaidServiceStart({...x,claim:{...x.claim,boundUserId:OTHER_UUID}}),false);
  assert.equal(mayProposePaidServiceStart({...x,claim:{...x.claim,claimRecordedByTrustedBackend:false}}),false);
  assert.equal(mayProposePaidServiceStart({...x,purchase:{...x.purchase,refundOrDisputeOpen:true}}),false);
});

test("invitation sent, clicked, or claimed cannot substitute for actually usable service",()=>{
  const x=baseStart();
  // Sending an invitation does not provide a usable paid product.
  for(const patch of [
    {legalPublicationApproved:false},
    {deliveryCalendarApproved:false},
    {actualUsableStartVerified:false},
    {prepaidMonthsFullyPreserved:false},
    {februaryBonusPreserved:false},
    {autoRenewalAuthorized:true},
  ]) assert.equal(mayProposePaidServiceStart({...x,calendarGate:{...x.calendarGate,...patch}}),false);
  assert.equal(mayProposePaidServiceStart(x),true); // proposal eligibility, NOT an activation
});

test("approved calendar keeps 12 annual paid months plus complimentary February without renewal",()=>{
  const month=calendar.monthly_prepay;
  const year=calendar.annual_prepay;
  assert.equal(month.initial_one_time_price_cents,999);
  assert.equal(year.initial_one_time_price_cents,9600);
  assert.deepEqual(month.covered_months,["2027-01"]);
  assert.deepEqual(month.bonus_free_months,["2027-02"]);
  assert.equal(year.covered_months.length,12);
  assert.equal(new Set(year.covered_months).size,12);
  assert.ok(!year.covered_months.includes("2027-02"));
  assert.deepEqual(year.bonus_free_months,["2027-02"]);
  assert.equal(year.last_covered_date,"2028-01-31");
  assert.equal(month.renewal_authorized_by_one_time_prepayment,false);
  assert.equal(year.renewal_authorized_by_one_time_prepayment,false);
  // A late start requires a separate founder-approved calendar, not invented dates.
  assert.equal(calendar.late_launch.exact_adjusted_start_dates,"UNAPPROVED");
});

test("policy oracle owns no side effects, claim tokens, email sending or entitlement writes",()=>{
  const x=baseStart();
  const before=JSON.stringify(x);
  const decision=mayProposePaidServiceStart(x);
  assert.equal(decision,true);
  assert.equal(JSON.stringify(x),before);
  assert.equal(typeof decision,"boolean");
  assert.deepEqual(Object.keys(x).sort(),["calendarGate","claim","purchase","readiness","session"].sort());
  assert.equal("recipientEmail" in x.claim,false);
  assert.equal("rawInvitationSecret" in x.claim,false);
  assert.equal("issuedEntitlement" in x.claim,false);
});
