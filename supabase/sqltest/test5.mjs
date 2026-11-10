// Round-5 assertions (#833 Fable review): P0 money-table lockdown, P1 fulfil-vs-restore state machine,
// P4 payout-request lock. Run: node test5.mjs        (SKIP_R5=1 node test5.mjs = failing-first baseline:
// the round-5 migration is NOT applied, so every "rejected / exclusive" assertion must FAIL.)
import {build,dir,NEW,R5} from './apply.mjs'; import fs from 'fs';
const out=[]; const log=(...a)=>{const s=a.join(' ');console.log(s);out.push(s)};
const {db}=await build(()=>{});
const sql=fs.readFileSync(dir+'/'+NEW,'utf8');
const results=[];
const A=(name,ok,detail='')=>{results.push({name,ok,detail});log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ['+String(detail).slice(0,200)+']':''}`)};
const q=async(s,p)=>(await db.query(s,p)).rows;
const one=async(s,p)=>(await q(s,p))[0];
const throws=async(fn)=>{try{await fn();return null}catch(e){return e.message}};
const svc=async(fn)=>{await db.exec('SET ROLE service_role');try{return await fn()}finally{await db.exec('RESET ROLE')}};
// act as a signed-in user: role authenticated + a JWT subject that auth.uid() returns
await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$`);
const asUser=async(uid,fn)=>{await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false)`);try{return await fn()}finally{await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)")}};
const denied=(m)=>/permission denied|row-level security/.test(m||'');

await db.exec(sql);
if(!process.env.SKIP_R5){
  const r5=fs.readFileSync(dir+'/'+R5,'utf8');
  try{await db.exec(r5);A('R5 migration applies (1st run) on top of the money migration',true)}catch(e){A('R5 migration applies (1st run) on top of the money migration',false,e.message)}
  try{await db.exec(r5);A('R5 migration applies (2nd run, idempotent)',true)}catch(e){A('R5 migration applies (2nd run, idempotent)',false,e.message)}
}

// ---------- fixtures ----------
const U=['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3'];
for(const [i,u] of U.entries()){
  await db.query("insert into auth.users(id,email) values($1,$2)",[u,`r5u${i}@x.test`]);
  await db.query("insert into public.profiles(id,username,display_name) values($1,$2,$2) on conflict (id) do nothing",[u,`r5user${i}`]);
}
const [ME,OTHER,CR]=U;   // attacker/buyer, bystander, creator
await svc(()=>db.query("select * from record_token_movement($1,'purchase',100)",[ME]));
await svc(()=>db.query("select * from record_token_movement($1,'purchase',100)",[OTHER]));
await svc(()=>db.query("select wallet_add($1,10,50)",[ME]));
await svc(()=>db.query("select * from update_creator_streak($1,'post')",[ME]));
const bal=async(u)=>(await one("select balance b from hapi_tokens where user_id=$1",[u]))?.b;

