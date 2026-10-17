// RETIRED Stage 7C Functions-emulator evidence. Superseded by spark-progress-emulator.test.cjs; excluded from active release gates.
const test=require('node:test'),assert=require('node:assert/strict');
const req=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=req('firebase-admin/app');
const {getFirestore,FieldValue}=req('firebase-admin/firestore');
test('actual Functions emulator observes rapid progress snapshots with durable system provenance',async()=>{
  assert(process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:'));
  const app=initializeApp({projectId:'demo-said-5ce3e'},'stage7c-trigger'),db=getFirestore(app);
  try {
    const ref=db.doc('employees/trigger-service/taskProgress/trigger-work');
    await ref.create({scheduledWorkId:'trigger-work',weekStart:'2026-10-05',publicationVersion:'trigger-v1',status:'In Progress',updatedAt:FieldValue.serverTimestamp()});
    await ref.update({status:'Completed',updatedAt:FieldValue.serverTimestamp()});
    let records=[];
    for(let i=0;i<150;i++){records=(await db.collection('operationalEvents').where('scheduledWorkId','==','trigger-work').get()).docs.map(d=>d.data());if(records.length===2)break;await new Promise(r=>setTimeout(r,200));}
    assert.equal(records.length,2);assert.deepEqual(records.map(r=>r.type).sort(),['TaskCompleted','TaskStarted']);
    assert(records.every(r=>r.actorProvenance.startsWith('system/service:')&&r.progressOwnerUid==='trigger-service'));
    assert(records.every(r=>r.occurredAt.toMillis()<=r.recordedAt.toMillis()));
  }finally{await deleteApp(app);}
});
