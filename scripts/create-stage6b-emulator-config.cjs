// Allocates isolated loopback test ports without stopping existing emulators or changing repo config.
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
async function main() {
  const servers=[];
  try {
    for(let index=0;index<6;index++) {
      const server=net.createServer();servers.push(server);
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    }
    const [auth,firestore,websocketPort,hub,logging,functions]=servers.map(server=>server.address().port);
    const root=path.resolve(__dirname,'..');
    const config={firestore:{rules:path.join(root,'firestore.rules'),indexes:path.join(root,'firestore.indexes.json')},
      emulators:{auth:{host:'127.0.0.1',port:auth},firestore:{host:'127.0.0.1',port:firestore,websocketPort},
        hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}};
    if (process.argv.includes('--functions')) {
      config.functions=[{source:path.relative(os.tmpdir(),path.join(root,'functions')),codebase:'operational',runtime:'nodejs22'}];
      config.emulators.functions={host:'127.0.0.1',port:functions};
    }
    const output=path.join(os.tmpdir(),'said-stage6b-tests.firebase.json');
    fs.writeFileSync(output,JSON.stringify(config,null,2));console.log(output);
  } finally {
    await Promise.all(servers.filter(server=>server.listening).map(server=>new Promise(resolve=>server.close(resolve))));
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
