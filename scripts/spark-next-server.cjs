// Test-only Next HTTP host. One owned process permits portable, bounded cleanup.
const path=require('node:path'),http=require('node:http'),{createRequire}=require('node:module');
const web=path.resolve(__dirname,'../SAID Ops/web-app'),req=createRequire(path.join(web,'package.json'));
const port=Number(process.argv[2]),app=req('next')({dev:true,dir:web,hostname:'127.0.0.1',port});
let server;
app.prepare().then(()=>{server=http.createServer(app.getRequestHandler());server.listen(port,'127.0.0.1');}).catch(error=>{console.error(error);process.exitCode=1;});
async function close(){server?.closeAllConnections();server?.close();await app.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
