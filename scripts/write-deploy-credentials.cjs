// Invoked only in a protected GitHub deployment environment. Never logs credential contents.
const fs=require('node:fs'),path=require('node:path');
function validateCredential(raw,projectId){
  if(!projectId||projectId.startsWith('demo-'))throw Error('A real FIREBASE_PROJECT_ID is required.');
  let data;try{data=JSON.parse(raw);}catch{throw Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON.');}
  if(data.type!=='service_account'||data.project_id!==projectId||typeof data.client_email!=='string'||typeof data.private_key!=='string'||!data.private_key.includes('BEGIN PRIVATE KEY'))throw Error('Deployment service account must match FIREBASE_PROJECT_ID.');
  return data;
}
if(require.main===module){
  const data=validateCredential(process.env.FIREBASE_SERVICE_ACCOUNT_JSON,process.env.FIREBASE_PROJECT_ID);
  const destination=path.join(process.env.RUNNER_TEMP,'said-deploy-credential.json');
  fs.writeFileSync(destination,JSON.stringify(data),{mode:0o600});
  fs.appendFileSync(process.env.GITHUB_ENV,`GOOGLE_APPLICATION_CREDENTIALS=${destination}\n`);
}
module.exports={validateCredential};
