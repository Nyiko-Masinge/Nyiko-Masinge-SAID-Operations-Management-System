const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
};

const { copyPreviousRoster, generateRecurringDuties } = require('../lib/roster/generation.ts');
const { createScheduledWork, editScheduledWork, removeScheduledWork, assignToWork, unassignFromWork, reassignOnWork } = require('../lib/roster/operations.ts');
const { getCoverage } = require('../lib/roster/rules.ts');

let sequence = 0;
const nextId = () => `new-${++sequence}`;
const template = (id, recurrence, changes = {}) => ({
  id, name: id, description: 'Snapshot', area: 'Ward A', time: '08:00', duration: '60 min',
  required: 2, recurrence, priority: 'High', status: 'Active', requirements: [], ...changes,
});
const templates = [template('daily', 'Daily'), template('mwf', 'Mon, Wed, Fri'), template('tt', 'Tue, Thu')];
const source = [
  { id: 'source-template', dutyId: 'daily', title: 'Old snapshot', description: 'Preserved', date: '2026-10-19', startTime: '08:00', endTime: '09:00', area: 'Ward A', required: 2, staffIds: ['staff-a'] },
  { id: 'source-adhoc', title: 'Ad hoc', description: 'Specific work', date: '2026-10-25', startTime: '10:00', endTime: '11:00', area: 'Ward B', required: 1, staffIds: ['staff-b'] },
];
const frozenSource = JSON.stringify(source);
const frozenTemplates = JSON.stringify(templates);
const copied = copyPreviousRoster('2026-10-26', source, templates, nextId);
assert.equal(copied.ok, true);
assert.equal(copied.created, 2);
assert.deepEqual(copied.scheduled.slice(2).map(item => item.date), ['2026-10-26', '2026-11-01']);
assert.deepEqual(copied.scheduled.slice(2).map(item => item.staffIds), [[], []]);
assert.equal(copied.scheduled[2].title, 'Old snapshot');
assert.equal(copied.scheduled[2].dutyId, 'daily');
assert.equal(copied.scheduled[3].dutyId, undefined);
assert.notEqual(copied.scheduled[2].id, source[0].id);
assert.equal(new Set(copied.scheduled.map(item => item.id)).size, copied.scheduled.length);
assert.equal(JSON.stringify(source), frozenSource);
assert.equal(JSON.stringify(templates), frozenTemplates);
const copiedAgain = copyPreviousRoster('2026-10-26', copied.scheduled, templates, nextId);
assert.equal(copiedAgain.created, 0);
assert.equal(copiedAgain.skippedDuplicates, 2);
const partial = copyPreviousRoster('2026-10-26', [...source, copied.scheduled[2]], templates, nextId);
assert.equal(partial.created, 1);
assert.equal(partial.skippedDuplicates, 1);

const generated = generateRecurringDuties('2026-11-02', [], templates, nextId);
assert.equal(generated.ok, true);
assert.equal(generated.created, 12);
assert.deepEqual(generated.scheduled.filter(item => item.dutyId === 'daily').map(item => item.date),
  ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
assert.deepEqual(generated.scheduled.filter(item => item.dutyId === 'mwf').map(item => item.date),
  ['2026-11-02', '2026-11-04', '2026-11-06']);
assert.deepEqual(generated.scheduled.filter(item => item.dutyId === 'tt').map(item => item.date),
  ['2026-11-03', '2026-11-05']);
assert.ok(generated.scheduled.every(item => item.endTime === '09:00' && item.staffIds.length === 0 && item.required === 2 && item.area === 'Ward A'));
assert.equal(new Set(generated.scheduled.map(item => item.id)).size, generated.scheduled.length);
const repeated = generateRecurringDuties('2026-11-02', generated.scheduled, templates, nextId);
assert.equal(repeated.created, 0);
assert.equal(repeated.skippedDuplicates, 12);
const mixed = generateRecurringDuties('2026-11-02', [], [
  template('inactive', 'Daily', { status: 'Inactive' }), template('unsupported', 'Every fortnight'),
  template('bad-duration', 'Daily', { duration: 'unknown' }), template('bad-count', 'Tue, Thu', { required: 0 }),
  template('valid', 'Tue, Thu'),
], nextId);
assert.equal(mixed.created, 2);
assert.equal(mixed.unsupported.length, 1);
assert.equal(mixed.unsupported[0].templateId, 'unsupported');
assert.equal(mixed.invalid.length, 3);
assert.ok(mixed.scheduled.every(item => item.dutyId === 'valid'));

const staff = [{ id: 'staff-a', availability: 'Available' }, { id: 'staff-b', availability: 'Available' }, { id: 'staff-c', availability: 'On Leave' }];
const input = { title: 'New', description: '', date: '2026-11-09', startTime: '08:00', endTime: '09:00', area: 'Ward A', required: 2 };
const created = createScheduledWork('work-1', input, [], templates);
assert.equal(created.ok, true);
const assigned = assignToWork('work-1', 'staff-a', created.scheduled, staff);
assert.equal(assigned.ok, true);
assert.equal(getCoverage(assigned.scheduled[0]).understaffed, true);
assert.equal(assignToWork('work-1', 'staff-a', assigned.scheduled, staff).code, 'DUPLICATE');
assert.equal(assignToWork('work-1', 'staff-c', assigned.scheduled, staff).code, 'UNAVAILABLE');
const conflicting = createScheduledWork('work-2', { ...input, startTime: '08:30', endTime: '09:30' }, assigned.scheduled, templates);
assert.equal(assignToWork('work-2', 'staff-a', conflicting.scheduled, staff).code, 'OVERLAP');
const adjacent = editScheduledWork('work-2', { ...input, startTime: '09:00', endTime: '10:00' }, conflicting.scheduled, templates);
assert.equal(assignToWork('work-2', 'staff-a', adjacent.scheduled, staff).ok, true);
const reassigned = reassignOnWork('work-1', 'staff-a', 'staff-b', assigned.scheduled, staff);
assert.equal(reassigned.ok, true);
assert.deepEqual(reassigned.scheduled[0].staffIds, ['staff-b']);
const unassigned = unassignFromWork('work-1', 'staff-b', reassigned.scheduled);
assert.equal(getCoverage(unassigned.scheduled[0]).uncovered, true);
assert.equal(removeScheduledWork('work-1', unassigned.scheduled).scheduled.length, 0);
console.log('Milestone 3 assertions passed: copy, recurrence, validation isolation, and roster regressions.');
