// Share one isolated emulator process, but never run resetting suites concurrently.
const {spawnSync}=require('node:child_process');
async function main() { for (const file of process.argv.slice(2)) {
  const host=process.env.FIRESTORE_EMULATOR_HOST;
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host ?? '')) throw Error('Isolated loopback emulator required.');
  // Code Attribution — WS5 isolated testing (Nyiko Masinge, ST10434307).
  // This test-only reset follows the documented Firestore Emulator REST clear endpoint.
  // Firebase (n.d.) 'Connect your app to the Cloud Firestore Emulator'.
  // https://firebase.google.com/docs/emulator-suite/connect_firestore
  // Accessed: 5 October 2026.
  const reset=await fetch(`http://${host}/emulator/v1/projects/demo-said-5ce3e/databases/(default)/documents`,{method:'DELETE'});
  if(!reset.ok) throw Error('Could not reset isolated test database.');
  console.log(`Running ${file}`);
  const result=spawnSync(process.execPath,['--test',file],{stdio:'inherit',env:process.env});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status ?? 1);
} }
main().catch(error=>{console.error(error.message);process.exitCode=1;});
