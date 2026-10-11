# React 19 migration

Baseline: `react19` at `5bfaa405d75390124eb96b368a60c2b83bfedb41`.
Environment: Node 24.17.0, npm 11.13.0; Linux, Europe/London.

## Preparatory verification

The original frontend lockfile installs cleanly with `npm ci`. Application TypeScript checking, the production build, and all 38 frontend tests pass. Two pre-existing unnecessary string escapes were corrected in commit `7f601e2`; TypeScript AST comparison confirmed that every decoded string remained identical. Lint then passed with the same seven Fast Refresh warnings.

The existing ignored `backend/.viewer` environment had the runtime dependencies but lacked pytest. Installing pytest 9.0.2 there allowed all 42 backend tests to pass. The existing Arelle/pyparsing deprecation warning remains; backend runtime requirements and taxonomy inputs are unchanged.

Browser coverage is established on React 18.3.1 before changing runtime dependencies. Playwright 1.64.0 pins the Chromium and Firefox builds. Tests use fresh contexts, a 1440 × 900 viewport, English locale and Europe/London timezone. Chromium reference images are committed alongside the tests and must not be refreshed to hide migration differences.

## Browser test modes

Run from `frontend`:

```bash
npm ci
npx playwright install chromium firefox
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:e2e:preview
npm run test:e2e:live
npm run test:e2e:packaged
```

`test:e2e` runs the full Chromium fixture suite and a smaller Firefox smoke suite against Vite. `test:e2e:preview` builds and runs the same tests against the production bundle. `test:e2e:live` starts the existing Flask app through Gunicorn and tests the installed releases without API mocks. Set `CAKE_E2E_PREVIEW=1` when invoking the live script to test real data against an already built production bundle.

`test:e2e:packaged` starts only Gunicorn's `wsgi:app` on port 5000 and serves the copied Flask HTML/assets directly. It reuses both real-release checks in both browsers and adds asset, deep-link and pop-out verification in both browsers. Run `bash build_and_copy.sh` from the repository root before this mode; the test deliberately does not build or copy files itself. It requires `frontend/dist` and the corresponding files in `backend/templates` and `backend/static/assets`. No Vite server, proxy or API mocks are used.

Live tests require the backend runtime plus Gunicorn in `backend/.viewer`; set `CAKE_PYTHON` to an alternative executable if needed. They reserve ports 5000 and 4173 and refuse to reuse existing servers. Fixture tests need only port 4173. API proxying exists solely in `vite.e2e.config.ts`; deployed Vite and Flask configuration is unchanged.

In this workspace browser binaries are under `/tmp/cake-playwright-browsers`; prefix browser commands with `PLAYWRIGHT_BROWSERS_PATH=/tmp/cake-playwright-browsers`. Logs used for the comparison are under `/tmp/cake-react18-*` and `/tmp/cake-react19-*`. Playwright HTML reports, screenshots on failure, and traces are ignored build artifacts. The generated unit-test bundle is also ignored rather than committed.

The application and browser-test sources are type checked. The production Vite configuration is not newly added to TypeScript checking: its pre-existing Sass `api` options are accepted at runtime but rejected by installed Vite configuration types.

## Behaviour exercised

- Manifest → immutable bundle loading; all nine network choices; filtering, selection, toggling and bilingual labels.
- Precise repeated occurrences, URL reload, Back/Forward restoration, and entry-point request isolation.
- Concept cross-references; dimensions, member selection and primary items; both pop-out windows and their message payloads.
- Advanced search, filters, pagination, result navigation/reset and CSV/JSON exports; filtered-tree CSV/JSON/HTML/PNG downloads.
- Resizing, keyboard entry-point selection, help persistence, modal dismissal and the automated beginner tour.
- Delayed/cancelled loads, empty results, invalid links, API failures and revision-error recovery.

Fixtures are small representative data following the existing transport schemas, including the beginner tour's `core:PropertyPlantEquipment` and Turnover search. Real-data smoke checks separately exercise the unchanged backend and full taxonomies. Browser test commands do not run `build_and_copy.sh` or regenerate taxonomy releases.

Existing semantics discovered during baseline verification are preserved: active tree filters expand all matching paths, and routine concept navigation replaces browser history instead of adding entries. The Back/Forward test seeds an independent history entry to exercise the actual `popstate` restoration path.

## Known baseline messages

Browser tests permit only these observed baseline warning families:

- React Router's two documented v7 future-flag messages (`startTransition` and relative splat resolution).
- Radix Select's existing controlled/uncontrolled warning in either direction when loading or changing the entry point.

