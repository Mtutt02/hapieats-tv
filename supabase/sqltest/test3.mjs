// Round-3 assertions (findings 1,4,7,8,13,15,16,6). Run: node test3.mjs
import {build,dir,NEW} from './apply.mjs'; import fs from 'fs';
const out=[]; const log=(...a)=>{const s=a.join(' ');console.log(s);out.push(s)};
const {db}=await build(()=>{});
const sql=fs.readFileSync(dir+'/'+NEW,'utf8');
const results=[];
const A=(name,ok,detail='')=>{results.push({name,ok,detail});log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ['+detail+']':''}`)};
const q=async(s,p)=>(await db.query(s,p)).rows;
const one=async(s,p)=>(await q(s,p))[0];
const asRole=async(role,fn)=>{await db.exec(`SET ROLE ${role}`);try{return await fn()}finally{await db.exec('RESET ROLE')}};
const throws=async(fn)=>{try{await fn();return null}catch(e){return e.message}};

// ---- legacy-shaped rows BEFORE the migration (old code: insert {id,type})
await db.exec("insert into stripe_events(id,type) values('evt_legacy','x')");
try{await db.exec(sql);A('r3: migration applies (1st run)',true)}catch(e){A('r3: migration applies (1st run)',false,e.message)}
try{await db.exec(sql);A('r3: migration applies (2nd run)',true)}catch(e){A('r3: migration applies (2nd run)',false,e.message)}

const U=['00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3'];
for(const [i,u] of U.entries()){
  await db.query("insert into auth.users(id,email) values($1,$2)",[u,`r3u${i}@x.test`]);
  await db.query("insert into public.profiles(id,username,display_name) values($1,$2,$2) on conflict (id) do nothing",[u,`r3user${i}`]);
}
const [S,C,P]=U;

// ===== Finding 1: money RPC privileges =====
const sigs=['record_token_movement(uuid,text,int,uuid,uuid,uuid,text,jsonb)','admin_review_monetization_request(uuid,text,uuid,text)','check_monetization_auto_unlock(uuid)','ensure_token_wallet(uuid)','ensure_creator_wallet(uuid)','update_creator_streak(uuid,text)','wallet_add(uuid,int,int)','bump_course_enrollment(uuid)'];
const bad=[];
for(const s of sigs){ for(const r of ['anon','authenticated','service_role']){
  const has=(await one("select has_function_privilege($1,$2::regprocedure,'EXECUTE') h",[r,'public.'+s])).h;
  if((r==='service_role')!==has) bad.push(`${r}:${s}:${has}`);
}}
A('F1: anon/authenticated lack EXECUTE, service_role has it, on all 8 pre-existing money functions',bad.length===0,bad.join('; '));
const calls={
  record_token_movement:"select * from record_token_movement('%U%','purchase',1000000)",
  admin_review_monetization_request:"select admin_review_monetization_request(gen_random_uuid(),'approved','%U%')",
  check_monetization_auto_unlock:"select check_monetization_auto_unlock('%U%')",
  ensure_token_wallet:"select ensure_token_wallet('%U%')",
  ensure_creator_wallet:"select ensure_creator_wallet('%U%')",
  update_creator_streak:"select * from update_creator_streak('%U%','post')",
  wallet_add:"select wallet_add('%U%',1000000,1000000)",
};
for(const r of ['anon','authenticated']){
  const res=[];
  for(const [n,s] of Object.entries(calls)){
    const e=await asRole(r,()=>throws(()=>db.query(s.replace('%U%',S))));
    if(!/permission denied/.test(e||'')) res.push(`${n}:${e||'ALLOWED'}`);
  }
  A(`F1: ${r} calling each money function -> permission denied`,res.length===0,res.join('; '));
}
const mint=await one("select coalesce(sum(balance),0)::int b from hapi_tokens where user_id=$1",[S]);
A('F1: no tokens were minted by the denied calls',mint.b===0,String(mint.b));
{
  const okc=[];
  await db.exec('SET ROLE service_role');
  try{
    await db.query("select * from record_token_movement($1,'purchase',10)",[S]);
    await db.query("select ensure_token_wallet($1)",[S]);
    await db.query("select ensure_creator_wallet($1)",[C]);
    await db.query("select check_monetization_auto_unlock($1)",[C]);
    // update_creator_streak has a pre-existing plpgsql name clash (current_streak); only EXECUTE privilege matters here
    const es=await throws(()=>db.query("select * from update_creator_streak($1,'post')",[C]));
    if(/permission denied/.test(es||'')) throw new Error(es);
    await db.query("select wallet_add($1,0,0)",[C]);
    okc.push('ok');
  }catch(e){okc.push('ERR '+e.message)}
  await db.exec('RESET ROLE');
  A('F1: service_role can still call them',okc[0]==='ok',okc.join());
  const sp=await q("select p.proname, p.proconfig::text c from pg_proc p where p.oid = any(select to_regprocedure('public.'||x)::oid from unnest($1::text[]) x)",[sigs]);
  const nosp=sp.filter(r=>!/search_path=public, pg_temp/.test(r.c||'')).map(r=>r.proname);
  A('F1/F20: search_path = public, pg_temp pinned on all 8',nosp.length===0&&sp.length===8,nosp.join()+' n='+sp.length);
  const newDef=await q("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname in ('claim_stripe_event','complete_stripe_event','release_stripe_event','claim_iap_event','complete_iap_event','release_iap_event','credit_tokens_once','credit_flavor_once','repay_loan_once','restore_credits_once','run_pro_payout','send_live_gift','send_flavor_gift') and not coalesce(p.proconfig::text,'') like '%pg_temp%'");
  A('F20: all new definer functions have search_path public, pg_temp',newDef.length===0,newDef.map(r=>r.proname).join());
}

// ===== Finding 4: legacy-shaped inserts stay 'completed' =====
{
  const lr=await one("select status,lease_until from stripe_events where id='evt_legacy'");
  A('F4: pre-migration {id,type} row is completed',lr.status==='completed',lr.status);
  await db.exec("insert into stripe_events(id,type) values('evt_oldcode','x')");   // old code AFTER migration
  await db.exec("insert into iap_events(event_id,user_id,type,product_id) values('iap_oldcode','"+S+"','x','p')");
  const o=await one("select status from stripe_events where id='evt_oldcode'");
  const oi=await one("select status from iap_events where event_id='iap_oldcode'");
  A('F4: old-code insert {id,type} after migration defaults to completed (not processing)',o.status==='completed'&&oi.status==='completed',o.status+','+oi.status);
  await db.exec('SET ROLE service_role');
  const cl=(await one("select claim_stripe_event('evt_oldcode','x',120) r")).r;
  const cl2=(await one("select claim_stripe_event('evt_fresh_r3','x',120) r")).r;
  const st=(await one("select status from stripe_events where id='evt_fresh_r3'")).status;
  await db.exec('RESET ROLE');
  A('F4: new claim of an old-code event -> duplicate (no re-fulfil); fresh claim still processing',cl==='duplicate'&&cl2==='claimed'&&st==='processing',`${cl},${cl2},${st}`);
}

// ===== Finding 15: CHECK swap tolerates unknown legacy values =====
{
  const cons=await q("select conname, convalidated from pg_constraint where conname in ('token_ledger_type_check','credit_ledger_entry_type_check') order by conname");
  A('F15: constraints exist and validated when data is clean',cons.length===2&&cons.every(c=>c.convalidated),JSON.stringify(cons));
  // legacy-bad rows: drop checks, insert unknown values, re-run migration
  await db.exec("alter table token_ledger drop constraint token_ledger_type_check; alter table credit_ledger drop constraint credit_ledger_entry_type_check");
  await db.query("insert into token_ledger(user_id,type,amount,balance_after) values($1,'legacy_weird',1,1)",[S]).catch(async e=>{log('  (token_ledger insert shape err: '+e.message+')')});
  await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after) values($1,'legacy_weird',1,0,0)",[S]).catch(async e=>{log('  (credit_ledger insert shape err: '+e.message+')')});
  const e=await throws(()=>db.exec(sql));
  const cons2=await q("select conname, convalidated from pg_constraint where conname in ('token_ledger_type_check','credit_ledger_entry_type_check') order by conname");
  A('F15: migration re-run with unknown legacy types does NOT abort; constraints present NOT VALID',!e&&cons2.length===2&&cons2.every(c=>!c.convalidated),(e||'')+JSON.stringify(cons2));
  const rej=await throws(()=>db.query("insert into token_ledger(user_id,type,amount,balance_after) values($1,'brand_new_bad',1,1)",[S]));
  A('F15: NOT VALID constraint still rejects NEW bad rows',/check constraint/.test(rej||''),rej);
  await db.exec("delete from token_ledger where type='legacy_weird'; delete from credit_ledger where entry_type='legacy_weird'");
  await db.exec(sql);
  const cons3=await q("select convalidated from pg_constraint where conname in ('token_ledger_type_check','credit_ledger_entry_type_check')");
  A('F15: after cleaning, re-run validates both',cons3.every(c=>c.convalidated),JSON.stringify(cons3));
}