// ===== P0: signed-in users cannot write money tables directly =====
{
  // the attack, exactly as in the review: PATCH /rest/v1/hapi_tokens?user_id=eq.<me> {"balance":1000000}
  const e1=await asUser(ME,()=>throws(()=>db.query("update hapi_tokens set balance=1000000 where user_id=$1",[ME])));
  A('P0: authenticated cannot UPDATE their own hapi_tokens.balance',denied(e1)&&await bal(ME)===100,`${e1} balance=${await bal(ME)}`);
  const e1b=await asUser(ME,()=>throws(()=>db.query("update hapi_tokens set lifetime_purchased=999999 where user_id=$1",[ME])));
  A('P0: ...nor any other column of hapi_tokens',denied(e1b),e1b);
  const e1c=await asUser(ME,()=>throws(()=>db.query("insert into hapi_tokens(user_id,balance) values($1,5) on conflict (user_id) do update set balance=5",[CR])));
  A('P0: ...nor INSERT/upsert a hapi_tokens row',denied(e1c),e1c);
  const e1d=await asUser(ME,()=>throws(()=>db.query("delete from hapi_tokens where user_id=$1",[ME])));
  A('P0: ...nor DELETE their wallet row',denied(e1d),e1d);

  const e2=await asUser(ME,()=>throws(()=>db.query("update creator_wallets set redeemable_cents=500000 where creator_id=$1",[ME])));
  const w=await one("select redeemable_cents r from creator_wallets where creator_id=$1",[ME]);
  A('P0: authenticated cannot UPDATE creator_wallets.redeemable_cents (cash-out balance)',denied(e2)&&w.r===50,`${e2} redeemable=${w.r}`);
  const e2b=await asUser(ME,()=>throws(()=>db.query("update creator_wallets set payout_status='none', stripe_connect_id='acct_x' where creator_id=$1",[ME])));
  A('P0: ...nor payout_status / stripe_connect_id',denied(e2b),e2b);
  const e2c=await asUser(ME,()=>throws(()=>db.query("insert into creator_wallets(creator_id,redeemable_cents) values($1,1)",[CR])));
  A('P0: ...nor INSERT a creator_wallets row',denied(e2c),e2c);

  const e3=await asUser(ME,()=>throws(()=>db.query("update creator_streaks set current_streak=90 where creator_id=$1",[ME])));
  const st=await one("select current_streak c from creator_streaks where creator_id=$1",[ME]);
  A('P0: authenticated cannot UPDATE creator_streaks (streak bonus farming)',denied(e3)&&st.c===1,`${e3} streak=${st.c}`);

  const ch=(await one("insert into creator_challenges(title,start_date,end_date,voting_type,token_vote_cost,status) values('c5',current_date,current_date,'token',5,'voting') returning id")).id;
  const ent=(await one("insert into challenge_entries(challenge_id,creator_id,title,status) values($1,$2,'e5','approved') returning id",[ch,CR])).id;
  const e4=await asUser(ME,()=>throws(()=>db.query("insert into challenge_votes(entry_id,voter_id,tokens_spent) values($1,$2,1000000)",[ent,ME])));
  const tv=await one("select vote_count v, token_vote_total t from challenge_entries where id=$1",[ent]);
  A('P0: authenticated cannot INSERT a challenge_votes row (tokens_spent=10^6 would inflate the prize tally)',denied(e4)&&tv.v===0&&tv.t===0,`${e4} ${JSON.stringify(tv)}`);
  const e4b=await asUser(ME,()=>throws(()=>db.query("update challenge_entries set token_vote_total=999999, vote_count=999999 where creator_id=$1",[CR])));
  const e4c=await asUser(CR,()=>throws(()=>db.query("update challenge_entries set token_vote_total=999999 where id=$1",[ent])));
  A("P0: a creator cannot write their own entry's vote_count / token_vote_total",denied(e4c),e4c);
  const e4d=await asUser(CR,()=>throws(()=>db.query("update challenge_entries set status='approved', final_rank=1 where id=$1",[ent])));
  A("P0: ...nor status / final_rank (moderation + prize result)",denied(e4d),e4d);
  const e4e=await asUser(CR,()=>throws(()=>db.query("insert into challenge_entries(challenge_id,creator_id,title,vote_count) values($1,$2,'sneaky',500)",[ch,OTHER])));
  A('P0: ...nor INSERT an entry with a pre-set vote_count',denied(e4e),e4e);

  const gl=(await one("insert into creator_goals(creator_id,title,target_tokens) values($1,'g5',1000) returning id",[CR])).id;
  const e5=await asUser(ME,()=>throws(()=>db.query("insert into goal_contributions(goal_id,contributor_id,tokens) values($1,$2,1000)",[gl,ME])));
  const g=await one("select current_tokens c, status s from creator_goals where id=$1",[gl]);
  A('P0: authenticated cannot INSERT a goal_contributions row (unpaid contribution would fill the goal)',denied(e5)&&g.c===0&&g.s==='active',`${e5} ${JSON.stringify(g)}`);
  const e5b=await asUser(CR,()=>throws(()=>db.query("update creator_goals set current_tokens=1000, status='completed' where id=$1",[gl])));
  A("P0: a creator cannot write their own goal's current_tokens / status",denied(e5b),e5b);

  // paid program: a user must not enrol themself for free
  const prog=(await one("insert into programs(owner_id,title,price,is_published) values($1,'paid prog',49.00,true) returning id",[CR])).id;
  const free=(await one("insert into programs(owner_id,title,price,is_published) values($1,'free prog',0,true) returning id",[CR])).id;
  const e6=await asUser(ME,()=>throws(()=>db.query("insert into program_enrollments(program_id,user_id,status) values($1,$2,'active')",[prog,ME])));
  A('P0: authenticated cannot enrol themself in a PAID program (program_enroll_own)',denied(e6),e6);
  const ok6=await asUser(ME,()=>throws(()=>db.query("insert into program_enrollments(program_id,user_id,status) values($1,$2,'active')",[free,ME])));
  A('P0: free-program enrolment through the user client still works (the app route does this)',ok6===null,ok6);
  const e6b=await asUser(ME,()=>throws(()=>db.query("update program_enrollments set status='completed', completed_at=now() where user_id=$1",[ME])));
  const e6c=await asUser(ME,()=>throws(()=>db.query("insert into program_enrollments(program_id,user_id,status) values($1,$2,'active')",[free,OTHER])));
  A("P0: ...but a user cannot UPDATE enrolments or enrol someone else",denied(e6b)&&denied(e6c),`${e6b} | ${e6c}`);
  const rd=await asUser(ME,()=>q("select count(*)::int n from program_enrollments"));
  A('P0: a user still reads their own enrolment (and only theirs)',rd[0].n===1,JSON.stringify(rd));

  // reads keep working
  const own=await asUser(ME,()=>q("select balance from hapi_tokens"));
  A("P0: a user can still read their own wallet, and only their own (balance 100, 1 row)",own.length===1&&own[0].balance===100,JSON.stringify(own));
  const cw=await asUser(ME,()=>q("select redeemable_cents from creator_wallets where creator_id=$1",[ME]));
  const sks=await asUser(ME,()=>q("select 1 from creator_streaks"));
  A('P0: a user can still read creator_wallets (leaderboard) and streaks',cw.length===1&&sks.length>=1,JSON.stringify([cw,sks]));
  // still-allowed benign edits (the safe columns)
  const t1=await asUser(CR,()=>throws(()=>db.query("update creator_goals set title='renamed' where id=$1",[gl])));
  const t2=await asUser(CR,()=>throws(()=>db.query("update challenge_entries set title='renamed' where id=$1",[ent])));
  A('P0: a creator can still edit the title of their own goal / entry (column grants, not a blanket revoke)',t1===null&&t2===null,`${t1} | ${t2}`);

  // the RPC path still works and its trigger side effects still land
  const before=await bal(ME);
  await svc(()=>db.query("select credit_tokens_once('k_r5_buy',$1,'purchase',50,'r5','{}'::jsonb)",[ME]));
  A('P0: RPC path - credit_tokens_once (service_role) still credits the wallet (100 -> 150)',before===100&&await bal(ME)===150,await bal(ME));
  await svc(()=>db.query("select wallet_add($1,0,25)",[ME]));
  const w2=await one("select redeemable_cents r from creator_wallets where creator_id=$1",[ME]);
  A('P0: RPC path - wallet_add still moves creator cents (50 -> 75)',w2.r===75,w2.r);
  const sk=await svc(()=>one("select * from update_creator_streak($1,'post')",[ME]));
  A('P0: RPC path - update_creator_streak still runs',sk.current_streak===1,JSON.stringify(sk));
  const ent2=(await one("insert into challenge_entries(challenge_id,creator_id,title,status) values($1,$2,'e5b','approved') returning id",[ch,OTHER])).id;
  const pv=await svc(()=>one("select cast_paid_vote($1,$2,$3,5) r",[ME,ch,ent2]));
  const tv2=await one("select vote_count v, token_vote_total t from challenge_entries where id=$1",[ent2]);
  A('P0: RPC path - cast_paid_vote debits and the (definer) vote trigger still updates the entry tally (1 vote, 5 tokens)',pv.r.status==='voted'&&tv2.v===1&&tv2.t===5,JSON.stringify([pv.r,tv2]));
  const ip=await svc(()=>db.query("select 1 from record_token_movement($1,'adjustment',0)",[ME]).then(()=>null).catch(e=>e.message));
  A('P0: service_role can still call record_token_movement',ip===null,ip);

  // no write policy is left for anon/authenticated on the tables that hold money
  const pol=await q(`select tablename, policyname, cmd from pg_policies where schemaname='public'
     and tablename in ('hapi_tokens','creator_wallets','creator_streaks','challenge_votes','goal_contributions')
     and cmd in ('ALL','INSERT','UPDATE','DELETE')`);
  A('P0: pg_policies has no ALL/INSERT/UPDATE/DELETE policy on hapi_tokens, creator_wallets, creator_streaks, challenge_votes, goal_contributions',pol.length===0,JSON.stringify(pol));
  const gr=await q(`select table_name, privilege_type from information_schema.role_table_grants
     where table_schema='public' and grantee in ('anon','authenticated')
       and table_name in ('hapi_tokens','creator_wallets','creator_streaks','challenge_votes','goal_contributions')
       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`);
  A('P0: anon/authenticated hold no INSERT/UPDATE/DELETE/TRUNCATE grant on those tables (belt and braces behind RLS)',gr.length===0,JSON.stringify(gr));
  const anon=await (async()=>{await db.exec('SET ROLE anon');try{return await throws(()=>db.query("update hapi_tokens set balance=1"))}finally{await db.exec('RESET ROLE')}})();
  A('P0: anon cannot UPDATE hapi_tokens either',denied(anon),anon);
  const dfn=await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
     and p.proname in ('on_goal_contribution_check_complete','on_challenge_vote_inserted','on_profile_created_create_wallet')
     and not (p.prosecdef and coalesce(p.proconfig::text,'') like '%search_path=public, pg_temp%')`);
  A('P0: the three SECURITY DEFINER trigger functions behind these tables pin search_path = public, pg_temp',dfn.length===0,dfn.map(r=>r.proname).join());
}

// ===== P1: restore and fulfil are mutually exclusive per checkout ref =====
{
  const ch=(await one("insert into channels(creator_id,name,slug) values($1,'c5','c-r5') returning id",[CR])).id;
  const vid=(await one("insert into videos(channel_id,creator_id,title,price) values($1,$2,'v5',10) returning id",[ch,CR])).id;
  const credits=async(u)=>{const r=await one("select gift_balance g, loan_balance l from app_credits where user_id=$1",[u]);return r?{g:Number(r.g),l:Number(r.l)}:{g:0,l:0}};
  const setCredits=(u,g,l)=>db.query("insert into app_credits(user_id,gift_balance,loan_balance) values($1,$2,$3) on conflict (user_id) do update set gift_balance=$2, loan_balance=$3",[u,g,l]);
  // what /api/credits/checkout does: claim, then debit (balance + ledger rows), then create the Stripe session
  const startCheckout=async(buyer,ref,gift,loan)=>{
    await svc(()=>db.query("select claim_credit_checkout($1,$2,$3,$4,$5,2100)",[buyer,vid,ref,gift,loan]));
    const c=await credits(buyer); await setCredits(buyer,c.g-gift,c.l-loan);
    if(gift>0) await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after,reference_id,reference_type) values($1,'spend_gift',$2,$3,$4,$5,'ppv')",[buyer,gift,c.g-gift,c.l-loan,vid]);
    if(loan>0) await db.query("insert into credit_ledger(user_id,entry_type,amount,gift_balance_after,loan_balance_after,reference_id,reference_type) values($1,'spend_loan',$2,$3,$4,$5,'ppv')",[buyer,loan,c.g-gift,c.l-loan,vid]);
  };
  const expire=(buyer)=>db.exec(`update pending_credit_checkouts set expires_at=now()-interval '1 minute', created_at=now()-interval '40 minutes' where buyer_id='${buyer}'`);
  const fulfil=(buyer,ref,gift,loan)=>svc(async()=>(await one("select fulfil_credit_ppv($1,$2,$3,$4,$5,$6,600) r",[buyer,vid,ref,gift,loan,'pi_'+ref])).r).catch(e=>({status:'ERROR',message:e.message}));
  const owns=async(buyer)=>(await one("select count(*)::int n from purchases where buyer_id=$1 and video_id=$2",[buyer,vid])).n;

  // --- the review's scenario: paid at minute 30, completed webhook fails once, sweeper / next tap restores, Stripe retries ---
  await setCredits(ME,5,1);
  await startCheckout(ME,'r5-a',4,1);
  await expire(ME);
  await db.exec(`update credit_ledger set created_at=now()-interval '39 minutes' where user_id='${ME}' and reference_type='ppv'`);
  const peek=(await svc(()=>one("select peek_credit_checkout($1,$2) r",[ME,vid]))).r;     // the buyer taps Buy again at minute 35 -> settle -> restore
  const afterRestore=await credits(ME);
  A('P1: (precondition) the late tap/sweeper restores the credits (1,0 -> 5,1) before the webhook retry arrives',peek.status==='none'&&afterRestore.g===5&&afterRestore.l===1&&(await owns(ME))===0,JSON.stringify([peek,afterRestore]));
  const f1=await fulfil(ME,'r5-a',4,1);                                                  // Stripe's retry of checkout.session.completed
  const end=await credits(ME);
  A('P1: THE BUG - Stripe retry after the restore: buyer gets the video AND the credits are taken again (no free video)',
     f1.status==='fulfilled_after_restore'&&(await owns(ME))===1&&end.g===1&&end.l===0&&Number(f1.shortfall)===0,JSON.stringify([f1,end]));
  const led=(await one("select count(*)::int n from credit_ledger where user_id=$1 and notes like 'Credits taken again%'",[ME])).n;
  const st=(await one("select outcome from credit_checkout_outcomes where checkout_ref='r5-a'"))?.outcome;
  A("P1: the re-debit is in the ledger (spend_gift + spend_loan) and the state row says 'fulfilled_after_restore'",led===2&&st==='fulfilled_after_restore',`ledger=${led} outcome=${st}`);
  const f1b=await fulfil(ME,'r5-a',4,1);
  const end2=await credits(ME);
  A('P1: a replay of the same webhook is a no-op (status already, no second re-debit, still one purchase)',f1b.status==='already'&&end2.g===1&&end2.l===0&&(await owns(ME))===1,JSON.stringify([f1b,end2]));

  // --- the other order: paid and fulfilled first, then the sweeper tries to restore ---
  await db.query("delete from purchases where buyer_id=$1",[ME]);
  await setCredits(ME,5,1);
  await startCheckout(ME,'r5-b',4,1);
  const f2=await fulfil(ME,'r5-b',4,1);
  const late=(await svc(()=>one("select restore_credits_once('credit-checkout:r5-b:restore',$1,4,1,'r5-b','late') r",[ME]))).r;
  const c2=await credits(ME);
  A('P1: fulfil first, then a restore under the same key: restore refuses (false), credits stay spent (1,0), video kept',
     f2.status==='fulfilled'&&late===false&&c2.g===1&&c2.l===0&&(await owns(ME))===1,JSON.stringify([f2,late,c2]));
  // the pending claim was released by the fulfilment, so a later expiry/sweep has nothing to settle
  const left=(await one("select count(*)::int n from pending_credit_checkouts where buyer_id=$1",[ME])).n;
  A('P1: fulfilment releases the (buyer, video) claim in the same transaction',left===0,left);

  // --- an expired claim that is swept AFTER the purchase was fulfilled never restores ---
  await db.query("delete from purchases where buyer_id=$1",[OTHER]);
  await setCredits(OTHER,5,0);
  await startCheckout(OTHER,'r5-c',3,0);
  const f3=await fulfil(OTHER,'r5-c',3,0); if(f3.status==='ERROR') console.log('DBG fulfil r5-c:',f3.message);
  await db.exec(`insert into pending_credit_checkouts(buyer_id,video_id,checkout_ref,gift_used,loan_used,expires_at,created_at) values('${OTHER}','${vid}','r5-c',3,0,now()-interval '1 minute',now()-interval '40 minutes')`);
  const sw=(await svc(()=>one("select settle_credit_checkout($1,$2) r",[OTHER,vid]))).r;
  const c3=await credits(OTHER);
  A("P1: settle after fulfilment returns 'owned'/'already_settled' and restores nothing (credits stay 2)",['owned','already_settled'].includes(sw)&&c3.g===2,`${sw} ${JSON.stringify(c3)}`);

  // --- restore happened, buyer then spent the credits elsewhere: video delivered, shortfall to money_exceptions ---
  await db.query("delete from purchases where buyer_id=$1",[CR]);
  await setCredits(CR,4,1);
  await startCheckout(CR,'r5-d',4,1);
  await expire(CR);
  await db.exec(`update credit_ledger set created_at=now()-interval '39 minutes' where user_id='${CR}' and reference_type='ppv'`);
  await svc(()=>one("select peek_credit_checkout($1,$2) r",[CR,vid]));
  await setCredits(CR,1,0);                                                              // spent 4 gift + 1 loan on something else
  const f4=await fulfil(CR,'r5-d',4,1);
  const c4=await credits(CR);
  const ex=await q("select kind, amount::numeric a, resolved_at from money_exceptions where dedupe_key='restored-then-paid:r5-d'");
  A("P1: credits already spent elsewhere: video still delivered, only what is left is taken (1,0 -> 0,0), shortfall 4 logged as 'restored_then_paid'",
     f4.status==='fulfilled_after_restore'&&(await owns(CR))===1&&c4.g===0&&c4.l===0&&Number(f4.shortfall)===4&&ex.length===1&&ex[0].kind==='restored_then_paid'&&Number(ex[0].a)===4&&ex[0].resolved_at===null,JSON.stringify([f4,c4,ex]));

  // --- an old restore done before this migration (money_effects only, no state row) is recognised ---
  await db.query("delete from purchases where buyer_id=$1",[ME]);
  await setCredits(ME,5,0);
  await startCheckout(ME,'r5-e',4,0);
  await db.query("insert into money_effects(effect_key,kind) values('credit-checkout:r5-e:restore','credit_restore')");
  await setCredits(ME,5,0);                                                              // as if the old restore had given the 4 back
  const f5=await fulfil(ME,'r5-e',4,0);
  A("P1: a restore made before this migration (only a money_effects key) is treated as restored: fulfil re-debits",f5.status==='fulfilled_after_restore'&&(await credits(ME)).g===1,JSON.stringify([f5,await credits(ME)]));

  // --- normal path, nothing restored ---
  await db.query("delete from purchases where buyer_id=$1",[OTHER]);
  await setCredits(OTHER,5,0);
  await startCheckout(OTHER,'r5-f',2,0);
  const f6=await fulfil(OTHER,'r5-f',2,0);
  A("P1: plain paid checkout: status 'fulfilled', credits stay spent (3), purchase credit_funded",
     f6.status==='fulfilled'&&(await credits(OTHER)).g===3&&(await one("select credit_funded c from purchases where buyer_id=$1",[OTHER])).c===true,JSON.stringify(f6));
  // an ordinary abandoned checkout still restores (the fix must not break the restore)
  await db.query("delete from purchases where buyer_id=$1",[OTHER]);
  await setCredits(OTHER,5,0);
  await startCheckout(OTHER,'r5-g',2,0);
  const r7=(await svc(()=>one("select restore_credits_once('credit-checkout:r5-g:restore',$1,2,0,'r5-g','expired') r",[OTHER]))).r;
  A('P1: an ordinary expired checkout still restores its credits (3 -> 5) exactly once',r7===true&&(await credits(OTHER)).g===5&&(await svc(()=>one("select restore_credits_once('credit-checkout:r5-g:restore',$1,2,0,'r5-g','again') r",[OTHER]))).r===false,JSON.stringify(await credits(OTHER)));

  const pr=[];
  for(const r of ['anon','authenticated']){
    const x=await (async()=>{await db.exec(`SET ROLE ${r}`);try{return await throws(()=>db.query("select fulfil_credit_ppv($1,$2,'x',1,0,'pi',1)",[ME,vid]))}finally{await db.exec('RESET ROLE')}})();
    if(!denied(x))pr.push(r+':'+x);
  }
  const t=await asUser(ME,()=>throws(()=>db.query('select * from credit_checkout_outcomes')));
  A('P1: anon / authenticated cannot call fulfil_credit_ppv and cannot read credit_checkout_outcomes',pr.length===0&&denied(t),pr.join('; ')+' | '+t);
}

// ===== P4: payout request cannot be requested twice =====
{
  const pay=(u,c)=>svc(async()=>(await one("select request_creator_payout($1,$2) r",[u,c])).r);
  const w=async(u)=>one("select redeemable_cents r, payout_status s from creator_wallets where creator_id=$1",[u]);
  await svc(()=>db.query("select wallet_add($1,0,1000)",[OTHER]));           // 1000 redeemable
  const a0=await pay(OTHER,400);
  A("P4: no Stripe Connect account -> 'stripe_required', wallet untouched",a0.status==='stripe_required'&&(await w(OTHER)).r===1000,JSON.stringify(a0));
  await db.query("update creator_wallets set stripe_connect_id='acct_r5' where creator_id=$1",[OTHER]);
  const small=await svc(()=>throws(()=>db.query("select request_creator_payout($1,50)",[OTHER])));
  A('P4: below the 100 cent minimum is refused by the function itself',/minimum payout/.test(small||''),small);
  const over=await pay(OTHER,1500);
  A("P4: more than the balance -> 'insufficient' with the available amount",over.status==='insufficient'&&over.available===1000&&(await w(OTHER)).r===1000,JSON.stringify(over));
  const first=await pay(OTHER,1000);
  const second=await pay(OTHER,1000);
  const third=await pay(OTHER,100);
  const wl=await w(OTHER);
  const lg=(await one("select count(*)::int n from token_ledger where user_id=$1 and metadata->>'type'='payout_request'",[OTHER])).n;
  A("P4: two requests for the same balance: the first is 'ok', every later one is 'pending'; balance 1000 -> 0 ONCE, one request logged",
     first.status==='ok'&&second.status==='pending'&&third.status==='pending'&&wl.r===0&&wl.s==='pending'&&lg===1,JSON.stringify([first,second,third,wl,lg]));
  const nf2=await pay('00000000-0000-0000-0000-00000000dead',200);
  A("P4: unknown creator -> 'not_found'",nf2.status==='not_found',JSON.stringify(nf2));
  // the lock itself: the function must take FOR UPDATE on the wallet row (real contention is not reproducible on one PGlite connection)
  const def=(await one("select pg_get_functiondef('public.request_creator_payout(uuid,int)'::regprocedure) d")).d;
  A('P4: request_creator_payout reads the wallet FOR UPDATE, is SECURITY DEFINER with search_path pinned',/FOR UPDATE/.test(def)&&/SECURITY DEFINER/.test(def)&&/search_path/.test(def));
  const pr=[];
  for(const r of ['anon','authenticated']){
    const x=await (async()=>{await db.exec(`SET ROLE ${r}`);try{return await throws(()=>db.query("select request_creator_payout($1,500)",[OTHER]))}finally{await db.exec('RESET ROLE')}})();
    if(!denied(x))pr.push(r+':'+x);
  }
  A('P4: anon / authenticated cannot call request_creator_payout (a user cannot request a payout for someone else)',pr.length===0,pr.join('; '));
}

{
  const nf=results.filter(r=>!r.ok).length;
  log(`\nTOTAL(r5) ${results.length} assertions, ${results.length-nf} pass, ${nf} fail`);
  fs.writeFileSync('results5.json',JSON.stringify({results},null,1));
  process.exitCode=nf?1:0;
}
