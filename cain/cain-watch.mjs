// Cain's five-minute watch on OnlineForms and on Abel, run by launchd on Cain's MacBook Pro
// (~/Library/LaunchAgents/app.onlineforms.cain-watch.plist). Reads status.json and abel.json
// from this public repository and tells Craig on Telegram, through Cain's own OpenClaw, only
// when something changes. No secrets are held here. Set DRY_RUN=1 to print instead of send.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
const DIR=homedir()+'/onlineforms-watch', STATE=DIR+'/cain-state.json';
const OPENCLAW=homedir()+'/.openclaw/bin/openclaw', CRAIG='5741519407';
const QUIET_MIN=25, OFFLINE_REPORT_MIN=15;
const PAGE='https://wowblaauw.github.io/onlineforms-status/';
mkdirSync(DIR,{recursive:true});
const state=existsSync(STATE)?JSON.parse(readFileSync(STATE,'utf8')):{};
const save=()=>writeFileSync(STATE,JSON.stringify(state,null,1)+'\n');
const uk=iso=>new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
function send(text){
 if(process.env.DRY_RUN){console.log('WOULD SEND: '+text);return true;}
 try{execFileSync(OPENCLAW,['message','send','--channel','telegram','--target',CRAIG,'-m',text],{stdio:'pipe',timeout:60000});console.log('SENT: '+text);return true;}
 catch(e){console.error('SEND FAILED: '+String(e.stderr||e.message).slice(0,300));return false;}
}
async function file(name){
 // GitHub's API serves the current file; the raw and Pages addresses are cached for minutes.
 const r=await fetch(`https://api.github.com/repos/wowblaauw/onlineforms-status/contents/${name}`,{headers:{accept:'application/vnd.github.raw+json','user-agent':'cain-onlineforms-watch'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(name+': HTTP '+r.status);
 return JSON.parse(await r.text());
}
const now=Date.now();
let status,abel;
try{[status,abel]=await Promise.all([file('status.json'),file('abel.json')]);}
catch(e){
 // Cannot reach GitHub: most likely the shared broadband. Note when it started; say nothing yet.
 state.offlineSince??=new Date(now).toISOString(); save();
 console.log('Cannot reach GitHub ('+e.message+') since '+state.offlineSince); process.exit(0);
}
if(state.offlineSince){
 const mins=Math.round((now-Date.parse(state.offlineSince))/60000);
 if(mins>=OFFLINE_REPORT_MIN)send(`OnlineForms watch: back online. Cain could not reach the internet for about ${mins} minutes (from ${uk(state.offlineSince)}), so nothing was being watched from the workshop in that time. OnlineForms is ${status.ok?'working':'NOT working'} now.`);
 delete state.offlineSince;
}
// 1. OnlineForms itself
if(state.siteOk===undefined)state.siteOk=status.ok;
else if(state.siteOk&&!status.ok){
 const bad=status.checks.filter(c=>!c.ok).map(c=>`${c.name} (${c.detail})`).join(', ');
 if(send(`OnlineForms PROBLEM since ${uk(status.since)}: ${bad}. Checked by ${status.by==='abel'?'Abel':'GitHub'}. To tell customers: Operations page, Service notice. Status page: ${PAGE}`))state.siteOk=false;
}else if(!state.siteOk&&status.ok){
 if(send(`OnlineForms recovered at ${uk(status.since)}: all checks working again. Remember to clear any service notice you posted.`))state.siteOk=true;
}
// 2. Abel, the checker
const quietMin=Math.round((now-Date.parse(abel.at))/60000);
if(state.abelOk===undefined)state.abelOk=quietMin<QUIET_MIN;
else if(state.abelOk&&quietMin>=QUIET_MIN){
 if(send(`OnlineForms watch: Abel (the iMac checker) has gone quiet. Last report ${uk(abel.at)}, ${quietMin} minutes ago. Likely: the iMac is off, asleep or restarting, or its scheduled job stopped. GitHub's slower backstop is still checking the site.`))state.abelOk=false;
}else if(!state.abelOk&&quietMin<QUIET_MIN){
 if(send(`OnlineForms watch: Abel is reporting again (last report ${uk(abel.at)}).`))state.abelOk=true;
}
state.lastRun=new Date(now).toISOString(); save();
console.log(JSON.stringify({siteOk:status.ok,by:status.by,abelMinutes:quietMin}));
