// Run from SAID Ops/web-app: node tests/roster-final.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
};

require('./roster-milestone3.cjs');
require('./roster-milestone4.cjs');
// Use native iteration for malformed recurrence regression checks.
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
};
for (const filename of Object.keys(require.cache)) {
  if (filename.endsWith('.ts') && filename.includes('roster')) delete require.cache[filename];
}

const { validateTemplate } = require('../lib/roster/templates.ts');
const { weekSummary } = require('../lib/roster/summary.ts');
const { schedulingConflicts, getCoverage } = require('../lib/roster/rules.ts');
const { createScheduledWork, editScheduledWork, reassignOnWork } = require('../lib/roster/operations.ts');
const { publishRoster } = require('../lib/roster/publication.ts');

const template = { id: 't1', name: 'Kennel care', description: '', area: 'Kennel', time: '09:00', duration: '60 min', required: 2, recurrence: 'Daily', priority: 'Medium', isCritical: false, status: 'Active', requirements: [] };
assert.deepEqual(validateTemplate(template, []), { ok: true });
assert.equal(validateTemplate({ ...template, id: 't2', time: '25:00' }, [template]).code, 'INVALID_TIME');
assert.equal(validateTemplate({ ...template, id: 't2', duration: '0 min' }, [template]).code, 'INVALID_DURATION');
assert.equal(validateTemplate({ ...template, id: 't2', required: 0 }, [template]).code, 'INVALID_REQUIRED');
assert.equal(validateTemplate({ ...template, id: 't2', recurrence: 'Every fortnight' }, [template]).code, 'UNSUPPORTED_RECURRENCE');
assert.equal(validateTemplate({ ...template, name: 'Other' }, [template]).code, 'DUPLICATE_ID');
assert.equal(new Set(Array.from({ length: 1000 }, () => crypto.randomUUID())).size, 1000);

const input = { title: 'Kennel care', description: '', date: '2026-10-19', startTime: '09:00', endTime: '10:00', area: 'Kennel', required: 2 };
const created = createScheduledWork('a', input, [], [template]);
assert.equal(created.ok, true);
assert.equal(createScheduledWork('bad', { ...input, endTime: '08:00' }, [], [template]).code, 'INVALID_INTERVAL');
assert.equal(getCoverage(created.scheduled[0]).uncovered, true);
const failedEdit = editScheduledWork('a', { ...input, endTime: '08:00' }, created.scheduled, [template]);
assert.equal(failedEdit.ok, false);
assert.deepEqual(created.scheduled, createScheduledWork('a', input, [], [template]).scheduled);
const a = { ...created.scheduled[0], staffIds: ['person'] };
const b = { ...a, id: 'b', title: 'Pharmacy support', startTime: '09:30', endTime: '10:30' };
const c = { ...a, id: 'c', title: 'Next day', date: '2026-10-20', staffIds: ['other'] };
const items = [a, b, c];
assert.equal(schedulingConflicts(items).length, 1);
const summary = weekSummary('2026-10-19', items);
assert.deepEqual([summary.itemCount, summary.uncoveredCount, summary.understaffedCount, summary.fullyStaffedCount, summary.conflictCount, summary.requiredPositions, summary.filledPositions], [3, 0, 3, 0, 2, 6, 3]);
assert.deepEqual([summary.days[0].itemCount, summary.days[0].conflictCount, summary.days[1].itemCount], [2, 2, 1]);
const publication = publishRoster('2026-10-19', items, [template], {}, true);
assert.equal(publication.code, 'SCHEDULING_CONFLICT');
assert.equal(publication.conflict.first.title, 'Kennel care');
assert.equal(publication.conflict.second.title, 'Pharmacy support');
const staff = [{ id: 'person', availability: 'Available' }, { id: 'other', availability: 'Available' }];
const rejected = reassignOnWork('a', 'person', 'other', [a, { ...b, staffIds: ['other'] }], staff);
assert.equal(rejected.code, 'OVERLAP');
assert.deepEqual(a.staffIds, ['person']);
console.log('Final roster assertions passed: template validation, IDs, schedule isolation, coverage, conflict pairs, week summary, named publication conflict, reassignment atomicity.');