// ===== Findings 7 + 8: run_pro_payout guards =====
{
  const M2='2026-09', M3='2026-08';
  await db.exec('SET ROLE service_role');
  const empty=(await one("select run_pro_payout($1,0,0,0,'[]'::jsonb) r",[M3])).r;
  const pl=await one("select distributed from pro_payout_pool where month=$1",[M3]);
  A('F7: empty ledger month -> status no_invoices and NOT flagged distributed',empty.status==='no_invoices'&&!pl?.distributed,JSON.stringify(empty)+' distributed='+pl?.distributed);
  await db.exec('RESET ROLE');
  await db.query("insert into pro_revenue_ledger(stripe_invoice_id,user_id,amount_cents,refunded_cents,paid_at,month) values('in_m2',$1,1000,0,now(),$2)",[P,M2]);
  await db.exec('SET ROLE service_role');
  const ern=(arr)=>JSON.stringify(arr);
  const e1=await throws(()=>db.query("select run_pro_payout($1,1000,500,10,$2::jsonb)",[M2,ern([{creator_id:C,credits:5,cents:300},{creator_id:S,credits:5,cents:300}])]));
  A('F8: SUM(cents) > pool -> BAD_SPLIT',/BAD_SPLIT/.test(e1||''),e1);
  const e2=await throws(()=>db.query("select run_pro_payout($1,1000,1001,10,$2::jsonb)",[M2,ern([{creator_id:C,credits:10,cents:1001}])]));
  A('F8: pool > gross -> BAD_SPLIT',/BAD_SPLIT/.test(e2||''),e2);
  const e3=await throws(()=>db.query("select run_pro_payout($1,1000,500,10,$2::jsonb)",[M2,ern([{creator_id:C,credits:10,cents:-5}])]));
  A('F8: negative cents -> BAD_SPLIT',/BAD_SPLIT/.test(e3||''),e3);
  const none=(await one("select count(*)::int n from pro_pool_earnings where month=$1",[M2])).n;
  const pd=await one("select distributed from pro_payout_pool where month=$1",[M2]);
  A('F8: rejected runs wrote nothing and left the month undistributed',none===0&&!pd?.distributed,`earnings=${none}`);
  const ok=(await one("select run_pro_payout($1,1000,500,10,$2::jsonb) r",[M2,ern([{creator_id:C,credits:6,cents:300},{creator_id:S,credits:4,cents:200}])])).r;
  A('F8: a valid split (sum == pool <= gross) distributes',ok.status==='distributed'&&ok.distributed_cents===500,JSON.stringify(ok));
  await db.exec('RESET ROLE');
}

