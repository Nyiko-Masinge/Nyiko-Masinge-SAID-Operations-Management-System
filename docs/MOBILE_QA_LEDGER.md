# Physical mobile and browser evidence ledger

This ledger separates recorded human observations, automated evidence and unperformed release tests. It was consolidated on 5 October 2026; it does not claim a new physical-device test in Stages 7C–7H.

Source for existing human observations: **“Audit Task 2 compliance”**, local Codex chat `01a10bab-1181-7440-9801-c0cbeae76979`, final audit, section 9. The audit cites earlier user-reported physical-device work. Device model/OS, exact observation time, APK/build identity and screenshots were not included in the retrieved evidence.

| Scenario | Recorded evidence | Classification / limit |
| --- | --- | --- |
| STAFF001 published task Start/Complete | Human reported mobile action and Firestore/supervisor showing Completed | Recorded physical observation; not independently repeated here |
| Second task Unable/Reopen | Human reported supervisor In Progress with earlier Unable reason retained | Recorded physical observation; not independently repeated here |
| Published task visibility during builder restoration defect | Human reported duties remained visible on mobile | Recorded physical observation; builder defect subsequently repaired |
| Cross-screen effective status fix | Automated focused regression exists; prior audit says device retest not recorded | Device retest pending |
| STAFF002 physical account isolation | Separate device scenario not located | Pending; automated rules/client isolation passes |
| Complete reload/session-restoration/device error ledger | No complete physical evidence located | Pending; automated restoration/error coverage passes |
| Stage 7D persistent notification arrival/read/account switch | Actual Auth/Firestore/Functions integration and deterministic provider checks | Emulator/device-equivalent evidence; physical inbox test pending |
| Stage 7F archived roster toggle/details/action rejection | Client tests and actual server/rules integration | Emulator/device-equivalent evidence; physical archive test pending |
| Installed assessment APK | None built in this run | EAS setup/build/install pending |
| Tablet, screen reader, text scaling, offline/reconnection breadth | No comprehensive physical ledger supplied | Pending; no broad accessibility certification |

## Browser QA consolidated

The existing [4 October supervisor QA](SUPERVISOR_WEB_QA_2026-10-04.md) records desktop/tablet/narrow layouts, keyboard/modal behavior, staff/location filters, publication and restoration. It also records limitations around print/download checks and prototype workflows; later Stage 7 work supersedes its backend capability findings.

Stage 7E used a genuine disposable emulator publication in the in-app browser: two duties, two unique scheduled staff, one unavailable staff member, one completed shared duty, one attention duty. Date, area, employee and status filters, empty date, duty instructions/team/progress detail and Refresh passed. Revoking supervisor role made required reads fail with error/dashes and no success claim; restoring the role recovered data. The native date-input issue was corrected and covered by a test.

Stage 7F searched the published history, archived the disposable week with a reason, retained duties and shared Completed progress, and displayed the safe supervisor archive event. Active monitoring after Refresh showed zero published duties/attention. Fresh Stage 7F emulators independently proved blocked progress/republish writes; the continuing browser QA emulator had the previous rules loaded. No production or physical-device claim is derived from that browser session.

Repository screenshots are in `docs/evidence/stage7e-monitoring.png` and `docs/evidence/stage7f-history.png`; both depict disposable test identities/data. These are captured browser evidence, not fabricated design images.

## Remaining physical release checklist

After the real internal APK is built, record test date, tester, device model/OS, build ID/source SHA and environment. Exercise both staff identities; own assignments; notifications after publish/reassign/Unable; read-state persistence; Start/Complete/Unable/Reopen; reload and sign-out/account-switch; backend failure/recovery; historical/archived own work; and absence of archived progress actions. Complete a cross-app hosted demonstration and agreed accessibility checks. Attach actual evidence and failures without converting pending rows into passes based solely on emulator tests.