const { generateRecurringDuties, daysForRecurrence } = require('../lib/roster/generation.ts');
for (const recurrence of ['Daily', 'Mon, Wed, Fri', 'Tue, Thu']) {
  assert.equal(validateTemplate({ ...template, recurrence }, []).ok, true);
  assert.ok(Array.isArray(daysForRecurrence(recurrence)));
}
for (const recurrence of ['toString', 'constructor', '__proto__', 'Every fortnight', '']) {
  assert.equal(validateTemplate({ ...template, recurrence }, []).code, 'UNSUPPORTED_RECURRENCE');
  assert.equal(daysForRecurrence(recurrence), undefined);
  let outcome;
  assert.doesNotThrow(() => { outcome = generateRecurringDuties('2026-10-19', [], [{ ...template, recurrence }], () => 'new'); });
  assert.equal(outcome.created, 0);
  assert.equal(outcome.unsupported.length, 1);
}
const { hasSchedulingConflict } = require('../lib/roster/rules.ts');
const conflictItems = [a, b, { ...a, id: 'third', startTime: '09:45', endTime: '10:15' }, c];
const conflictSummary = weekSummary('2026-10-19', conflictItems);
const dailyConflictCount = conflictItems.filter(item => hasSchedulingConflict(item, conflictItems)).length;
assert.equal(dailyConflictCount, 3);
assert.equal(conflictSummary.conflictCount, dailyConflictCount);
assert.equal(conflictSummary.days[0].conflictCount, dailyConflictCount);
assert.equal(publishRoster('2026-10-19', conflictItems, [template], {}, true).conflictCount, dailyConflictCount);
assert.equal(schedulingConflicts(conflictItems).length, 3);
console.log('Hardening assertions passed: supported recurrence only, safe malformed generation, consistent affected-duty conflict counts.');

const { selectPrintableWeek } = require('../lib/roster/print.ts');
const printSource = [
  { ...b, id: 'later', area: 'Kennel', startTime: '11:00', endTime: '12:00' },
  { ...a, id: 'earlier', area: 'Kennel', startTime: '08:00', endTime: '09:00' },
  { ...c, id: 'next-day', area: 'Parvo Ward' },
  { ...a, id: 'outside-week', date: '2026-10-26', area: 'Parvo Ward' },
];
const fullPrintWeek = selectPrintableWeek('2026-10-19', 'All Areas', printSource);
assert.equal(fullPrintWeek.length, 7);
assert.deepEqual(fullPrintWeek[0].work.map(item => item.id), ['earlier', 'later']);
assert.deepEqual(fullPrintWeek[1].work.map(item => item.id), ['next-day']);
assert.equal(fullPrintWeek[6].work.length, 0);
assert.deepEqual(selectPrintableWeek('2026-10-19', 'Parvo Ward', printSource)
  .flatMap(day => day.work.map(item => item.id)), ['next-day']);
