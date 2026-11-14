import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker from './worker.mjs';

const secret='whsec_fake_journal_test';
const fields=['event_id','event_type','object_id','charge_id','payment_intent_id','amount_cents','currency','financial_status'];
function harness(){
 const rows=new Map(); let fail=false;
 const env={PAYMENTS_MODE:'sandbox',TERMS_APPROVED:'true',TERMS_VERSION:'prepurchase-v2026-11-13',STRIPE_WEBHOOK_SECRET:secret,STRIPE_TEST_SECRET_KEY:'sk_test_fake',MONTH_LINK_ID:'plink_fake',MONTH_PRICE_ID:'price_fake',ANNUAL_LINK_ID:'plink_other',ANNUAL_PRICE_ID:'price_other',DB:{prepare(sql){
   assert.match(sql,/prepurchase_payment_changes/);assert.doesNotMatch(sql,/UPDATE|DELETE|prepurchase_orders/);
   return {bind(...values){return {async run(){if(fail){fail=false;throw Error('storage unavailable');}if(!rows.has(values[0]))rows.set(values[0],Object.fromEntries(fields.map((f,i)=>[f,values[i]])));},async first(){return rows.get(values[0])??null;}}}};
 }}};
 return {rows,env,failNext(){fail=true;}};
}
function event(id='evt_fake',type='refund.created',extra={}){
 const dispute=type.startsWith('charge.dispute.');
 return {id,livemode:false,type,data:{object:{object:dispute?'dispute':'refund',id:dispute?'dp_fake':'re_fake',charge:'ch_fake',payment_intent:'pi_unmatched',amount:999,currency:'usd',status:dispute?'needs_response':'pending',...extra}}};
}
async function send(h,e,{signature=true}={}){
 const body=JSON.stringify(e),t=Math.floor(Date.now()/1000);
 const digest=createHmac('sha256',secret).update(t+'.'+body).digest('hex');
 return worker.fetch(new Request('https://example.invalid/webhooks/stripe',{method:'POST',body,headers:signature?{'stripe-signature':`t=${t},v1=${digest}`}:{}}),h.env);
}
test('retains unmatched notifications and deduplicates delivery',async()=>{
 const h=harness();assert.equal((await send(h,event())).status,200);assert.equal((await send(h,event())).status,200);assert.equal(h.rows.size,1);assert.equal(h.rows.get('evt_fake').financial_status,'pending');
});
test('out-of-order statuses remain separate; failed refunds are retained',async()=>{
 const h=harness();
 for(const e of [event('evt_done','refund.updated',{status:'succeeded'}),event('evt_early'),event('evt_failed','refund.failed',{status:'failed'})])assert.equal((await send(h,e)).status,200);
 assert.deepEqual([...h.rows.values()].map(r=>r.financial_status),['succeeded','pending','failed']);
});
test('dispute create update close recorded without touching orders',async()=>{
 const h=harness();for(const [i,status] of ['needs_response','under_review','lost'].entries())assert.equal((await send(h,event('evt_dp'+i,['charge.dispute.created','charge.dispute.updated','charge.dispute.closed'][i],{status}))).status,200);assert.equal(h.rows.size,3);
});
test('storage failure is retryable and conflicting duplicate is rejected',async()=>{
 const h=harness();h.failNext();assert.equal((await send(h,event())).status,503);assert.equal(h.rows.size,0);assert.equal((await send(h,event())).status,200);assert.equal((await send(h,event('evt_fake','refund.created',{amount:500}))).status,503);assert.equal(h.rows.get('evt_fake').amount_cents,999);
});
test('invalid signature environment object references amounts and statuses never write',async()=>{
 const h=harness();assert.equal((await send(h,event(),{signature:false})).status,400);
 assert.equal((await send(h,{...event(),livemode:true})).status,400);
 for(const extra of [{amount:-1},{amount:1.5},{currency:'eur'},{object:'charge'},{status:'unknown'},{livemode:true},{charge:null,payment_intent:null},{charge:{id:'ch_fake'}},{payment_intent:'bad'}])assert.equal((await send(h,event('evt_bad','refund.created',extra))).status,503);
 assert.equal(h.rows.size,0);
});