All other browser errors/warnings fail the fixture suite. Negative tests permit only the explicitly injected HTTP/error messages. Existing build warnings concern the >500 kB bundle and old Browserslist data. Tool-launch `NO_COLOR`/`FORCE_COLOR` warnings are terminal messages, not application-console warnings.

## Installed comparison inputs

| Suite / entry point | Revision |
| --- | --- |
| 2026 / FRS 102 | `5078ddb204fbf3bf47c8bc17d5f3fed3b15206308f5273d481f40fca0f12c6fa` |
| 2025 / IFRS | `1df5cf46b4040f0d0eafbbeacb14360d42d7590d7d1e1087408957957ab3e2b7` |

Live tests assert these revisions and record load/navigation timings as report attachments. Timings are local observations, not controlled performance benchmarks.

The live representative concepts are `core:PropertyPlantEquipment` for 2026 FRS 102 and `core:PropertyPlantEquipmentIncludingRight-of-useAssets` for 2025 IFRS. The latter suite does not place the former QName in its presentation tree. Requests are recorded from page startup so existing caching cannot create false expectations of a new request on every selection.

## Dependency changes

| Package | React 18 baseline | Migrated version |
| --- | --- | --- |
| `react`, `react-dom` | 18.3.1 | 19.3.0 |
| `@types/react` | 18.3.28 | 19.3.0 |
| `@types/react-dom` | 18.3.7 | 19.3.0 |
| `react-day-picker` | 8.10.1 | 8.10.2 |
| `lucide-react` | 0.462.0 | 0.469.0 |
| `next-themes` | 0.3.0 | 0.4.6 |
| `vaul` | 0.9.9 | 1.1.2 |

