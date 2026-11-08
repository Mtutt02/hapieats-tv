import {build,dir,NEW} from './apply.mjs'; import fs from 'fs';
const out=[]; const log=(...a)=>{const s=a.join(' ');console.log(s);out.push(s)};
const {db,unresolved}=await build(()=>{});
log('Unresolved old migrations after fixpoint retry:',unresolved.join(', '));
const sql=fs.readFileSync(dir+'/'+NEW,'utf8');
const results=[];
const A=(name,ok,detail='')=>{results.push({name,ok,detail});log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ['+detail+']':''}`)};
try{await db.exec(sql);A('apply 20261107 migration (1st run)',true)}catch(e){A('apply 20261107 migration (1st run)',false,e.message)}
try{await db.exec(sql);A('apply 20261107 migration (2nd run, same DB)',true)}catch(e){A('apply 20261107 migration (2nd run, same DB)',false,e.message)}
const q=async(s,p)=>(await db.query(s,p)).rows;
const one=async(s,p)=>(await q(s,p))[0];
const asRole=async(role,fn)=>{await db.exec(`SET ROLE ${role}`);try{return await fn()}finally{await db.exec('RESET ROLE')}};
const throws=async(fn)=>{try{await fn();return null}catch(e){return e.message}};

// fixtures
const U=['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3'];
for(const [i,u] of U.entries()){
  await db.query("insert into auth.users(id,email) values($1,$2)",[u,`u${i}@x.test`]);
  await db.query("insert into public.profiles(id,username,display_name) values($1,$2,$2) on conflict (id) do update set username=excluded.username",[u,`user${i}`]).catch(async e=>{log('profile insert err',e.message);});
}
const [S,C,P]=U; // sender, creator, extra
// ---- 1. claim_stripe_event
await db.exec('SET ROLE service_role');
const c1=(await one("select claim_stripe_event('evt_1','t',120) r")).r;
const c2=(await one("select claim_stripe_event('evt_1','t',120) r")).r;
A('claim_stripe_event twice -> claimed then busy (lease live)',c1==='claimed'&&c2==='busy',`${c1},${c2}`);
await db.exec('RESET ROLE'); await db.exec("update stripe_events set lease_until=now()-interval '1 second' where id='evt_1'"); await db.exec('SET ROLE service_role');
const c3=(await one("select claim_stripe_event('evt_1','t',120) r")).r;
const att=(await one("select attempts a from stripe_events where id='evt_1'")).a;
A('stale lease can be taken over (attempts incremented)',c3==='claimed'&&att===2,`${c3}, attempts=${att}`);
await db.query("select complete_stripe_event('evt_1')");
const c4=(await one("select claim_stripe_event('evt_1','t',120) r")).r;
A('complete then claim -> duplicate',c4==='duplicate',c4);
await db.query("select claim_stripe_event('evt_2','t',120)"); await db.query("select release_stripe_event('evt_2')"); await new Promise(r=>setTimeout(r,30));
const c5=(await one("select claim_stripe_event('evt_2','t',120) r")).r;
A('release_stripe_event lets the retry claim immediately',c5==='claimed',c5);
// IAP
const i1=(await one("select claim_iap_event('iap_1',$1,'INITIAL_PURCHASE','prod',120) r",[S])).r;
const i2=(await one("select claim_iap_event('iap_1',$1,'INITIAL_PURCHASE','prod',120) r",[S])).r;
await db.query("select complete_iap_event('iap_1')");
const i3=(await one("select claim_iap_event('iap_1',$1,'INITIAL_PURCHASE','prod',120) r",[S])).r;
A('claim_iap_event claimed/busy/duplicate',i1==='claimed'&&i2==='busy'&&i3==='duplicate',`${i1},${i2},${i3}`);
// ---- 2. credit_tokens_once
const t1=(await one("select credit_tokens_once('k_tok_1',$1,'purchase',500,'buy','{}'::jsonb) r",[S])).r;
const t2=(await one("select credit_tokens_once('k_tok_1',$1,'purchase',500,'buy','{}'::jsonb) r",[S])).r;
const bal=(await one("select balance b from hapi_tokens where user_id=$1",[S])).b;
const lc=(await one("select count(*)::int n from token_ledger where user_id=$1 and type='purchase'",[S])).n;
A('credit_tokens_once twice, same key -> one credit',t1===true&&t2===false&&bal===500&&lc===1,`${t1},${t2}, balance=${bal}, ledger rows=${lc}`);
// flavor + loan
const f1=(await one("select credit_flavor_once('k_fl_1',$1,(select id from flavor_packages limit 1),100,4.99,'cs_1') r",[S])).r;
const f2=(await one("select credit_flavor_once('k_fl_1',$1,(select id from flavor_packages limit 1),100,4.99,'cs_1') r",[S])).r;
const fb=(await one("select balance b from flavor_wallets where user_id=$1",[S])).b;
const fp=(await one("select count(*)::int n from flavor_purchases where user_id=$1",[S])).n;
A('credit_flavor_once twice -> one credit',f1===true&&f2===false&&Number(fb)===100&&fp===1,`${f1},${f2}, balance=${fb}, purchases=${fp}`);
await db.exec('RESET ROLE');
await db.query("insert into app_credits(user_id,gift_balance,loan_balance) values($1,0,10)",[P]);
await db.exec('SET ROLE service_role');
const l1=(await one("select repay_loan_once('k_loan_1',$1,4,'cs_l') r",[P])).r;
const l2=(await one("select repay_loan_once('k_loan_1',$1,4,'cs_l') r",[P])).r;
const lb=await one("select loan_balance lb, loan_repaid lr from app_credits where user_id=$1",[P]);
A('repay_loan_once twice -> applied once',Number(l1)===4&&Number(l2)===0&&Number(lb.lb)===6&&Number(lb.lr)===4,`${l1},${l2}, loan_balance=${lb.lb}, repaid=${lb.lr}`);
// ---- 3. restore_credits_once
const r1=(await one("select restore_credits_once('k_rc_1',$1,3,2,'cs_x','abandoned') r",[P])).r;
const r2=(await one("select restore_credits_once('k_rc_1',$1,3,2,'cs_x','abandoned') r",[P])).r;
const rb=await one("select gift_balance g, loan_balance l from app_credits where user_id=$1",[P]);
const rl=(await one("select count(*)::int n from credit_ledger where user_id=$1 and entry_type='restore_credit'",[P])).n;
A('restore_credits_once twice -> one restore',r1===true&&r2===false&&Number(rb.g)===3&&Number(rb.l)===8&&rl===1,`${r1},${r2}, gift=${rb.g}, loan=${rb.l}, ledger rows=${rl}`);
const rn=await throws(()=>db.query("select restore_credits_once('k_rc_2',$1,0,0,'x')",[P]));
const rk=await one("select count(*)::int n from money_effects where effect_key='k_rc_2'");
A('restore_credits_once rejects zero amount and leaves no key',!!rn&&rk.n===0,rn);
await db.exec('RESET ROLE');
// ---- 5. live gift
const chId=(await one("insert into channels(creator_id,name,slug) values($1,'c','c1') returning id",[C])).id;
const stId=(await one("insert into live_streams(channel_id,creator_id,title,mux_live_stream_id,stream_key,status) values($1,$2,'T','mx1','k','active') returning id",[chId,C])).id;
const gift=await one("select id,token_cost from live_gifts where is_active order by token_cost limit 1");
const snap=async()=>JSON.stringify([await q("select user_id,balance from hapi_tokens order by user_id"),await q("select count(*)::int n from token_ledger"),await q("select count(*)::int n from live_gift_transactions"),await q("select * from creator_wallets order by creator_id")]);
await db.exec('RESET ROLE'); await db.query("insert into auth.users(id,email) values('00000000-0000-0000-0000-0000000000a4','p@x')"); await db.query("insert into profiles(id,username) values('00000000-0000-0000-0000-0000000000a4','poor') on conflict (id) do nothing");
await db.query("insert into hapi_tokens(user_id,balance) values('00000000-0000-0000-0000-0000000000a4',0) on conflict (user_id) do update set balance=0");
await db.exec('SET ROLE service_role');
const before=await snap();
const err=await throws(()=>db.query("select send_live_gift('req_poor','00000000-0000-0000-0000-0000000000a4',$1,$2,1)",[stId,gift.id]));
const after=await snap();
A('send_live_gift insufficient balance -> error, no rows changed',!!err&&/INSUFFICIENT_BALANCE/.test(err)&&before===after,err);
const g1=(await one("select send_live_gift('req_1',$1,$2,$3,2) r",[S,stId,gift.id])).r;
const g2=(await one("select send_live_gift('req_1',$1,$2,$3,2) r",[S,stId,gift.id])).r;
const sb=(await one("select balance b from hapi_tokens where user_id=$1",[S])).b;
const gn=(await one("select count(*)::int n from live_gift_transactions where sender_id=$1",[S])).n;
const cw=await one("select tokens_received t, redeemable_cents c from creator_wallets where creator_id=$1",[C]);
const expect=500-2*gift.token_cost;
A('send_live_gift same request_id twice -> one charge',g1.status==='ok'&&g2.status==='duplicate'&&sb===expect&&gn===1&&cw.t===2*gift.token_cost,`${g1.status},${g2.status}, balance=${sb} (expected ${expect}), tx rows=${gn}, creator tokens=${cw.t}`);
const g3=(await one("select send_live_gift('req_2',$1,$2,$3,1) r",[S,stId,gift.id])).r;
const sb2=(await one("select balance b from hapi_tokens where user_id=$1",[S])).b;
A('send_live_gift new request_id charges again',g3.status==='ok'&&sb2===expect-gift.token_cost,`balance=${sb2}`);
const own=await throws(()=>db.query("select send_live_gift('req_o',$1,$2,$3,1)",[C,stId,gift.id]));
A('send_live_gift rejects gifting own stream',/OWN_STREAM/.test(own||''),own);
// flavor gift
const fb0=(await one("select balance b from flavor_wallets where user_id=$1",[S])).b;
const fg1=(await one("select send_flavor_gift('fr1',$1,$2,null,(select id from flavor_gifts limit 1),30,20) r",[S,C])).r;
const fg2=(await one("select send_flavor_gift('fr1',$1,$2,null,(select id from flavor_gifts limit 1),30,20) r",[S,C])).r;
const fb1=(await one("select balance b from flavor_wallets where user_id=$1",[S])).b;
const fe=(await one("select count(*)::int n from creator_flavor_earnings where creator_id=$1",[C])).n;
A('send_flavor_gift same request_id twice -> one charge',fg1.status==='ok'&&fg2.status==='duplicate'&&Number(fb1)===Number(fb0)-30&&fe===1,`${fg1.status},${fg2.status}, ${fb0}->${fb1}, earnings rows=${fe}`);
const fe2=await throws(()=>db.query("select send_flavor_gift('fr2',$1,$2,null,(select id from flavor_gifts limit 1),9999,20)",[S,C]));
A('send_flavor_gift insufficient -> error',/INSUFFICIENT_BALANCE/.test(fe2||''),fe2);
// ---- 4. pro payout
await db.exec('RESET ROLE');
const M='2026-10';
await db.query("insert into pro_revenue_ledger(stripe_invoice_id,user_id,amount_cents,refunded_cents,paid_at,month) values('in_1',$1,1000,0,now(),$2),('in_2',$1,1000,200,now(),$2),('in_3',$1,500,500,now(),$2)",[P,M]);
await db.exec('SET ROLE service_role');
const gross=1800, pool=1260;
const earn=JSON.stringify([{creator_id:C,credits:6,cents:756},{creator_id:S,credits:4,cents:504}]);
const wrong=await throws(()=>db.query("select run_pro_payout($1,$2,$3,10,$4::jsonb)",[M,gross+1,pool,earn]));
A('run_pro_payout wrong expected gross -> GROSS_CHANGED, nothing paid',/GROSS_CHANGED/.test(wrong||'')&&(await one("select count(*)::int n from pro_pool_earnings")).n===0,wrong);
const before2=(await one("select coalesce(sum(redeemable_cents),0)::int s from creator_wallets")).s;
const p1=(await one("select run_pro_payout($1,$2,$3,10,$4::jsonb) r",[M,gross,pool,earn])).r;
const mid=(await one("select coalesce(sum(redeemable_cents),0)::int s from creator_wallets")).s;
const p2=(await one("select run_pro_payout($1,$2,$3,10,$4::jsonb) r",[M,gross,pool,earn])).r;
const after2=(await one("select coalesce(sum(redeemable_cents),0)::int s from creator_wallets")).s;
const led=(await one("select sum(cents)::int s from pro_pool_earnings where month=$1 and paid",[M])).s;
A('run_pro_payout twice -> 2nd is no-op; wallet delta == earnings ledger sum',p1.status==='distributed'&&p2.status==='already_distributed'&&mid-before2===led&&after2===mid&&led===1260,`${p1.status},${p2.status}, wallet delta=${mid-before2}, ledger sum=${led}, after 2nd=${after2}`);
// ---- permissions
await db.exec('RESET ROLE');
const fns=await q(`select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_stripe_event','complete_stripe_event','release_stripe_event','claim_iap_event','complete_iap_event','release_iap_event','credit_tokens_once','credit_flavor_once','repay_loan_once','restore_credits_once','run_pro_payout','send_live_gift','send_flavor_gift')`);
const bad=[];
for(const {sig} of fns){
  for(const r of ['anon','authenticated','service_role']){
    const has=(await one("select has_function_privilege($1,$2::regprocedure,'EXECUTE') h",[r,sig])).h;
    if((r==='service_role')!==has) bad.push(`${r}:${sig}:${has}`);
  }
}
A(`anon/authenticated cannot EXECUTE, service_role can (${fns.length} functions, has_function_privilege)`,fns.length===13&&bad.length===0,bad.join('; '));
for(const r of ['anon','authenticated']){
  const e=await asRole(r,()=>throws(()=>db.query("select claim_stripe_event('x','y',1)")));
  const e2=await asRole(r,()=>throws(()=>db.query("select send_live_gift('z',$1,$2,$3,1)",[S,stId,gift.id])));
  A(`${r} actually calling claim_stripe_event / send_live_gift -> permission denied`,/permission denied/.test(e||'')&&/permission denied/.test(e2||''),(e||'ok')+' | '+(e2||'ok'));
}
await db.exec('RESET ROLE');
const nf=results.filter(r=>!r.ok).length;
log(`\nTOTAL ${results.length} assertions, ${results.length-nf} pass, ${nf} fail`);
fs.writeFileSync('results.json',JSON.stringify({unresolved,results},null,1));
