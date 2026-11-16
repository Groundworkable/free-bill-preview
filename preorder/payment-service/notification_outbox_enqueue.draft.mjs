/**
 * DRAFT ONLY — build an isolated founder TEST purchase-confirmation outbox entry.
 * This does not send, review, approve, insert records, or grant membership.
 * Call only after authenticated Stripe TEST webhook + independent line-item
 * verification. No plaintext customer contact is returned or written to D1.
 */
const enc=new TextEncoder();
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SESSION=/^cs_test_[a-zA-Z0-9]+$/;
function email(value) {
  if(typeof value!=="string" || value.length>254) return null;
  const normalized=value.trim().toLowerCase();
  return EMAIL.test(normalized)?normalized:null;
}
async function hmac(secret,input) {
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=new Uint8Array(await crypto.subtle.sign(
    "HMAC",key,enc.encode(input)));
  return Array.from(signature,x=>x.toString(16).padStart(2,"0")).join("");
}
export async function prepareFounderTestPurchaseOutbox(env,session,verifiedOrder) {
  // Missing explicit release is a genuine NOOP; all existing receiver behavior
  // remains unchanged when this draft-only gate has not been enabled.
  if(env?.FOUNDER_NOTIFICATION_OUTBOX_MODE!=="sandbox_founder_only") return null;
  if(env.PAYMENTS_MODE!=="sandbox" || env.TERMS_APPROVED!=="true" ||
     !/^prepurchase-v\d{4}-\d{2}-\d{2}$/.test(env.TERMS_VERSION||"") ||
     !env.STRIPE_TEST_SECRET_KEY?.startsWith("sk_test_") ||
     env.NOTIFICATION_SEND_MODE==="sandbox_founder_test" ||
     env.FOUNDER_NOTIFICATION_DISPATCH_ENABLED==="true" ||
     env.NOTIFICATION_OPERATOR_RELEASE==="true" ||
     !SESSION.test(verifiedOrder?.id||"") ||
     verifiedOrder?.id!==session?.id || verifiedOrder?.status!=="paid_unfulfilled" ||
     session?.livemode!==false || session?.payment_status!=="paid" ||
     session?.consent?.terms_of_service!=="accepted" ||
     !SESSION.test(session?.id||"") ||
     typeof env.NOTIFICATION_RECIPIENT_HMAC_SECRET!=="string" ||
     env.NOTIFICATION_RECIPIENT_HMAC_SECRET.length<32) {
    throw new Error("Founder-only test outbox preflight failed");
  }
  const detail=email(session.customer_details?.email);
  const supplied=email(session.customer_email);
  const allowlisted=email(env.NOTIFICATION_TEST_RECIPIENT);
  if(!allowlisted || (detail&&supplied&&detail!==supplied) ||
     (detail||supplied)!==allowlisted) {
    throw new Error("Stripe TEST recipient is not the allowlisted founder");
  }
  const secret=env.NOTIFICATION_RECIPIENT_HMAC_SECRET;
  const reference="purchase";
  const notificationKey="gwn1_"+await hmac(secret,
    "groundwork-outbox-key-v1:"+session.id+":purchase_confirmation:"+reference);
  return Object.freeze({
    notificationKey,checkoutSessionId:verifiedOrder.id,
    noticeType:"purchase_confirmation",noticeRef:reference,
    recipientHmac:await hmac(secret,allowlisted),
    templateAlias:"groundwork-prepurchase-confirmation-review",
  });
}