These changed direct dependencies are pinned exactly. Existing compatible locked versions are retained, including every Radix package, PrimeReact 10.9.7, Recharts 2.15.4, React Query, React Router and React Split. Recharts receives a scoped `react-is` 19.3.0 override per [maintainer guidance](https://github.com/recharts/recharts/releases/tag/v2.15.0). A runtime assertion verifies that Recharts resolves this version and recognizes an actual React 19 element. Other consumers retain their required `react-is` versions.

Unrelated npm lockfile refreshes were removed. The remaining transitive changes are React DOM's scheduler 0.28.0, removal of React 18's unused `@types/prop-types`, and relocation of the overridden `react-is`. Fresh `npm ci --strict-peer-deps` and `npm ls --all` validate the resulting graph; neither force nor legacy peer resolution is enabled.

Existing JSX transform, `createRoot`, `forwardRef`, compiler strictness and state-management architecture are retained. No new React features, backend interfaces or deployments are included.

## Compatibility correction

The unchanged browser history test exposed an intermittent restoration race on React 19: while starting a same-entrypoint reload, navigation could resolve against the previous tree before the bundle completed. The completed load then cleared that selection. The focused check reproduced this before the correction (one failure in three runs).

URL restoration now records completion of its requested load before scheduling navigation. It retains the existing reload, revision context and history policy. This is the only application behaviour correction in the migration; ref callbacks, JSX annotations and shared UI wrappers needed no compatibility edits. The existing browser test covers deep-link startup, reload and both history directions.

After the correction, this scenario passes in both browsers and both fixture modes, plus five consecutive additional Chromium production runs (`CAKE_E2E_PREVIEW=1 npm run test:e2e -- --grep 'restores precise' --project chromium --repeat-each 5`). No test retry or snapshot update was used.

## Final verification

React 18 baseline is established: all 18 fixture checks pass against the production bundle and the original Chromium screenshots; all four real-data smoke checks pass against Vite/Flask in Chromium and Firefox. Development fixture checks also passed across the main run and targeted harness corrections. No application behaviour was changed while developing the harness.

React 19 passes the following checks after the compatibility correction:

| Command / check | Result |
| --- | --- |
| `npm ci --strict-peer-deps` | Clean install passes without peer overrides or bypass flags |
| `npm ls react react-dom react-is --all`; `npm ls --all` | Valid graph; one React and React DOM version, both 19.3.0 |
| `npm run typecheck` | Application and browser-test TypeScript pass |
| `npm run lint` | Zero errors; the same seven Fast Refresh warnings |
| `npm test`; direct execution of its generated bundle | All 38 tests pass |
| `backend/.viewer/bin/python -m pytest -q tests` (repository root) | All 42 tests pass; same Arelle deprecation warning |
| `npm run test:e2e` | 18 pass: 14 Chromium checks and four Firefox smoke checks |
| `npm run test:e2e:preview` | Production build passes; the same 18 browser checks pass |
| `npm run test:e2e:live` | Four pass: both pinned releases in both browsers |
| `CAKE_E2E_PREVIEW=1 npm run test:e2e:live` | Four pass against the production bundle and real backend |

This gives 44 passing browser checks across development, production preview and real-data modes. Both committed React 18 Chromium images pass unchanged in development and production: [details](../frontend/e2e/explorer.spec.ts-snapshots/explorer-details-chromium-linux.png) and [dimensions](../frontend/e2e/explorer.spec.ts-snapshots/explorer-dimensions-chromium-linux.png). No snapshot was refreshed after the upgrade. The warning allowlist also remains unchanged; there are no unexplained new application-console messages.

Node's test runner in this workspace sometimes summarizes the bundled test file as one passing file. Directly executing that same generated file additionally verifies its full 38-test TAP count.

### Production assets

| Asset | React 18 | React 19 |
| --- | --- | --- |
| JavaScript | 678.80 kB / 206.13 kB gzip | 759.25 kB / 229.66 kB gzip |
| CSS | 277.47 kB / 36.24 kB gzip | 277.47 kB / 36.24 kB gzip |

The dependency upgrade increases the compressed JavaScript payload by 23.53 kB (about 11.4%). The CSS asset hash is identical (`index-CF5iADib.css`). Existing chunk-size and Browserslist warnings remain. Bundle splitting and dependency cleanup are outside this migration.

### Real-data responsiveness comparison

The initial development observations were slower on React 19. To check the deployed code path, the committed React 18 baseline (`99c6f25`) was independently installed and built under `/tmp/cake-react18-comparison`, then tested against the same backend and pinned releases. All four additional React 18 production smoke checks pass. No working-branch files or installed taxonomy outputs were replaced for this comparison.

| Mode / browser / release | React 18 load / navigation (ms) | React 19 load / navigation (ms) |
| --- | --- | --- |
| Development / Chromium / 2026 | 533 / 2041 | 1163 / 3367 |
| Development / Chromium / 2025 | 557 / 973 | 1056 / 1513 |
| Development / Firefox / 2026 | 2522 / 2514 | 2597 / 3336 |
| Development / Firefox / 2025 | 2556 / 1006 | 2620 / 1515 |
| Production / Chromium / 2026 | 504 / 1798 | 515 / 1708 |
| Production / Chromium / 2025 | 492 / 837 | 516 / 779 |
| Production / Firefox / 2026 | 2573 / 1923 | 2699 / 1952 |
| Production / Firefox / 2025 | 2617 / 767 | 2683 / 864 |

The production observations are similar and do not show the larger development increase. These are single local smoke-test measurements, including Playwright interaction/wait overhead, rather than a controlled performance benchmark. Both versions load the full installed taxonomies and complete selection, dimensional/tree-location views, network switching and real search.

## Review scope and remaining limitations

Preparatory commits are `7f601e2` (identical help strings, lint correction) and `99c6f25` (React 18 browser baseline, fixtures, screenshots, scripts and ignored test outputs). The final migration contains the exact dependency changes, the URL-restoration completion check and this report.

Coverage is strongest for the active explorer workflows. Firefox runs the four explorer smoke scenarios and both real releases; Chromium runs the full fixture suite. The two reference screenshots cover details and dimensions rather than every possible display state. Shared UI wrappers remain installed and type checked, including unused calendar, chart and drawer components, but their unused surfaces are not added to Cake for browser testing.

Existing Fast Refresh, Router, Select and build warnings remain documented above. Live smoke tests deliberately pin the installed taxonomy revisions; a future release change requires an explicit test-input update. Browser binaries and the ignored Python environment are local prerequisites. The migration commits do not change backend runtime requirements, production configuration, backend assets or taxonomy outputs. Local release assembly and handover are recorded below.

## Local release assembly and manual handover

Release preparation starts from migration commit `d52e0c9`. GitHub's `vps` head was rechecked read-only and still matches `5bfaa405d75390124eb96b368a60c2b83bfedb41`. The migration diff is confined to the documented React changes, compatibility correction and verification tooling.

Running the existing `bash build_and_copy.sh` locally succeeds. Flask's tracked template now references `/assets/index-CJZPa64A.js`; CSS remains `/assets/index-CF5iADib.css`. The corresponding assets are assembled under ignored `backend/static/assets`. Packaging the existing taxonomy outputs leaves the entire six-suite catalog unchanged; SHA-256 comparison also confirms that all 888 tracked taxonomy source files and suite configuration are unchanged. No taxonomy extraction or source regeneration was performed.

Additional release checks:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass, including the new packaged test |
| `npm run lint` | Zero errors; the same seven warnings |
| `npm run test:e2e:preview` | Build and all 18 browser checks pass; reference images unchanged |
| `npm run test:e2e:packaged` | All six Gunicorn checks pass: three each in Chromium and Firefox |

Packaged verification checks the actual served root HTML against `frontend/dist/index.html`, and both served JavaScript and CSS byte-for-byte against the build. It also verifies restored real-data deep links and both pop-outs receiving their real payloads. Pop-out layout assertions wait for document loading to finish; the original application-warning allowlist is unchanged. The four reused real-data checks assert the same pinned 2026 FRS 102 and 2025 IFRS revisions.

Logs are under `/tmp/cake-react19-release-*`; generated browser reports and traces remain ignored. This release preparation does not change backend APIs, runtime requirements, nginx configuration or dependency versions.

### Publishing and deploying — performed by you

The verified release is recorded in a separate preparation commit, with the local `vps` branch fast-forwarded to it and `react19` retained. Remote Git publication, server access and live rollout remain your responsibility.

1. Publish the prepared local `vps` branch through your normal Git workflow. For the current fast-forward release, the command from this checkout is `git push origin vps`.
2. Log into your server and enter the existing Cake checkout. Update its `vps` branch using your normal procedure; on a clean checkout already on `vps`, use `git pull --ff-only origin vps`. Confirm its commit matches the release hash supplied in the handover.
3. Rebuild with the updated lockfile and copy the generated assets using your usual procedure. The repository's standard commands, from its root, are `npm --prefix frontend ci` followed by `bash build_and_copy.sh`. If your existing backend Python environment is elsewhere, set `TAXONOMY_PYTHON` to its executable as usual. Generated static assets do not travel through Git and must be built/copied as part of your rollout.
4. Perform your normal nginx rebuild/reload and application-service reload procedure. Reloading the application ensures Flask uses the updated HTML template. Server paths and service names are intentionally left to your established commands.
5. Check the hosted application in a fresh browser session: load 2026 FRS 102 and 2025 IFRS, select a concept and inspect details, run a search, reload a concept deep link and open both hypercube and tree-location pop-outs. Confirm the root HTML references the new JavaScript asset and that it loads successfully.

No Git push, remote merge, SSH connection or live service change is performed by this local preparation.

## Server installation compatibility correction — 11 October 2026

The first server installation of `2d25459` failed before the rebuild: Node 22.23.3 / npm 10.9.9 rejected the frontend lockfile with `Missing: react-is@16.13.1 from lock file`. The original release checks used Node 24.17.0 / npm 11.13.0, which accepted the incomplete lockfile and resolved the shared `prop-types` consumer to `react-is` 19.3.0. Those checks therefore missed a reproducibility gap; the server does not need a Node or npm upgrade to resolve it.

The exact server versions were installed into temporary local directories and reproduced the failure. The corrected lockfile adds the missing nested `prop-types` dependency at 16.13.1 without changing any existing locked package version. The Recharts override also explicitly retains `prop-types`' required version within its dependency subtree, preventing npm 11 from applying Recharts' 19.3.0 override to that shared consumer:

```json
"overrides": {
  "recharts": {
    "react-is": "19.3.0",
    "prop-types": {
      "react-is": "16.13.1"
    }
  }
}
```

Both overrides remain scoped to Recharts. No peer-dependency bypass flags, global override, application-code changes or server changes are needed. Fresh installs with both toolchains pass `npm ci --strict-peer-deps` and `npm ls --all`. Runtime resolution assertions additionally confirm `prop-types` uses 16.13.1, Recharts uses 19.3.0, and Recharts' `react-is` recognizes an actual React 19 element.

The local server-version verification passes TypeScript, lint (zero errors and the same seven warnings), all 38 unit tests, `bash build_and_copy.sh`, and all 18 production-preview browser checks. The committed React 18 screenshots are unchanged. Both asset hashes remain `index-CJZPa64A.js` and `index-CF5iADib.css`; all six taxonomy revisions and all 888 tracked source/configuration file hashes are unchanged. Install/graph logs are `/tmp/cake-react19-npm10-*` and `/tmp/cake-react19-npm11-*`; application verification logs are `/tmp/cake-react19-server-*`.

All six packaged Gunicorn checks also pass with the server toolchain: both pinned releases, byte-identical served HTML/JavaScript/CSS, deep-link reload and both pop-outs in Chromium and Firefox. The browser warning allowlist remains unchanged.

After publishing this follow-up `vps` commit from the local checkout, run these commands yourself on the server:

```bash
cd /var/www/ada
git pull --ff-only origin vps
npm --prefix frontend ci && bash build_and_copy.sh
```

Keep the earlier server lockfile stash unapplied so it does not replace the corrected release lockfile. Continue with your established application/nginx procedure and live checks after the build succeeds.