// ===== Findings 2 + 10 (SQL part): reverse_tokens_for_payment =====
{
  const buy=async(key,u,n)=>{await db.exec('SET ROLE service_role');await db.query("select credit_tokens_once($1,$2,'purchase',$3,'buy','{}'::jsonb)",[key,u,n]);await db.exec('RESET ROLE')};
  const rev=async(key,u,src,tok,purchased=1000)=>{await db.exec('SET ROLE service_role');try{return (await one("select reverse_tokens_for_payment($1,$2,$3,$4,$5,'t','{}'::jsonb) r",[key,u,purchased,src,tok])).r}finally{await db.exec('RESET ROLE')}};
  const bal=async(u)=>(await one("select balance b from hapi_tokens where user_id=$1",[u])).b;
  const mk=async(u,n)=>{await db.query("insert into auth.users(id,email) values($1,$2)",[u,n+'@x']); await db.query("insert into profiles(id,username) values($1,$2) on conflict (id) do nothing",[u,n])};
  // (a) refund + dispute on one charge
  const U1='00000000-0000-0000-0000-0000000000c1';
  await mk(U1,'c1');
  await buy('k_buy_c1',U1,1000);
  const r1=await rev('stripe:pi:pi_1:token-reversal',U1,'refund',1000);
  const r2=await rev('stripe:pi:pi_1:token-reversal',U1,'dispute',1000);
  const r3=await rev('stripe:pi:pi_1:token-reversal',U1,'refund',1000);
  A('F2: refund + dispute on one charge reverse exactly the purchased tokens, once',r1.reversed_now===1000&&r2.reversed_now===0&&r3.reversed_now===0&&(await bal(U1))===0,`${r1.reversed_now},${r2.reversed_now},${r3.reversed_now} balance=${await bal(U1)}`);
  // (b) two partial refunds (cumulative 30% then 60%), replay of the first
  const U2='00000000-0000-0000-0000-0000000000c2';
  await mk(U2,'c2');
  await buy('k_buy_c2',U2,1000);
  const p1=await rev('stripe:pi:pi_2:token-reversal',U2,'refund',300);
  const p2=await rev('stripe:pi:pi_2:token-reversal',U2,'refund',600);
  const p1b=await rev('stripe:pi:pi_2:token-reversal',U2,'refund',300);
  A('F2: two partial refunds reverse 300 then 300 (total 600); a late replay of the first changes nothing',p1.reversed_now===300&&p2.reversed_now===300&&p1b.reversed_now===0&&(await bal(U2))===400,`${p1.reversed_now},${p2.reversed_now},${p1b.reversed_now} balance=${await bal(U2)}`);
  // (c) cap
  const p3=await rev('stripe:pi:pi_2:token-reversal',U2,'dispute',1000);
  A('F2: dispute after a partial refund tops up to, never past, the purchased amount',p3.reversed_now===400&&p3.reversed_total===1000&&(await bal(U2))===0,JSON.stringify(p3));
  // (d) F10: buyer spent most of it
  const U3='00000000-0000-0000-0000-0000000000c3';
  await mk(U3,'c3');
  await buy('k_buy_c3',U3,1000);
  await db.exec('SET ROLE service_role'); await db.query("select * from record_token_movement($1,'gift_sent',-800)",[U3]); await db.exec('RESET ROLE');
  const s1=await rev('stripe:pi:pi_3:token-reversal',U3,'refund',1000);
  const ex=await q("select kind,amount::int a,resolved_at from money_exceptions where dedupe_key='stripe:pi:pi_3:token-reversal:shortfall'");
  A('F10: spent tokens -> partial clawback of the available 200, shortfall 800 recorded in money_exceptions, balance not negative',s1.reversed_now===200&&s1.shortfall===800&&(await bal(U3))===0&&ex.length===1&&ex[0].a===800&&ex[0].resolved_at===null,JSON.stringify(s1)+JSON.stringify(ex));
  const s2=await rev('stripe:pi:pi_3:token-reversal',U3,'refund',1000);
  const ex2=await q("select count(*)::int n from money_exceptions where dedupe_key='stripe:pi:pi_3:token-reversal:shortfall'");
  A('F10: a retry of the same event does not duplicate the exception row',s2.reversed_now===0&&ex2[0].n===1,JSON.stringify(s2));
  await buy('k_topup_c3',U3,500);
  const s3=await rev('stripe:pi:pi_3:token-reversal',U3,'refund',1000);
  const ex3=await one("select amount::int a,resolved_at from money_exceptions where dedupe_key='stripe:pi:pi_3:token-reversal:shortfall'");
  A('F10: when tokens reappear, the retry claws back more (500 of the 800) and the exception amount follows (300)',s3.reversed_now===500&&s3.shortfall===300&&ex3.a===300,JSON.stringify(s3)+JSON.stringify(ex3));
  const priv=[];
  for(const r of ['anon','authenticated']){const e=await asRole(r,()=>throws(()=>db.query("select reverse_tokens_for_payment('x',$1,10,'refund',10)",[U1])));if(!/permission denied/.test(e||''))priv.push(r+':'+e)}
  const tp=[];
  for(const r of ['anon','authenticated']){for(const t of ['money_exceptions','token_reversals']){const e=await asRole(r,()=>throws(()=>db.query(`select * from ${t}`)));if(!/permission denied/.test(e||''))tp.push(r+':'+t+':'+e)}}
  A('F2/F6: reverse_tokens_for_payment, money_exceptions, token_reversals are not reachable by anon/authenticated',priv.length===0&&tp.length===0,priv.concat(tp).join('; '));
  const rls=await q("select relname, relrowsecurity from pg_class where relname in ('money_exceptions','token_reversals','money_effects')");
  A('F6: RLS enabled on money_exceptions / token_reversals / money_effects, no policies on the first two',rls.length===3&&rls.every(r=>r.relrowsecurity)&&(await q("select 1 from pg_policies where tablename in ('money_exceptions','token_reversals')")).length===0,JSON.stringify(rls));
}

