/**
 * INTERNAL REVIEW CONTRACT ONLY — synthetic checks, not an email sender,
 * identity verification service, activation route, entitlement implementation,
 * or release authorization. No network, credentials, writes, actual invitations.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const draft=readFileSync(
  new URL("../../.github/internal-communications/activation-invitation-REVIEW-ONLY_2026-11-16.md",import.meta.url),
  "utf8"
);
const terms=readFileSync(
  new URL("../CUSTOMER_TERMS_RELEASE_COPY_DRAFT_2026-11-14.md",import.meta.url),"utf8"
);
const calendar=JSON.parse(readFileSync(new URL("./offer-calendar.contract.json",import.meta.url),"utf8"));
const UUID="11111111-1111-4111-8111-111111111111";

function readyForInvitation(e) {
  if(!e || typeof e!=="object" || !e.purchase || !e.identity || !e.release || !e.mail) return false;
  const p=e.purchase,i=e.identity,r=e.release,m=e.mail;
  // Evidence MUST eventually be issued by trusted services, not callers.
  return p.independentlyProviderVerified===true &&
    p.livemode===false &&
    p.status==="paid_unfulfilled" &&
    /^cs_test_[A-Za-z0-9]+$/.test(p.checkoutSessionId||"") &&
    (p.offer==="monthly"||p.offer==="annual") &&
    p.exactPriceAndTaxVerified===true &&
    p.publishedTermsVersionAccepted===true &&
    p.refundOrDisputeOpen===false &&
    i.purchaserContactIndependentlyVerified===true &&
    i.oneTimeClaimServiceSecurityReviewed===true &&
    i.singleUseClaimPrepared===true &&
    i.claimNotConsumedOrRevoked===true &&
    i.inviteRecipientAllowlistedAndVerified===true &&
    r.paidApplicationActuallyUsable===true &&
    r.purchaserCohortApproved===true &&
    r.paidFeaturesVerifiedForCohort===true &&
    r.supportAndRefundOperationsReady===true &&
    r.actualServiceCalendarApproved===true &&
    r.purchasedTimePreserved===true &&
    r.bonusFebruaryPreserved===true &&
    r.termsAndPrivacyPublished===true &&
    r.copyExplicitlyApproved===true &&
    m.transactionalSenderConfigured===true &&
    m.messageTemplatePublished===true &&
    m.deliveryAndBounceMonitoringReady===true &&
    m.operatorHasExplicitlyReleasedOneSend===true &&
    m.noAutomaticResend===true;
}

function permittedToActivateMembership(e) {
  // Do not infer entitlements from a recipient, email, URL, or dispatch.
  return readyForInvitation(e) &&
    e.identity.authenticatedAccountId===UUID &&
    e.identity.claimBoundToAuthenticatedAccount===true &&
    e.identity.atomicSingleRedemptionVerified===true &&
    e.release.accessIsUsableForVerifiedAccount===true &&
    e.release.actualPaidServiceStartRecorded===true &&
    e.release.refundWindowStartsWithUsableAccess===true &&
    e.release.noAutomaticRenewal===true;
}

const syntheticReady=()=>({
  purchase:{
    independentlyProviderVerified:true,livemode:false,status:"paid_unfulfilled",
    checkoutSessionId:"cs_test_SyntheticFounderOnly123",offer:"annual",
    exactPriceAndTaxVerified:true,publishedTermsVersionAccepted:true,
    refundOrDisputeOpen:false,
  },
  identity:{
    purchaserContactIndependentlyVerified:true,
    oneTimeClaimServiceSecurityReviewed:true,singleUseClaimPrepared:true,
    claimNotConsumedOrRevoked:true,inviteRecipientAllowlistedAndVerified:true,
    authenticatedAccountId:UUID,claimBoundToAuthenticatedAccount:true,
    atomicSingleRedemptionVerified:true,
  },
  release:{
    paidApplicationActuallyUsable:true,purchaserCohortApproved:true,
    paidFeaturesVerifiedForCohort:true,supportAndRefundOperationsReady:true,
    actualServiceCalendarApproved:true,purchasedTimePreserved:true,
    bonusFebruaryPreserved:true,termsAndPrivacyPublished:true,
    copyExplicitlyApproved:true,accessIsUsableForVerifiedAccount:true,
    actualPaidServiceStartRecorded:true,refundWindowStartsWithUsableAccess:true,
    noAutomaticRenewal:true,
  },
  mail:{
    transactionalSenderConfigured:true,messageTemplatePublished:true,
    deliveryAndBounceMonitoringReady:true,operatorHasExplicitlyReleasedOneSend:true,
    noAutomaticResend:true,
  },
});

test("invitation copy remains internal and has four and only four approved placeholders",()=>{
  assert.match(draft,/INTERNAL DRAFT ONLY — NOT APPROVED FOR SENDING/);
  assert.match(draft,/not, by itself, mean your paid membership has started/);
  assert.match(draft,/sign in or create an account/i);
  assert.match(draft,/does not authorize automatic renewal/);
  assert.match(draft,/full refund before usable paid access begins/);
  assert.match(draft,/private invitation/);
  const message=draft.split("## Proposed customer email — plain text")[1]?.split("\n---\n")[0];
  assert.ok(message);
  const placeholders=[...message.matchAll(/\{\{([^{}]+)\}\}/g)].map(m=>m[1]);
  assert.deepEqual(placeholders.sort(),[
    "OFFER_NAME","PRIVATE_ACTIVATION_URL","PURCHASE_REFERENCE","VERIFIED_ACCESS_SCHEDULE"
  ]);
  assert.equal(/https?:\/\//i.test(message),false,"No guessed activation URL in review message");
  assert.equal(message.includes("2027-01-01"),false,"Do not promise hardcoded start in invitation");
  assert.equal(message.includes("Your membership is now active"),false);
  assert.match(draft,/\*\*Not approved:\*\*/);
});

