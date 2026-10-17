const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
};

const { getPublishedRoster, getRosterLifecycle, publishRoster } = require('../lib/roster/publication.ts');
const { createScheduledWork, editScheduledWork, removeScheduledWork, assignToWork, unassignFromWork, reassignOnWork } = require('../lib/roster/operations.ts');
const { copyPreviousRoster, generateRecurringDuties } = require('../lib/roster/generation.ts');
const { getCoverage } = require('../lib/roster/rules.ts');

const templates = [{ id: 'template', name: 'Daily care', description: 'Template text', area: 'Ward A',
  time: '08:00', duration: '60 min', required: 2, recurrence: 'Daily', priority: 'Medium',
  status: 'Active', requirements: [] }];
const staff = [{ id: 'a', availability: 'Available' }, { id: 'b', availability: 'Available' }];
const input = { dutyId: 'template', title: 'Daily care', description: 'Template text', date: '2026-10-19',
  startTime: '08:00', endTime: '09:00', area: 'Ward A', required: 2 };
let draft = createScheduledWork('one', input, [], templates).scheduled;
let published = {};
const week = '2026-10-19';
assert.deepEqual(getRosterLifecycle(week, draft, published), { status: 'Draft', hasUnpublishedChanges: false });
assert.equal(getPublishedRoster(week, published), undefined);

let outcome = publishRoster(week, draft, templates, published, false);
assert.equal(outcome.status, 'confirmation_required');
assert.equal(outcome.uncoveredCount, 1);
assert.equal(getPublishedRoster(week, published), undefined);
outcome = publishRoster(week, draft, templates, published, true);
assert.equal(outcome.status, 'published');
assert.equal(outcome.itemCount, 1);
assert.equal(outcome.republished, false);
published = { [week]: outcome.snapshot };
assert.deepEqual(getRosterLifecycle(week, draft, published), { status: 'Published', hasUnpublishedChanges: false });
const originalSnapshot = getPublishedRoster(week, published);
originalSnapshot.scheduledWork[0].staffIds.push('a');
assert.deepEqual(getPublishedRoster(week, published).scheduledWork[0].staffIds, []);

draft = editScheduledWork('one', { ...input, startTime: '09:00', endTime: '10:00' }, draft, templates).scheduled;
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, true);
assert.equal(getPublishedRoster(week, published).scheduledWork[0].startTime, '08:00');
draft = assignToWork('one', 'a', draft, staff).scheduled;
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, true);
draft = reassignOnWork('one', 'a', 'b', draft, staff).scheduled;
assert.deepEqual(draft[0].staffIds, ['b']);
draft = unassignFromWork('one', 'b', draft).scheduled;
assert.equal(getCoverage(draft[0]).uncovered, true);
const otherInput = { title: 'Ad hoc', description: '', date: '2026-10-20', startTime: '10:00', endTime: '11:00', area: 'Ward B', required: 1 };
draft = createScheduledWork('two', otherInput, draft, templates).scheduled;
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, true);
draft = removeScheduledWork('two', draft).scheduled;
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, true);

const secondWeek = '2026-10-26';
const copied = copyPreviousRoster(secondWeek, draft, templates, () => 'copied');
assert.equal(copied.created, 1);
draft = copied.scheduled;
assert.equal(getRosterLifecycle(secondWeek, draft, published).status, 'Draft');
const generated = generateRecurringDuties('2026-11-02', draft, templates, (() => { let id = 0; return () => `generated-${++id}`; })());
assert.equal(generated.created, 7);
draft = generated.scheduled;
assert.equal(getRosterLifecycle('2026-11-02', draft, published).status, 'Draft');
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, true);