// ===== Finding 10 (SQL part): disputes reduce the ledger =====
{
  await db.exec('RESET ROLE');
  await db.query("insert into pro_revenue_ledger(stripe_invoice_id,user_id,amount_cents,refunded_cents,disputed_cents,paid_at,month) values('in_d1',$1,1000,0,400,now(),'2026-07'),('in_d2',$1,1000,600,600,now(),'2026-07')",[P]);
  await db.exec('SET ROLE service_role');
  const e=await throws(()=>db.query("select run_pro_payout('2026-07',601,300,1,$1::jsonb)",[JSON.stringify([{creator_id:C,credits:1,cents:300}])]));
  const ok=(await one("select run_pro_payout('2026-07',600,300,1,$1::jsonb) r",[JSON.stringify([{creator_id:C,credits:1,cents:300}])])).r;
  A('F10: gross nets refunds AND disputes: (1000-0-400) + max(1000-600-600,0) = 600',/GROSS_CHANGED/.test(e||'')&&ok.gross_cents===600,(e||'')+JSON.stringify(ok));
  await db.exec('RESET ROLE');
}

// ===== Finding 13: course_enrollments unique index =====
{
  await db.exec("create table public.course_enrollments(id uuid default gen_random_uuid() primary key, course_id uuid, user_id uuid, amount_paid_usd numeric, stripe_session_id text)");
  const cid='00000000-0000-0000-0000-00000000cc01';
  await db.query("insert into course_enrollments(course_id,user_id) values($1,$2),($1,$2)",[cid,S]);
  const e1=await throws(()=>db.exec(sql));
  const idx1=await q("select 1 from pg_indexes where indexname='uq_course_enrollments_course_user'");
  A('F13: duplicates already present -> migration does NOT abort (warning), index not created',!e1&&idx1.length===0,e1||'');
  await db.exec("delete from course_enrollments where id in (select id from course_enrollments order by id limit 1)");
  const e2=await throws(()=>db.exec(sql));
  const idx2=await q("select 1 from pg_indexes where indexname='uq_course_enrollments_course_user'");
  const dupIns=await throws(()=>db.query("insert into course_enrollments(course_id,user_id) values($1,$2)",[cid,S]));
  A('F13: duplicate-free -> index created; a second enrolment of the same (course,user) is rejected',!e2&&idx2.length===1&&/unique/.test(dupIns||''),(e2||'')+(dupIns||''));
  await db.exec("drop index uq_course_enrollments_course_user; alter table course_enrollments add constraint ce_uniq unique (course_id,user_id)");
  const e3=await throws(()=>db.exec(sql));
  const idx3=await q("select 1 from pg_indexes where indexname='uq_course_enrollments_course_user'");
  A('F13: an existing unique constraint on the pair -> migration adds no duplicate index',!e3&&idx3.length===0,e3||'');
}