test("current published and implemented release gates remain closed",()=>{
  assert.match(terms,/Terms version:\*\* UNAPPROVED/);
  assert.match(terms,/PENDING LEGAL REVIEW; NOT EFFECTIVE/);
  assert.equal(calendar.public_checkout_authorized,false);
  assert.equal(calendar.membership_activation_implemented,false);
  assert.equal(calendar.future_renewal_implemented,false);
  assert.equal(calendar.late_launch.exact_adjusted_start_dates,"UNAPPROVED");
  const x=syntheticReady();
  x.purchase.publishedTermsVersionAccepted=false;
  x.release.copyExplicitlyApproved=false;
  x.mail.messageTemplatePublished=false;
  x.mail.operatorHasExplicitlyReleasedOneSend=false;
  assert.equal(readyForInvitation(x),false);
  assert.equal(permittedToActivateMembership(x),false);
});

test("missing or incorrect financial identity evidence cannot prepare an invitation",()=>{
  const x=syntheticReady();
  for (const [field,value] of [
    ["independentlyProviderVerified",false],["livemode",true],
    ["status","unpaid"],["checkoutSessionId","cs_live_bad"],
    ["offer","lite"],["exactPriceAndTaxVerified",false],
    ["publishedTermsVersionAccepted",false],["refundOrDisputeOpen",true],
  ]) assert.equal(readyForInvitation({...x,purchase:{...x.purchase,[field]:value}}),false,field);
  for (const [field,value] of [
    ["purchaserContactIndependentlyVerified",false],
    ["oneTimeClaimServiceSecurityReviewed",false],
    ["singleUseClaimPrepared",false],
    ["claimNotConsumedOrRevoked",false],
    ["inviteRecipientAllowlistedAndVerified",false],
  ]) assert.equal(readyForInvitation({...x,identity:{...x.identity,[field]:value}}),false,field);
  assert.equal(readyForInvitation(x),true,"Only synthetic complete prerequisites can pass");
});

test("unusable app, unapproved calendar, unpublished legal terms and missing support all block invitation",()=>{
  const x=syntheticReady();
  for(const key of [
    "paidApplicationActuallyUsable","purchaserCohortApproved",
    "paidFeaturesVerifiedForCohort","supportAndRefundOperationsReady",
    "actualServiceCalendarApproved","purchasedTimePreserved",
    "bonusFebruaryPreserved","termsAndPrivacyPublished","copyExplicitlyApproved",
  ]) assert.equal(readyForInvitation({...x,release:{...x.release,[key]:false}}),false,key);
});

test("unpublished Resend template or missing operator send approval remains closed",()=>{
  const x=syntheticReady();
  for(const key of [
    "transactionalSenderConfigured","messageTemplatePublished",
    "deliveryAndBounceMonitoringReady","operatorHasExplicitlyReleasedOneSend",
    "noAutomaticResend",
  ]) assert.equal(readyForInvitation({...x,mail:{...x.mail,[key]:false}}),false,key);
  assert.equal(readyForInvitation({}),false);
  assert.equal(readyForInvitation(null),false);
});

test("invitation eligibility NEVER substitutes for bound account or usable paid activation",()=>{
  const x=syntheticReady();
  assert.equal(readyForInvitation(x),true);
  for(const [field,value] of [
    ["authenticatedAccountId","22222222-2222-4222-8222-222222222222"],
    ["claimBoundToAuthenticatedAccount",false],
    ["atomicSingleRedemptionVerified",false],
  ]) assert.equal(permittedToActivateMembership({...x,identity:{...x.identity,[field]:value}}),false,field);
  for(const key of [
    "accessIsUsableForVerifiedAccount","actualPaidServiceStartRecorded",
    "refundWindowStartsWithUsableAccess","noAutomaticRenewal",
  ]) assert.equal(permittedToActivateMembership({...x,release:{...x.release,[key]:false}}),false,key);
  const original=JSON.stringify(x);
  assert.equal(permittedToActivateMembership(x),true); // hypothetical fully validated test vector ONLY
  assert.equal(JSON.stringify(x),original,"policy oracle performs no mutation");
});

test("invitation code cannot insert payments, send emails, or construct links",()=>{
  assert.equal(typeof readyForInvitation(syntheticReady()),"boolean");
  assert.equal(typeof permittedToActivateMembership(syntheticReady()),"boolean");
  assert.equal(draft.includes("{{PRIVATE_ACTIVATION_URL}}"),true);
  assert.equal(draft.includes("https://app.groundworkbyable.online/auth?mode=invite"),false);
  assert.equal(calendar.monthly_prepay.renewal_authorized_by_one_time_prepayment,false);
  assert.equal(calendar.annual_prepay.renewal_authorized_by_one_time_prepayment,false);
});