const secondPublication = publishRoster(secondWeek, draft, templates, published, true);
assert.equal(secondPublication.status, 'published');
published = { ...published, [secondWeek]: secondPublication.snapshot };
const secondBefore = JSON.stringify(getPublishedRoster(secondWeek, published));
outcome = publishRoster(week, draft, templates, published, true);
assert.equal(outcome.status, 'published');
assert.equal(outcome.republished, true);
published = { ...published, [week]: outcome.snapshot };
assert.equal(getRosterLifecycle(week, draft, published).hasUnpublishedChanges, false);
assert.equal(getPublishedRoster(week, published).scheduledWork[0].startTime, '09:00');
assert.equal(JSON.stringify(getPublishedRoster(secondWeek, published)), secondBefore);

// Each operation is checked against a matching published draft.
const assignedAfterPublish = assignToWork('one', 'a', draft, staff).scheduled;
assert.equal(getRosterLifecycle(week, assignedAfterPublish, published).hasUnpublishedChanges, true);
assert.equal(getRosterLifecycle(week, unassignFromWork('one', 'a', assignedAfterPublish).scheduled, published).hasUnpublishedChanges, false);
const addedAfterPublish = createScheduledWork('new-work', otherInput, draft, templates).scheduled;
assert.equal(getRosterLifecycle(week, addedAfterPublish, published).hasUnpublishedChanges, true);
assert.equal(getRosterLifecycle(week, removeScheduledWork('new-work', addedAfterPublish).scheduled, published).hasUnpublishedChanges, false);
const assignedPublication = publishRoster(week, assignedAfterPublish, templates, published, true);
const assignedSnapshots = { ...published, [week]: assignedPublication.snapshot };
const replacedAfterPublish = reassignOnWork('one', 'a', 'b', assignedAfterPublish, staff).scheduled;
assert.equal(getRosterLifecycle(week, replacedAfterPublish, assignedSnapshots).hasUnpublishedChanges, true);

const copyDestination = '2026-11-09';
const emptyCopyPublication = publishRoster(copyDestination, draft, templates, published, false);
assert.equal(emptyCopyPublication.status, 'published');
const withCopyDestination = { ...published, [copyDestination]: emptyCopyPublication.snapshot };
const copiedToPublished = copyPreviousRoster(copyDestination, draft, templates, (() => { let id = 0; return () => `copy-published-${++id}`; })());
assert.ok(copiedToPublished.created > 0);
assert.equal(getRosterLifecycle(copyDestination, copiedToPublished.scheduled, withCopyDestination).hasUnpublishedChanges, true);
const generateDestination = '2026-11-16';
const emptyGeneratePublication = publishRoster(generateDestination, draft, templates, published, false);
const withGenerateDestination = { ...published, [generateDestination]: emptyGeneratePublication.snapshot };
const generatedIntoPublished = generateRecurringDuties(generateDestination, draft, templates, (() => { let id = 0; return () => `gen-published-${++id}`; })());
assert.equal(getRosterLifecycle(generateDestination, generatedIntoPublished.scheduled, withGenerateDestination).hasUnpublishedChanges, true);

const conflictA = { ...draft[0], id: 'conflict-a', date: '2026-12-07', staffIds: ['a'] };
const conflictB = { ...conflictA, id: 'conflict-b', startTime: '09:30', endTime: '10:30' };
assert.equal(publishRoster('2026-12-07', [conflictA, conflictB], templates, published, true).code, 'SCHEDULING_CONFLICT');
assert.equal(publishRoster('2026-12-07', [conflictA, { ...conflictB, id: 'conflict-a' }], templates, published, true).code, 'DUPLICATE_WORK_ID');
assert.equal(publishRoster('2026-12-07', [{ ...conflictA, required: 0 }], templates, published, true).code, 'INVALID_WORK');
assert.equal(publishRoster('2026-12-07', [{ ...conflictA, dutyId: 'missing' }], templates, published, true).validationCode, 'TEMPLATE_NOT_FOUND');
assert.equal(publishRoster('bad-week', draft, templates, published, true).code, 'INVALID_WEEK');
console.log('Milestone 4 assertions passed: lifecycle, confirmation, isolation, republish, week independence, validation.');
