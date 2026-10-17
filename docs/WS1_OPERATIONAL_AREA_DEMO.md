# WS1 operational-area development evidence

This branch had no operational-area fixture or development seed. The shared development
fixture is now `SAID Ops/fixtures/operational-areas.json`. It contains Parvo Ward using the
existing Task 1 `{id, name}` location shape; missing `active` means selectable.

From the repository root, using the existing installed web TypeScript dependency:

```sh
node scripts/probe-ws1-locations.cjs
```

The probe supplies this fixture at the Firestore `getDocs` boundary, then executes both
apps' actual location loaders. The web OpsProvider consumes the returned records, and
the actual create/edit staff and create/edit duty forms render Parvo Ward and save its
`parvo` location ID. Parvo is defined in the shared fixture, never in a selector.
Additional probe records verify active and retired areas, including historical name
resolution and a disabled existing-retired-area option in edit forms. Hook lifecycle
probes cover authentication restoration, sign-in, failed loads, retries, stable effects,
and discarding a web response after logout. Both mobile screens render their failure
notice and invoke the existing hook retry.

This is reproducible fixture-based development evidence, not a backend seed or proof
of live Firebase availability. It performs no network requests, provisions no accounts,
and does not weaken rules or add a fixture fallback to live loading. In a provisioned
development backend, a supervisor can use the existing Locations screen to add Parvo
Ward and confirm it appears in staff/duty forms after the shared refresh. Live writes
remain subject to the unresolved WS1/WS5 location contract and security rules.

Web shared fetching requires existing AuthProvider `status === 'signedIn'` and a user UID.
Loading and signed-out states never query protected locations; a restored or newly
authenticated session loads automatically. New selections use active locations while
saved IDs resolve against all locations. No retirement/security policy is changed.
