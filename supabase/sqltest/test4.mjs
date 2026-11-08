// Round-4 assertions (S1, N1 column/index, N3 cast_paid_vote, S2 pending checkouts, S3 dispute won).
// Run: node test4.mjs   (MIG_DIR defaults to ../migrations; FIRST_DRAFT optional path, else read with git show)
import {build,dir,NEW} from './apply.mjs'; import fs from 'fs';
const out=[]; const log=(...a)=>{const s=a.join(' ');console.log(s);out.push(s)};
const {db}=await build(()=>{});
const sql=fs.readFileSync(dir+'/'+NEW,'utf8');
// the FIRST DRAFT of the migration (commit 6b53e72: status DEFAULT 'processing', no disputed_cents), run
// on the old schema to reproduce a database that applied it before the later fixes
import {execSync} from 'child_process';
const firstDraft=process.env.FIRST_DRAFT?fs.readFileSync(process.env.FIRST_DRAFT,'utf8')
  :execSync('git show 6b53e72:supabase/migrations/20261107_money_fixes_833.sql',{cwd:new URL('.',import.meta.url).pathname,encoding:'utf8',maxBuffer:1<<26});
const results=[];
const A=(name,ok,detail='')=>{results.push({name,ok,detail});log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ['+detail+']':''}`)};
const q=async(s,p)=>(await db.query(s,p)).rows;
const one=async(s,p)=>(await q(s,p))[0];
const asRole=async(role,fn)=>{await db.exec(`SET ROLE ${role}`);try{return await fn()}finally{await db.exec('RESET ROLE')}};
const throws=async(fn)=>{try{await fn();return null}catch(e){return e.message}};
const svc=async(fn)=>{await db.exec('SET ROLE service_role');try{return await fn()}finally{await db.exec('RESET ROLE')}};

// ===== S1: a DB that ran the FIRST DRAFT of the migration =====
try{await db.exec(firstDraft);A('S1: first-draft migration applies on the old schema',true)}catch(e){A('S1: first-draft migration applies on the old schema',false,e.message)}
{
  const d=await one("select column_default d from information_schema.columns where table_name='stripe_events' and column_name='status'");
  A('S1: precondition - first draft left default \'processing\' on stripe_events',/processing/.test(d.d),d.d);
  // the old webhook (bare {id,type} insert) running while the first-draft default was live
  await db.exec("insert into stripe_events(id,type) values('evt_bare_old','x')");
  await db.exec("insert into iap_events(event_id,user_id,type,product_id) values('iap_bare_old',(select gen_random_uuid()),'x','p')").catch(()=>{});
  const b=await one("select status,lease_until,attempts from stripe_events where id='evt_bare_old'");
  A('S1: precondition - bare old-code row is \'processing\', no lease, attempts 0',b.status==='processing'&&b.lease_until===null&&b.attempts===0,JSON.stringify(b));
  // a legitimate in-flight claim made by the new code (must NOT be touched)
  await svc(()=>db.query("select claim_stripe_event('evt_inflight','t',600)"));
}
try{await db.exec(sql);A('S1: round-4 migration applies on the first-draft DB (1st run)',true)}catch(e){A('S1: round-4 migration applies on the first-draft DB (1st run)',false,e.message)}
try{await db.exec(sql);A('S1: round-4 migration applies on the first-draft DB (2nd run, idempotent)',true)}catch(e){A('S1: round-4 migration applies on the first-draft DB (2nd run, idempotent)',false,e.message)}
{
  const ds=await q("select table_name t, column_default d from information_schema.columns where column_name='status' and table_name in ('stripe_events','iap_events') order by 1");
  A("S1: both defaults are 'completed' after re-run",ds.length===2&&ds.every(r=>/completed/.test(r.d)),JSON.stringify(ds));
  await db.exec("insert into stripe_events(id,type) values('evt_bare_new','x')");
  const nb=await one("select status from stripe_events where id='evt_bare_new'");
  A("S1: a bare old-code insert now lands as 'completed'",nb.status==='completed',nb.status);
  const rep=await one("select status from stripe_events where id='evt_bare_old'");
  const cl=(await svc(()=>one("select claim_stripe_event('evt_bare_old','x',120) r"))).r;
  A("S1: the bare row written under the first-draft default is repaired to 'completed' (claim -> duplicate, no re-fulfil)",rep.status==='completed'&&cl==='duplicate',`${rep.status},${cl}`);
  const inf=await one("select status,attempts from stripe_events where id='evt_inflight'");
  A("S1: a genuine in-flight claim (attempts 1, lease) is left 'processing'",inf.status==='processing'&&inf.attempts===1,JSON.stringify(inf));
  const ck=await q("select conname, convalidated from pg_constraint where conrelid='public.pro_revenue_ledger'::regclass and conname='pro_revenue_ledger_disputed_cents_check'");
  A('S1: disputed_cents CHECK exists exactly once after two runs, validated',ck.length===1&&ck[0].convalidated,JSON.stringify(ck));
  const U0='00000000-0000-0000-0000-0000000000d0';
  await db.query("insert into auth.users(id,email) values($1,'d0@x')",[U0]); await db.query("insert into profiles(id,username) values($1,'d0') on conflict (id) do nothing",[U0]);
  const neg=await throws(()=>db.query("insert into pro_revenue_ledger(stripe_invoice_id,amount_cents,disputed_cents,paid_at,month) values('in_neg',100,-1,now(),'2026-11')"));
  A('S1: disputed_cents < 0 is rejected',/check constraint/.test(neg||''),neg);
}

// ===== N1: stripe_payment_intent_id column + partial unique index =====
{
  await db.exec("insert into pro_revenue_ledger(stripe_invoice_id,amount_cents,paid_at,month) values('in_p1',100,now(),'2026-11'),('in_p2',100,now(),'2026-11')");
  A('N1: many ledger rows may have no payment intent (partial unique)',true);
  await db.exec("update pro_revenue_ledger set stripe_payment_intent_id='pi_1' where stripe_invoice_id='in_p1'");
  const dup=await throws(()=>db.exec("update pro_revenue_ledger set stripe_payment_intent_id='pi_1' where stripe_invoice_id='in_p2'"));
  A('N1: the same payment intent on two invoices is rejected',/unique/.test(dup||''),dup);
  const hit=await q("update pro_revenue_ledger set refunded_cents=50 where stripe_payment_intent_id='pi_1' returning stripe_invoice_id");
  A('N1: a ledger row is found by payment intent',hit.length===1&&hit[0].stripe_invoice_id==='in_p1');
}

// ===== fixtures for N3 / S2 / S3 =====
const U=['00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000e3'];
for(const [i,u] of U.entries()){
  await db.query("insert into auth.users(id,email) values($1,$2)",[u,`r4u${i}@x.test`]);
  await db.query("insert into public.profiles(id,username,display_name) values($1,$2,$2) on conflict (id) do nothing",[u,`r4user${i}`]);
}
const [V,CR,B]=U; // voter, creator, buyer

// ===== N3: cast_paid_vote =====
{
  const ch=(await one("insert into creator_challenges(title,start_date,end_date,voting_type,token_vote_cost,status) values('c',current_date,current_date,'token',5,'voting') returning id")).id;
  const ent=(await one("insert into challenge_entries(challenge_id,creator_id,title,status) values($1,$2,'e','approved') returning id",[ch,CR])).id;
  const ent2=(await one("insert into challenge_entries(challenge_id,creator_id,title,status) values($1,$2,'e2','approved') returning id",[ch,B])).id;
  await svc(()=>db.query("select * from record_token_movement($1,'purchase',100)",[V]));
  const bal=async()=>(await one("select balance b from hapi_tokens where user_id=$1",[V])).b;
  const r1=(await svc(()=>one("select cast_paid_vote($1,$2,$3,5) r",[V,ch,ent]))).r;
  const r2=(await svc(()=>one("select cast_paid_vote($1,$2,$3,5) r",[V,ch,ent]))).r;
  const votes=(await one("select count(*)::int n from challenge_votes where voter_id=$1 and entry_id=$2",[V,ent])).n;
  const led=(await one("select count(*)::int n from token_ledger where user_id=$1 and type='challenge_vote'",[V])).n;
  A('N3: same vote twice -> one vote row, ONE debit (100 -> 95), second call is a duplicate',r1.status==='voted'&&r2.status==='duplicate'&&votes===1&&led===1&&(await bal())===95,`${r1.status},${r2.status} votes=${votes} ledger=${led} balance=${await bal()}`);
  const cnt=await one("select vote_count v, token_vote_total t from challenge_entries where id=$1",[ent]);
  A('N3: vote trigger counted it once',cnt.v===1&&cnt.t===5,JSON.stringify(cnt));
  // insufficient balance: vote must roll back with the failed debit
  await svc(()=>db.query("select * from record_token_movement($1,'gift_sent',-93)",[V])); // leaves 2
  const e=await throws(()=>svc(()=>db.query("select cast_paid_vote($1,$2,$3,5)",[V,ch,ent2])));
  const v2=(await one("select count(*)::int n from challenge_votes where voter_id=$1 and entry_id=$2",[V,ent2])).n;
  A('N3: insufficient balance -> INSUFFICIENT_BALANCE, no vote row left behind, balance untouched',/INSUFFICIENT_BALANCE/.test(e||'')&&v2===0&&(await bal())===2,`${e} votes=${v2} balance=${await bal()}`);
  const own=await throws(()=>svc(()=>db.query("select cast_paid_vote($1,$2,$3,5)",[CR,ch,ent])));
  A('N3: voting on your own entry is refused',/ENTRY_NOT_VOTABLE/.test(own||''),own);
  await db.exec("update creator_challenges set status='judging' where id='"+ch+"'");
  const closed=await throws(()=>svc(()=>db.query("select cast_paid_vote($1,$2,$3,5)",[V,ch,ent2])));
  A('N3: voting after the voting phase is refused',/ENTRY_NOT_VOTABLE/.test(closed||''),closed);
  const zero=await throws(()=>svc(()=>db.query("select cast_paid_vote($1,$2,$3,0)",[V,ch,ent2])));
  A('N3: zero cost is refused',/cost must be positive/.test(zero||''),zero);
  const pr=[];
  for(const r of ['anon','authenticated']){const x=await asRole(r,()=>throws(()=>db.query("select cast_paid_vote($1,$2,$3,5)",[V,ch,ent2])));if(!/permission denied/.test(x||''))pr.push(r+':'+x)}
  A('N3: anon / authenticated cannot call cast_paid_vote',pr.length===0,pr.join('; '));
}

// ===== S3: dispute won =====
{
  const buy=async(key,u,n)=>svc(()=>db.query("select credit_tokens_once($1,$2,'purchase',$3,'buy','{}'::jsonb)",[key,u,n]));
  const rev=async(key,u,src,tok)=>(await svc(()=>one("select reverse_tokens_for_payment($1,$2,1000,$3,$4,'t','{}'::jsonb) r",[key,u,src,tok]))).r;
  const won=async(key)=>(await svc(()=>one("select dispute_won_for_payment($1,'dp_1') r",[key]))).r;
  const K='stripe:pi:pi_w1:token-reversal';
  await buy('k_buy_w1',CR,1000);
  await rev(K,CR,'dispute',1000);
  const before=await one("select dispute_tokens d, reversed r from token_reversals where effect_key=$1",[K]);
  const w1=await won(K), w2=await won(K);
  const after=await one("select dispute_tokens d, reversed r from token_reversals where effect_key=$1",[K]);
  const ex=await q("select kind,amount::int a,resolved_at from money_exceptions where dedupe_key=$1",['dispute-won:'+K]);
  const bal=(await one("select balance b from hapi_tokens where user_id=$1",[CR])).b;
  A('S3: dispute won -> dispute_tokens lowered to 0 (1000 -> 0), tokens NOT re-credited (balance stays 0)',before.d===1000&&after.d===0&&after.r===1000&&bal===0,JSON.stringify({before,after,bal}));
  A("S3: a 'dispute_won_review' exception row is written (amount 1000), once, even when the event replays",w1.review===true&&w2.review===true&&ex.length===1&&ex[0].kind==='dispute_won_review'&&ex[0].a===1000&&ex[0].resolved_at===null,JSON.stringify(ex));
  const none=await won('stripe:pi:pi_unknown:token-reversal');
  A('S3: dispute won on a payment with no token reversal is a harmless no-op',none.found===false&&none.review===false,JSON.stringify(none));
  // nothing was clawed back (reversed 0) -> no review row
  const K2='stripe:pi:pi_w2:token-reversal';
  await buy('k_buy_w2',B,1000);
  await svc(()=>db.query("select * from record_token_movement($1,'gift_sent',-1000)",[B])); // spent everything first
  await rev(K2,B,'dispute',1000); // nothing available: reversed 0, shortfall row
  const w3=await won(K2);
  const ex2=await q("select 1 from money_exceptions where dedupe_key=$1",['dispute-won:'+K2]);
  A('S3: nothing had been clawed back -> no review row needed',w3.found===true&&w3.review===false&&ex2.length===0,JSON.stringify(w3));
  const pr=[];
  for(const r of ['anon','authenticated']){const x=await asRole(r,()=>throws(()=>db.query("select dispute_won_for_payment('x','y')")));if(!/permission denied/.test(x||''))pr.push(r+':'+x)}
  A('S3: anon / authenticated cannot call dispute_won_for_payment',pr.length===0,pr.join('; '));
}

// ===== S2: pending credit checkouts =====
{
  const ch2=(await one("insert into channels(creator_id,name,slug) values($1,'c2','c-r4') returning id",[CR])).id;
  const vid=(await one("insert into videos(channel_id,creator_id,title,price) values($1,$2,'v',10) returning id",[ch2,CR])).id;
  const claim=(ref,gift=4,loan=1,ttl=2100)=>svc(async()=>(await one("select claim_credit_checkout($1,$2,$3,$4,$5,$6) r",[B,vid,ref,gift,loan,ttl])).r);
  const c1=await claim('ref-1');
  const c2=await claim('ref-2');
  A("S2: second claim for the same (buyer, video) is 'in_progress' (primary key), first is 'claimed'",c1.status==='claimed'&&c2.status==='in_progress',`${c1.status},${c2.status}`);
  const rel0=(await svc(()=>one("select release_credit_checkout($1,$2,'ref-WRONG') r",[B,vid]))).r;
  const stillThere=(await one("select count(*)::int n from pending_credit_checkouts where buyer_id=$1 and video_id=$2",[B,vid])).n;
  A('S2: a release with the wrong ref does not clear a newer claim',rel0===false&&stillThere===1);
  const rel=(await svc(()=>one("select release_credit_checkout($1,$2,'ref-1') r",[B,vid]))).r;
  const c3=await claim('ref-3');
  A("S2: release by the owning ref frees the pair; a new claim succeeds",rel===true&&c3.status==='claimed',`${rel},${c3.status}`);

  // crash after the debit, session never created: expire the row, a ledger spend exists -> next claim restores once
  await db.query("insert into app_credits(user_id,gift_balance,loan_balance) values($1,6,0) on conflict (user_id) do update set gift_balance=6, loan_balance=0",[B]);
  await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after,reference_id,reference_type) values($1,'spend_gift',4,2,0,$2,'ppv')",[B,vid]);
  await db.query("update app_credits set gift_balance=2 where user_id=$1",[B]);
  await db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute', gift_used=4, loan_used=0, created_at=now()-interval '40 minutes' where buyer_id='${B}' and video_id='${vid}'`);
  await db.exec(`update credit_ledger set created_at=now()-interval '39 minutes' where user_id='${B}' and entry_type='spend_gift'`);
  const c4=await claim('ref-4',2,0);
  const gift=(await one("select gift_balance g from app_credits where user_id=$1",[B])).g;
  const eff=(await one("select count(*)::int n from money_effects where effect_key='credit-checkout:ref-3:restore'")).n;
  A("S2: an EXPIRED claim whose debit happened is settled on the next claim: credits restored once (2 -> 6), new claim granted",c4.status==='claimed'&&Number(gift)===6&&eff===1,`${c4.status} gift=${gift} effects=${eff}`);
  // the route/webhook restoring later under the same key must be a no-op
  const again=(await svc(()=>one("select restore_credits_once('credit-checkout:ref-3:restore',$1,4,0,'ref-3','x') r",[B]))).r;
  A('S2: a later restore under the same key (route/webhook) does not restore again',again===false&&Number((await one("select gift_balance g from app_credits where user_id=$1",[B])).g)===6);

  // expired claim, debit never happened (crash right after the claim) -> no credits minted
  await db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute', created_at=now()-interval '5 minutes' where buyer_id='${B}' and video_id='${vid}'`);
  const sw=(await svc(()=>one("select settle_credit_checkout($1,$2) r",[B,vid]))).r;
  const g2=(await one("select gift_balance g from app_credits where user_id=$1",[B])).g;
  A("S2: an expired claim with NO spend in the ledger is dropped without restoring (no credits minted)",sw==='not_debited'&&Number(g2)===6,`${sw} gift=${g2}`);

  // expired claim but the purchase completed -> owned, nothing restored
  await claim('ref-5',2,0);
  await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after,reference_id,reference_type) values($1,'spend_gift',2,4,0,$2,'ppv')",[B,vid]);
  await db.query("insert into purchases(buyer_id,video_id,stripe_payment_intent_id,amount) values($1,$2,'pi_owned',0)",[B,vid]);
  await db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute' where buyer_id='${B}' and video_id='${vid}'`);
  const sw2=(await svc(()=>one("select settle_credit_checkout($1,$2) r",[B,vid]))).r;
  const g3=(await one("select gift_balance g from app_credits where user_id=$1",[B])).g;
  A("S2: an expired claim for an OWNED video is dropped without restoring",sw2==='owned'&&Number(g3)===6,`${sw2} gift=${g3}`);

  // sweep
  await db.query("delete from purchases where buyer_id=$1",[B]);
  await claim('ref-6',1,0);
  await db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute' where buyer_id='${B}' and video_id='${vid}'`);
  const swept=(await svc(()=>one("select sweep_stale_credit_checkouts(10) n"))).n;
  const left=(await one("select count(*)::int n from pending_credit_checkouts")).n;
  A('S2: sweep_stale_credit_checkouts settles every expired row',swept===1&&left===0,`swept=${swept} left=${left}`);

  // peek: live claim -> in_progress; none -> none; expired + spent -> settled (restored) even though the buyer has 0 credits
  await claim('ref-7',3,0);
  const pk1=(await svc(()=>one("select peek_credit_checkout($1,$2) r",[B,vid]))).r;
  await db.query("update app_credits set gift_balance=0 where user_id=$1",[B]);
  await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after,reference_id,reference_type) values($1,'spend_gift',3,0,0,$2,'ppv')",[B,vid]);
  await db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute' where buyer_id='${B}' and video_id='${vid}'`);
  const pk2=(await svc(()=>one("select peek_credit_checkout($1,$2) r",[B,vid]))).r;
  const pk3=(await svc(()=>one("select peek_credit_checkout($1,$2) r",[B,vid]))).r;
  const g4=(await one("select gift_balance g from app_credits where user_id=$1",[B])).g;
  A("S2: peek -> in_progress for a live claim; an expired one with a spend is settled (0 -> 3 credits back), then 'none'",pk1.status==='in_progress'&&pk2.status==='none'&&pk3.status==='none'&&Number(g4)===3,JSON.stringify([pk1,pk2,pk3])+' gift='+g4);

  const pr=[];
  for(const [r,fn] of [['anon','claim_credit_checkout'],['authenticated','claim_credit_checkout'],['anon','release_credit_checkout'],['authenticated','settle_credit_checkout'],['authenticated','sweep_stale_credit_checkouts'],['anon','peek_credit_checkout']]){
    const sqlc={claim_credit_checkout:`select claim_credit_checkout('${B}','${vid}','x',1,1,10)`,release_credit_checkout:`select release_credit_checkout('${B}','${vid}','x')`,peek_credit_checkout:`select peek_credit_checkout('${B}','${vid}')`,settle_credit_checkout:`select settle_credit_checkout('${B}','${vid}')`,sweep_stale_credit_checkouts:'select sweep_stale_credit_checkouts(1)'}[fn];
    const x=await asRole(r,()=>throws(()=>db.query(sqlc)));
    if(!/permission denied/.test(x||''))pr.push(`${r}:${fn}:${x}`);
  }
  A('S2: anon / authenticated cannot call the claim / release / settle / sweep functions',pr.length===0,pr.join('; '));
  const t=await asRole('authenticated',()=>throws(()=>db.query('select * from pending_credit_checkouts')));
  A('S2: pending_credit_checkouts is not readable by authenticated',/permission denied/.test(t||''),t);
}

