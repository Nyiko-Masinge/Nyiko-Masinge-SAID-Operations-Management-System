const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
function validateWebEnv(env,projectId){
  for(const name of ['NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID'])if(!env[name]||/^(your-|fake|demo-)/i.test(env[name]))throw Error(`Configure real ${name} in Vercel.`);
  if(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==projectId||env.SAID_FIREBASE_PROJECT_ID!==projectId)throw Error('Vercel and Firebase deployment projects must match.');
  for(const name of ['NEXT_PUBLIC_ROSTER_BACKEND','NEXT_PUBLIC_MONITORING_BACKEND','SAID_ROSTER_BACKEND'])if(env[name]!=='firestore')throw Error(`${name} must be firestore for delivery.`);
  if((env.NEXT_PUBLIC_FIREBASE_EMULATORS_ENABLED && env.NEXT_PUBLIC_FIREBASE_EMULATORS_ENABLED!=='false')||(env.SAID_FIREBASE_EMULATORS_ENABLED && env.SAID_FIREBASE_EMULATORS_ENABLED!=='false')||Object.entries(env).some(([k,v])=>/EMULATOR_(HOST|PORT|URL)$/.test(k)&&v))throw Error('Delivery cannot use emulator endpoints.');
  const raw=env.SAID_FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw Error('Configure server-only SAID_FIREBASE_SERVICE_ACCOUNT_JSON in Vercel.');
  require('./write-deploy-credentials.cjs').validateCredential(raw,projectId);
}
if(require.main===module){
  const requireWeb=createRequire(path.resolve(__dirname,'../SAID Ops/web-app/package.json'));
  const {processEnv}=requireWeb('@next/env');
  const expectedProject=process.env.FIREBASE_PROJECT_ID;
  const file=process.argv[2];if(!file)throw Error('Provide the Vercel-pulled env file.');
  const {parsedEnv}=processEnv([{path:file,contents:fs.readFileSync(file,'utf8'),env:{}}],process.cwd(),console,true);
  validateWebEnv(parsedEnv,expectedProject);
  console.log('Delivery configuration validated; credential values were not printed.');
}
module.exports={validateWebEnv};