assert.deepEqual(printSource.map(item => item.id), ['later', 'earlier', 'next-day', 'outside-week']);
console.log('Print selection assertions passed: seven days, chronological order, area filter, week boundary, source immutability.');
// Exercise actual provider actions after the shared authenticated location source loads.
// The integrated provider has WS1 auth/effects as well as the certified WS2 roster state.
async function providerAssertions() {
const Module = require('node:module');
const loadModule = Module._load;
const previousTsx = require.extensions['.tsx'];
const hookState = [];
let hookIndex = 0;
const effects = [];
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const react = require('react');
Module._load = function(request, parent, ...rest) {
  if (parent?.filename.endsWith('OpsProvider.tsx') && request === './AuthProvider') return { useAuth: () => ({ status: 'signedIn', user: { uid: 'supervisor-fixture' } }) };
  if (parent?.filename.endsWith('OpsProvider.tsx') && request === '../lib/locations') return { getAllLocations: async () => [
    ...require('../../fixtures/operational-areas.json'),
    ...['Intake','Intake Ward A','Ward B','Theatre 1','Ward A & C','General Wards','Pharmacy','All Areas','Kennel Block','Break Room 2','Outreach','Kennel'].map((name, index) => ({ id: 'fixture-area-' + index, name, active: true })),
  ] };
  if (request === 'react' && parent?.filename.endsWith('OpsProvider.tsx')) {
    return { ...react,
      useMemo(fn, deps) { const index = hookIndex++; if (!sameDeps(hookState[index]?.deps, deps)) hookState[index] = { deps, value: fn() }; return hookState[index].value; },
      useCallback(fn, deps) { const index = hookIndex++; if (!sameDeps(hookState[index]?.deps, deps)) hookState[index] = { deps, value: fn }; return hookState[index].value; },
      useEffect(fn, deps) { const index = hookIndex++; if (!sameDeps(hookState[index]?.deps, deps)) { hookState[index] = { deps }; effects.push(fn); } },
      useState(initial) {
        const index = hookIndex++;
        if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial;
        return [hookState[index], value => { hookState[index] = typeof value === 'function' ? value(hookState[index]) : value; }];
      },
      useRef(initial) {
        const index = hookIndex++;
        if (!(index in hookState)) hookState[index] = { current: initial };
        return hookState[index];
      },
    };
  }
  return loadModule.call(this, request, parent, ...rest);
};
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
let OpsProvider;
try { ({ OpsProvider } = require('../components/OpsProvider.tsx')); }
finally {
  Module._load = loadModule;
  if (previousTsx) require.extensions['.tsx'] = previousTsx;
  else delete require.extensions['.tsx'];
}
function readOps() { hookIndex = 0; return OpsProvider({ children: null }).props.value; }
let ops = readOps();
for (const effect of effects.splice(0)) effect();
await new Promise(resolve => setImmediate(resolve));
ops = readOps();
assert.ok(ops.duties.every(duty => typeof duty.isCritical === 'boolean'));
assert.equal(ops.duties.find(duty => duty.name === 'Oxygen Check').isCritical, true);
assert.equal(ops.duties.find(duty => duty.name === 'Pharmacy Stock Take').isCritical, false);
const { id: ignoredTemplateId, ...newTemplate } = template;
assert.equal(ops.addDuty({ ...newTemplate, name: 'Critical medium', isCritical: true }).ok, true);
ops = readOps();
const criticalId = ops.duties.find(duty => duty.name === 'Critical medium').id;
assert.equal(ops.duties.find(duty => duty.id === criticalId).priority, 'Medium');
assert.equal(ops.updateDuty(criticalId, { priority: 'Low' }).ok, true);
ops = readOps();
assert.equal(ops.duties.find(duty => duty.id === criticalId).isCritical, true);
assert.equal(ops.duplicateDuty(criticalId).ok, true);
ops = readOps();
const criticalCopy = ops.duties.find(duty => duty.name === 'Critical medium (Copy)');
assert.equal(criticalCopy.isCritical, true);
assert.equal(criticalCopy.priority, 'Low');
assert.notEqual(criticalCopy.id, criticalId);
assert.equal(ops.updateDuty(criticalId, { isCritical: false }).ok, true);
ops = readOps();
assert.equal(ops.duties.find(duty => duty.id === criticalId).isCritical, false);
assert.equal(ops.duties.find(duty => duty.id === criticalId).priority, 'Low');
assert.equal(ops.updateDuty(criticalId, { isCritical: true }).ok, true);
assert.equal(ops.addDuty({ ...newTemplate, name: 'Ordinary high', priority: 'High', isCritical: false }).ok, true);
ops = readOps();
const ordinaryHigh = ops.duties.find(duty => duty.name === 'Ordinary high');
assert.equal(ordinaryHigh.isCritical, false);
assert.equal(ops.updateDuty(ordinaryHigh.id, { priority: 'Medium' }).ok, true);
assert.equal(ops.duplicateDuty(ordinaryHigh.id).ok, true);
ops = readOps();
assert.equal(ops.duties.find(duty => duty.name === 'Ordinary high (Copy)').isCritical, false);
assert.equal(validateTemplate({ ...template, isCritical: 'yes' }, []).code, 'INVALID_CRITICAL');

const { isUncoveredCritical } = require('../lib/roster/rules.ts');
const criticalTemplate = ops.duties.find(duty => duty.id === criticalId);
const criticalWork = createScheduledWork('critical', { ...input, dutyId: criticalId }, [], ops.duties).scheduled[0];
const ordinaryWork = createScheduledWork('ordinary', { ...input, dutyId: ordinaryHigh.id }, [], ops.duties).scheduled[0];
assert.equal(criticalWork.isCritical, true);
assert.equal(ordinaryWork.isCritical, false);
assert.equal(created.scheduled[0].isCritical, false); // Ad-hoc work has no template critical meaning.
assert.equal(isUncoveredCritical(criticalWork), true);
assert.equal(isUncoveredCritical({ ...criticalWork, staffIds: ['one'] }), true);
assert.equal(isUncoveredCritical({ ...criticalWork, staffIds: ['one', 'one'] }), true);
assert.equal(isUncoveredCritical({ ...criticalWork, staffIds: ['one', 'two'] }), false);
assert.equal(isUncoveredCritical(ordinaryWork), false);
assert.equal(isUncoveredCritical({ ...ordinaryWork, staffIds: ['one'] }), false);
assert.equal(ops.updateDuty(criticalId, { isCritical: false }).ok, true);
ops = readOps();
assert.equal(editScheduledWork('critical', { ...input, dutyId: criticalId }, [criticalWork], ops.duties).scheduled[0].isCritical, true);
assert.equal(createScheduledWork('new-ordinary', { ...input, dutyId: criticalId }, [], ops.duties).scheduled[0].isCritical, false);
const generatedCritical = generateRecurringDuties('2026-10-19', [], [criticalTemplate], (() => { let n = 0; return () => `critical-gen-${++n}`; })());
assert.equal(generatedCritical.created, 7);
assert.ok(generatedCritical.scheduled.every(work => work.isCritical === true));
const { copyPreviousRoster } = require('../lib/roster/generation.ts');
const copiedCritical = copyPreviousRoster('2026-10-26', [criticalWork], ops.duties, () => 'critical-copy');
assert.equal(copiedCritical.scheduled[1].isCritical, true);
assert.deepEqual(copiedCritical.scheduled[1].staffIds, []);
assert.ok(ops.scheduledWork.filter(work => work.dutyId === 'd5').every(work => work.isCritical === true));

const criticalCoverageItems = [criticalWork, { ...criticalWork, id: 'partial', staffIds: ['one'] },
  { ...criticalWork, id: 'full', date: '2026-10-20', staffIds: ['one', 'two'] }, ordinaryWork];
const criticalSummary = weekSummary('2026-10-19', criticalCoverageItems);
assert.equal(criticalSummary.uncoveredCriticalCount, 2);
assert.equal(criticalSummary.days[0].uncoveredCriticalCount, 2);
assert.equal(criticalSummary.days[1].uncoveredCriticalCount, 0);
assert.deepEqual([criticalSummary.uncoveredCount, criticalSummary.understaffedCount, criticalSummary.fullyStaffedCount, criticalSummary.conflictCount], [2, 1, 1, 0]);
assert.equal(weekSummary('2026-10-26', criticalCoverageItems).uncoveredCriticalCount, 0);
const criticalReview = publishRoster('2026-10-19', criticalCoverageItems, ops.duties, {}, false);
assert.equal(criticalReview.status, 'confirmation_required');
assert.equal(criticalReview.uncoveredCriticalCount, 2);
const criticalPublished = publishRoster('2026-10-19', criticalCoverageItems, ops.duties, {}, true);
assert.equal(criticalPublished.status, 'published');
assert.equal(criticalPublished.uncoveredCriticalCount, 2);
assert.equal(criticalPublished.snapshot.scheduledWork[0].isCritical, true);
const fullyStaffedCritical = { ...criticalWork, staffIds: ['one', 'two'] };
const fullPublication = publishRoster('2026-10-19', [fullyStaffedCritical], ops.duties, {}, false);
assert.equal(fullPublication.status, 'published');
assert.equal(fullPublication.uncoveredCriticalCount, 0);
const { getRosterLifecycle } = require('../lib/roster/publication.ts');
assert.equal(getRosterLifecycle('2026-10-19', [{ ...fullyStaffedCritical, isCritical: false }], { '2026-10-19': fullPublication.snapshot }).hasUnpublishedChanges, true);
console.log('Critical-duty assertions passed: independent priority, provider create/edit/duplicate, fixtures, snapshots, generation/copy, distinct staffing, week scope, publication warning/override and lifecycle.');

}
providerAssertions().catch(error => { console.error(error); process.exitCode = 1; });