// ===== Finding 16: gifts only on an active stream =====
{
  const chId=(await one("insert into channels(creator_id,name,slug) values($1,'c','c16') returning id",[C])).id;
  const stIdle=(await one("insert into live_streams(channel_id,creator_id,title,mux_live_stream_id,stream_key,status) values($1,$2,'T','mx16','k16','idle') returning id",[chId,C])).id;
  const stAct=(await one("insert into live_streams(channel_id,creator_id,title,mux_live_stream_id,stream_key,status) values($1,$2,'T2','mx17','k17','active') returning id",[chId,C])).id;
  const gift=await one("select id from live_gifts where is_active order by token_cost limit 1");
  await db.exec('SET ROLE service_role');
  await db.query("select * from record_token_movement($1,'purchase',500)",[S]);
  const eIdle=await throws(()=>db.query("select send_live_gift('r16a',$1,$2,$3,1)",[S,stIdle,gift.id]));
  const okAct=(await one("select send_live_gift('r16b',$1,$2,$3,1) r",[S,stAct,gift.id])).r;
  await db.exec('RESET ROLE');
  A("F16: gift to an 'idle' stream is rejected; to an 'active' stream it works",/STREAM_ENDED/.test(eIdle||'')&&okAct.status==='ok',(eIdle||'')+okAct.status);
}

// ---- summary
{
  const nf=results.filter(r=>!r.ok).length;
  log(`\nTOTAL(r3) ${results.length} assertions, ${results.length-nf} pass, ${nf} fail`);
  fs.writeFileSync('results3.json',JSON.stringify({results},null,1));
}
