// #881/#896: recipe_interactions owner-only RLS. Run: node test6.mjs   (SKIP_R6=1 = failing-first baseline)
import {build,dir,NEW,R5} from './apply.mjs'; import fs from 'fs';
const R6='20261110_recipe_interactions_rls_881.sql';
const {db}=await build(()=>{});
await db.exec(fs.readFileSync(dir+'/'+NEW,'utf8')); await db.exec(fs.readFileSync(dir+'/'+R5,'utf8'));
const res=[]; const A=(n,ok,d='')=>{res.push(ok);console.log(`${ok?'PASS':'FAIL'}  ${n}${d?'  ['+String(d).slice(0,160)+']':''}`)};
const throws=async(fn)=>{try{await fn();return null}catch(e){return e.message}};
await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$`);
const as=async(role,uid,fn)=>{await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${uid||''}',false)`);try{return await fn()}finally{await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)")}};
if(!process.env.SKIP_R6){
  for(const n of [1,2]){const e=await throws(()=>db.exec(fs.readFileSync(dir+'/'+R6,'utf8')));A(`R6 migration applies (run ${n})`,!e,e)}
}
const [ME,OTHER]=['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2'];
for(const [i,u] of [ME,OTHER].entries()){await db.query("insert into auth.users(id,email) values($1,$2)",[u,`r6u${i}@x.test`]);await db.query("insert into public.profiles(id,username,display_name) values($1,$2,$2) on conflict (id) do nothing",[u,`r6user${i}`])}
const vid=(await db.query("insert into videos(id,creator_id,title) values(gen_random_uuid(),$1,'t') returning id",[ME]).catch(async()=>await db.query("select id from videos limit 1"))).rows[0]?.id;
await db.query("insert into recipe_interactions(user_id,video_id,servings) values($1,$2,2)",[OTHER,vid]);
const n=async(role,u)=>as(role,u,async()=>(await db.query("select count(*)::int c from recipe_interactions")).rows[0].c);
A("anon cannot read rows",/permission denied|row-level/.test(await as('anon','',()=>throws(()=>db.query("select * from recipe_interactions")))||''));
A("authenticated user cannot see another user's row",await n('authenticated',ME)===0);
A("owner sees own row",await n('authenticated',OTHER)===1);
A("user cannot insert a row for someone else",/row-level/.test(await as('authenticated',ME,()=>throws(()=>db.query("insert into recipe_interactions(user_id,video_id) values($1,$2)",[OTHER,vid])))||''));
A("user cannot update another user's row (0 rows)",(await as('authenticated',ME,()=>db.query("update recipe_interactions set servings=99 where user_id=$1",[OTHER]))).affectedRows===0);
A("owner can update own row",(await as('authenticated',OTHER,()=>db.query("update recipe_interactions set servings=3 where user_id=$1",[OTHER]))).affectedRows===1);
const bad=res.filter(x=>!x).length; console.log(bad?`${bad} FAILED`:'ALL PASS'); process.exit(bad?1:0);
