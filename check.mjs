// Checks onlineforms.app from outside and writes status.json for the status page.
// Run every five minutes by Abel on the iMac (CHECKER=abel, see abel/README.md), and as a
// slower backstop by GitHub's scheduler (.github/workflows/check.yml). No secrets are used.
import {readFileSync,writeFileSync,existsSync,appendFileSync} from 'node:fs';
const SITE='https://onlineforms.app';
const checks=[
 {id:'site',name:'Website',url:SITE+'/',ok:(r,t)=>r.status===200&&t.includes('OnlineForms')},
 {id:'signin',name:'Sign-in page',url:SITE+'/signin',ok:(r,t)=>r.status===200&&t.includes('Email')},
 {id:'data',name:'Forms and responses (database)',url:SITE+'/api/status',ok:(r,t)=>{try{return r.status===200&&'notice' in JSON.parse(t);}catch{return false;}}},
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function once(c){
 const started=Date.now();
 try{const r=await fetch(c.url+(c.url.includes('?')?'&':'?')+'check='+started,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'user-agent':'onlineforms-status-check'}});const t=await r.text();return {ok:c.ok(r,t),detail:'HTTP '+r.status,ms:Date.now()-started,text:t};}
 catch(e){return {ok:false,detail:e.name==='TimeoutError'?'no answer within 15 seconds':'could not connect',ms:Date.now()-started,text:''};}
}
// Three tries, ten seconds apart, so one dropped connection does not raise an alarm.
async function run(c){let last;for(let i=0;i<3;i++){last=await once(c);if(last.ok)break;if(i<2)await sleep(10000);}return last;}
const CHECKER=process.env.CHECKER||'github';
// Abel runs on the workshop broadband. If two well-known sites cannot be reached either, the
// problem is the local connection, not OnlineForms: write nothing and raise no alarm.
if(CHECKER==='abel'){
 const reach=async u=>{try{const r=await fetch(u,{signal:AbortSignal.timeout(10000)});return r.status<500;}catch{return false;}};
 if(!(await reach('https://www.google.com/generate_204'))&&!(await reach('https://www.apple.com/library/test/success.html'))){console.log('LOCAL CONNECTION DOWN: nothing written');process.exit(0);}
}
const results=[];let notice=null;
for(const c of checks){const r=await run(c);results.push({id:c.id,name:c.name,ok:r.ok,detail:r.detail,ms:r.ms});if(c.id==='data'&&r.ok){try{notice=JSON.parse(r.text).notice??null;}catch{}}}
const now=new Date().toISOString(),allOk=results.every(r=>r.ok);
const previous=existsSync('status.json')?JSON.parse(readFileSync('status.json','utf8')):null;
const changed=!previous||previous.ok!==allOk||JSON.stringify(previous.notice??null)!==JSON.stringify(notice);
const status={ok:allOk,checkedAt:now,by:CHECKER,since:changed||!previous?.since?now:previous.since,checks:results,notice};
// Write when something changed, or every half hour so the page can show the check is alive.
const stale=!previous||Date.now()-Date.parse(previous.checkedAt)>29*60*1000;
if(changed||stale)writeFileSync('status.json',JSON.stringify(status,null,1)+'\n');
// Abel's heartbeat: GitHub's backstop raises an alert if this stops being refreshed.
// Refreshed at least every 15 minutes (Cain alerts at 25 minutes, GitHub at 60).
if(CHECKER==='abel'){
 let last=0;try{last=Date.parse(JSON.parse(readFileSync('abel.json','utf8')).at)||0;}catch{}
 if(changed||stale||Date.now()-last>14*60*1000)writeFileSync('abel.json',JSON.stringify({at:now,ok:allOk},null,1)+'\n');
}
const out=process.env.GITHUB_OUTPUT;
if(out)appendFileSync(out,`ok=${allOk}\nwas_ok=${previous?previous.ok:true}\nwrote=${changed||stale}\nsummary=${results.map(r=>r.name+': '+(r.ok?'working':'PROBLEM ('+r.detail+')')).join('; ')}\n`);
console.log(JSON.stringify(status));
