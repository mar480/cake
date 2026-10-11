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
```

`test:e2e` runs the full Chromium fixture suite and a smaller Firefox smoke suite against Vite. `test:e2e:preview` builds and runs the same tests against the production bundle. `test:e2e:live` starts the existing Flask app through Gunicorn and tests the installed releases without API mocks. Set `CAKE_E2E_PREVIEW=1` when invoking the live script to test real data against an already built production bundle.

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

Fixtures are small representative data following the existing transport schemas, including the beginner tour's `core:PropertyPlantEquipment` and Turnover search. Real-data smoke checks separately exercise the unchanged backend and full taxonomies. Neither test mode runs `build_and_copy.sh` or regenerates taxonomy releases.

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

Planned exact targets: React/React DOM and their type packages 19.3.0; DayPicker 8.10.2; Lucide 0.469.0; next-themes 0.4.6; Vaul 1.1.2. Existing compatible locked versions are retained, particularly PrimeReact 10.9.7 and Recharts 2.15.4. Recharts receives a scoped `react-is` 19.3.0 override per [maintainer guidance](https://github.com/recharts/recharts/releases/tag/v2.15.0).

Existing JSX transform, `createRoot`, `forwardRef`, compiler strictness and state-management architecture are retained. No new React features, backend interfaces or deployments are included.

## Final verification

React 18 baseline is established: all 18 fixture checks pass against the production bundle and the original Chromium screenshots; all four real-data smoke checks pass against Vite/Flask in Chromium and Firefox. Development fixture checks also passed across the main run and targeted harness corrections. No application behaviour was changed while developing the harness.

React 19 migration and equivalent post-upgrade checks are pending.
