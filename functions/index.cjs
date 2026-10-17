// RETIRED: historical Stage 7C/7D source, excluded from firebase.json and production delivery.
// Next trusted progress/publication transactions now own history and inbox creation.
'use strict';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {onDocumentWrittenWithAuthContext,onDocumentCreated} = require('firebase-functions/v2/firestore');
const {recordProgress} = require('./history.cjs');
const {queueNotifications,deliverJob} = require('./notifications.cjs');
initializeApp();
exports.recordTaskProgress = onDocumentWrittenWithAuthContext({
  document: 'employees/{uid}/taskProgress/{scheduledWorkId}', region: 'africa-south1', retry: true,
}, event => recordProgress(getFirestore(), event, () => FieldValue.serverTimestamp()));
exports.queueOperationalNotifications = onDocumentCreated({document:'operationalEvents/{eventId}',region:'africa-south1',retry:true,timeoutSeconds:540},
  event => event.data ? queueNotifications(getFirestore(),event.params.eventId,event.data.data()) : undefined);
exports.deliverOperationalNotifications = onDocumentCreated({document:'notificationJobs/{jobId}',region:'africa-south1',retry:true,timeoutSeconds:540},
  event => event.data ? deliverJob(getFirestore(),event.params.jobId,event.data.data()) : undefined);
