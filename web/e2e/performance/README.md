# RNF15 search performance run

This Playwright harness runs six isolated authenticated Chrome contexts concurrently. Each sends 10 single-word, 5 multiword, then 5 ACL-negative searches sequentially. The runner retains all 120 attempts, including errors and 10-second timeouts; it never retries or replaces an attempt. A result is on time at 2,000 ms or less, and the run passes at 114 or more on-time attempts.

## Integration prerequisites

The `3b82c62` base has the RF41 API but no search UI. Before measuring, connect the selectors in `config.json` to #134 and implement the result container contract: after the current response is rendered, write its term to `data-search-query` on the result container; visible matches must use `[data-testid=search-result]` and expose their exact title using the configured `data-search-title` attribute; empty results must show the configured empty selector. Set `uiAdapterVerified` to `true` only after checking both populated and empty results. The runner refuses to start while this value is false. It also requires a matching visible result title so stale cards cannot satisfy a search.

Each session's `storageState` is checked against `expectedIdentity` using `selectors.identity` and `selectors.identityAttribute` on the authenticated page. Configure six distinct expected identities and point these selectors to a stable identity element and attribute exposed by the app (for example, a user email); the runner fails setup if configured identities repeat or an observed identity differs. This validates the authenticated user represented by each state, rather than trusting distinct configured emails. Credentials are not included in error messages or evidence.

The 30 `noAccessQueries` must name existing items inside collections inaccessible to the corresponding user. The seed script does not create restricted fixtures because the current API setup does not configure collection ACLs. For each user, create five items with exactly the configured terms in a restricted collection, grant access to a witness account, and confirm the target user cannot access that collection. Set `aclFixturesVerified` to `true` only after checking all 30 target/item pairs. The runner refuses to start while this value is false. This prevents globally absent terms from being counted as ACL coverage.

## Windows 11 and Chrome setup

Use the presentation computer or an equivalent local Windows computer. Record its model/CPU/RAM, Windows version, Chrome version, API and web URLs, network conditions, and date. Use an isolated test workspace, six distinct active accounts, and an account allowed to create 1,000 items. Before launching the runner, set `deployedCodeRevision` in local `config.json` to the deployed commit SHA or release version. Describe the active connection under `environment.network`: connection type, observed downlink in Mbps, round-trip latency in milliseconds, and notes about conditions during the run. The runner rejects missing or placeholder revision/network values before opening Chrome; use actual connection details, not the example zero values.

From PowerShell in `web`:

```powershell
pnpm install
pnpm exec playwright install chrome
Copy-Item e2e/performance/config.example.json e2e/performance/config.json
```

Edit local `config.json` with app/API URLs, workspace ID, deployed code revision or version, network conditions, adapter selectors, credentials, six storage-state paths, and 30 ACL-negative terms. For example, set `environment.network.connection` to `wired Ethernet`, `downlinkMbps` to the observed downlink, `rttMs` to the observed round-trip latency, and `notes` to details such as whether the connection was shared or under load. Do not commit it. In a clean isolated workspace, seed 970 shared items (60 alphanumeric single-word titles, 30 multiword titles, and 880 filler titles):

```powershell
pnpm run performance:seed -- e2e/performance/config.json
```

The seed script checks existing root-item titles and skips generated titles already present, so it can be rerun after an interruption without duplicating completed inserts. Keep the workspace isolated and do not run seeding during measurement.

Create the remaining 30 restricted fixtures using the configured `noAccessQueries` terms to reach 1,000 total items, then verify them as described above. Set `datasetItems` to the operator-counted workspace total and `datasetVerified` to `true` only after confirming that total is exactly 1,000. `datasetItems` is operator-declared, not independently queried or verified by the harness; the verification flag is a required operator attestation for a passing run. Also set `aclFixturesVerified` to `true`. Prepare six storage states before the measurement. Logins are sequential and spaced 13 seconds apart to stay below the API's per-IP login rate limit; this setup is not part of measured time:

```powershell
pnpm run performance:auth -- e2e/performance/config.json
```

Run the measurements:

```powershell
pnpm run performance:measure -- e2e/performance/config.json
```

The seed operation is not idempotent. Do not seed twice in the same workspace. `config.json`, storage states, and `results/` are ignored by Git.

## Evidence

Each run creates a CSV with one row per scheduled attempt and a JSON environment/summary report in `e2e/performance/results/`. The JSON records `deployedCodeRevision` and `networkConditions` alongside the full environment object. Keep both raw files. Setup failures are marked `not-submitted` and cannot be counted as a completed 120-search run; the report records scheduled and submitted attempts separately, and `passed` requires all 120 submissions. Other failures are retained as `timeout`, `error`, or `functional-mismatch`. Only visible expected results presented in 2,000 ms or less count toward the 114/120 threshold. A successful presentation over 2 seconds remains in the denominator and fails the timing target.

Timing starts immediately before submit and ends when the result container marks the current query as rendered after its response. A successful positive search must include its expected exact-title match in that state; a completed query with a missing match, or an ACL-negative query with visible results, is recorded promptly as a functional mismatch. ACL-negative success requires the visible empty state and no visible result items. Visibility checks reject hidden elements and hidden ancestors. The predicate evaluates visibility, expected outcome, visible item count, and completion timestamp together in the browser, avoiding extra sequential Playwright calls after the result appears. It includes browser-to-API work and access checks, not only server processing. Run on the target local setup, not in a CI container.
