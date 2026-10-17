const {spawnSync}=require('node:child_process'),fs=require('node:fs');
function classify(files,event,ref,baseRef) {
  return {heavy:event==='workflow_dispatch'||ref==='refs/heads/main'||ref==='refs/heads/development'||baseRef==='main'||files.some(f=>/^(functions\/|security-tests\/|scripts\/|firestore\.|firebase\.json|\.github\/|SAID Ops\/(web-app\/lib\/|web-app\/app\/api\/|mobile-app\/lib\/|mobile-app\/data\/))/.test(f)),mobile:files.some(f=>f.startsWith('SAID Ops/mobile-app/'))};
}
if(require.main===module){
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const base=event.pull_request?.base.sha??event.before;
  const args=base&&!/^0+$/.test(base)?['diff','--name-only',base,'HEAD']:['ls-files'];
  const diff=spawnSync('git',args,{encoding:'utf8'});if(diff.status!==0)throw Error('Cannot establish changed files.');
  const values=classify(diff.stdout.trim().split(/\r?\n/),process.env.GITHUB_EVENT_NAME,process.env.GITHUB_REF,event.pull_request?.base.ref);
  fs.appendFileSync(process.env.GITHUB_OUTPUT,Object.entries(values).map(([k,v])=>`${k}=${v}\n`).join(''));
}
module.exports={classify};