// ===== F18: update_creator_streak no longer fails with an ambiguous column =====
{
  const s1=await svc(()=>one("select * from update_creator_streak($1,'post')",[B]).catch(e=>({err:e.message})));
  const s2=await svc(()=>one("select * from update_creator_streak($1,'post')",[B]).catch(e=>({err:e.message})));
  const row=await one("select current_streak c, longest_streak l, total_posts p from creator_streaks where creator_id=$1",[B]);
  A('F18: update_creator_streak runs (was "column reference current_streak is ambiguous"), same day twice keeps streak 1, counts 2 posts',s1.current_streak===1&&s2.current_streak===1&&row.c===1&&row.p===2,JSON.stringify([s1,s2,row]));
  await db.exec(`update creator_streaks set last_activity_date=current_date-1, current_streak=6, longest_streak=6 where creator_id='${B}'`);
  const s3=await svc(()=>one("select * from update_creator_streak($1,'stream')",[B]));
  A("F18: consecutive day extends the streak to 7 and reports milestone '7'",s3.current_streak===7&&s3.milestone==='7',JSON.stringify(s3));
  const priv=[];
  for(const r of ['anon','authenticated']){const x=await asRole(r,()=>throws(()=>db.query("select * from update_creator_streak($1,'post')",[B])));if(!/permission denied/.test(x||''))priv.push(r+':'+x)}
  A('F18: update_creator_streak is still not callable by anon / authenticated',priv.length===0,priv.join('; '));
}

// ===== all new round-4 definer functions pin search_path =====
{
  const bad=await q("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dispute_won_for_payment','cast_paid_vote','settle_credit_checkout','claim_credit_checkout','release_credit_checkout','sweep_stale_credit_checkouts','peek_credit_checkout') and not (p.prosecdef and coalesce(p.proconfig::text,'') like '%search_path=public, pg_temp%')");
  const n=(await one("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dispute_won_for_payment','cast_paid_vote','settle_credit_checkout','claim_credit_checkout','release_credit_checkout','sweep_stale_credit_checkouts','peek_credit_checkout')")).n;
  A('R4: all 7 new functions are SECURITY DEFINER with search_path = public, pg_temp',bad.length===0&&n===7,bad.map(r=>r.proname).join()+' n='+n);
}

{
  const nf=results.filter(r=>!r.ok).length;
  log(`\nTOTAL(r4) ${results.length} assertions, ${results.length-nf} pass, ${nf} fail`);
  fs.writeFileSync('results4.json',JSON.stringify({results},null,1));
}
