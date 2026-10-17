# Lecturer access and trusted provisioning plan

Status: **DEPLOYMENT PENDING**. No production account or password was created in Stages 7C–7H. Public access placeholders:

| Role | Employee ID | Web / mobile access | Password |
| --- | --- | --- | --- |
| Supervisor | ADMINDEMO | Vercel URL pending | Share privately after provisioning |
| Staff | STAFFDEMO1 | EAS internal Android install URL pending | Share privately after provisioning |
| Second staff | STAFFDEMO2 | Same APK; separate assigned duties | Share privately after provisioning |

## Exact trusted mechanism after project setup

Use the **Firebase Console operated by an authorized project administrator**, with direct trusted Auth/Firestore management. Ordinary app clients cannot create employees or grant roles. This avoids adding public signup or a credential-bearing client seed. The existing emulator provisioner is strictly test-only and must not be repurposed for production.

1. Confirm the real selected Firebase project matches the deployed web/mobile config. Keep the project on Spark without a payment method; enable Email/Password Auth, deploy reviewed rules/indexes, and configure authorized Vercel domains. Record the project ID/URLs in a private release record.
2. In Console → Authentication → Users → Add user, create three users with privately generated distinct passwords and these internal aliases: `admindemo@saidops.internal`, `staffdemo1@saidops.internal`, `staffdemo2@saidops.internal`. They follow the existing `employeeIdToSyntheticEmail` algorithm. Record each returned Auth UID privately. These aliases are internal authentication identifiers; never present them as staff contact emails. Do not use Employee IDs as document IDs.
3. In Firestore Console, create/verify `roles/system-supervisor` with `{id: 'system-supervisor', name: 'Supervisor/Administrator'}` and `roles/system-staff` with `{id: 'system-staff', name: 'Staff Member'}`. Check exact spelling and coherent document IDs; do not overwrite a conflicting existing role.
4. Create `employees/{actualAuthUid}` for each new account. Required fields: `employeeId` (the planned ID), `firstName`/`surname` (approved display identity), `roleId` (supervisor for ADMINDEMO; staff for both staff IDs), `jobCategory` (approved operational label), `locationId` (an existing active area), `active: true`, `skills` (approved string array), `revision: 1`. Availability is `{normalState: 'Available', state: 'Available', effectiveFrom: '<actual approved ISO UTC date>', effectiveTo: null}`. If `uid` is stored, it must equal the document ID. Use Firestore timestamps for creation/update metadata if recording them. Do not create invented personal/contact information.
5. Verify one profile per Auth UID and unique business Employee IDs. Login to web as ADMINDEMO and confirm role access; login to mobile as each staff account separately. Staff must not enter the supervisor web area or read another staff member's progress/inbox. Role is authorization; jobCategory is display data.
6. Use the existing trusted supervisor screens/APIs to create/maintain operational profiles, templates and publications. Do not hand-edit immutable publication items or fabricate completion events to make the demo appear successful. Once staff execute real actions, confirm supervisor reads/history/inboxes reflect them.
7. Share Employee IDs, passwords and the install link through the lecturer's approved private channel. Populate only URLs/Employee IDs in README. Test the actual APK on a device and record date, model/OS, build ID and results. Revoke/disable demonstration accounts after the assessment according to the agreed retention policy.

Console provisioning is a restricted one-time administrative step, not the app's workforce-edit mechanism. A repeatable Admin CLI can be introduced later with explicit conflict handling; it is not required for these three planned accounts. Synthetic aliases cannot receive reset mail, so password recovery remains an administrator-managed process.

## Representative live demo data

Use an agreed current Monday and active areas, e.g. the actual configured Parvo Ward and Ward B. Establish staff availability and skills before publishing. Create a shared routine care duty assigned to STAFFDEMO1 and STAFFDEMO2, a separate STAFFDEMO1 duty for Unable/Reopen, and a critical duty with appropriate skills/staffing. Temporarily leaving critical coverage incomplete can demonstrate validation and an explicit reviewed coverage override; explain the exception and then resolve it.

Publish as ADMINDEMO. Verify per-recipient new-roster inboxes and assignment isolation. Both staff complete the shared duty to demonstrate that one occurrence counts once and completion requires all assigned staff. Execute Unable with a real demonstration reason and Reopen on the second task; retained reason and attributed history should be visible. Reassign/republish a duty to demonstrate removed/new recipient messages and stable progress identity. Use a completed disposable demonstration week for archive/history so active operational work is not interrupted. Do not claim demonstration data represents SAID clinical records.
