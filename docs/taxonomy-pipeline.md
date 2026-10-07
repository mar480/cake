# Taxonomy extraction and delivery

Taxonomy data is now published as immutable releases. The browser loads all nine networks together from one precompressed JSON bundle. Concept details, dimensions, hypercubes and primary items remain server-side. Search indexes are built on first search and reused per worker, with a default limit of eight indexes (`TAXONOMY_SEARCH_CACHE_SIZE`).

## Day-to-day workflow

Run commands from `backend`, using Python with `requirements.txt` installed. Arelle is pinned to 2.36.40. On this checkout the environment is `.viewer/bin/python`; the examples below use `python` for portability.

Build from explicit package inputs; both ZIPs and extracted package folders are accepted:

```bash
python -m taxonomy_pipeline build --suite 2028 --label '2028 - draft' \
  --package uk=/path/to/FRC.zip \
  --package charities=/path/to/Charities.zip \
  --package irish=/path/to/Irish.zip \
  --output .cache/taxonomy-releases/2028
```

For Lloyd's, use `--package lloyds=/path/to/Lloyds.zip`. Each kind occurs once. Dependencies can be supplied repeatedly with `--dependency /path/to/dependency.zip`. A pre-populated Arelle cache can be supplied with `--cache /path/to/cache`. Extraction is offline and runs in an isolated temporary cache; it does not silently depend on the operator's Arelle configuration or download missing schemas. Bundled Arelle standard schemas remain available. Missing imports fail the build with dependency guidance.

The command prints the complete release directory after successful validation:

```bash
python -m taxonomy_pipeline validate .cache/taxonomy-releases/2028/RELEASE_REVISION
python -m taxonomy_pipeline install .cache/taxonomy-releases/2028/RELEASE_REVISION --target taxonomies
# Export reviewable source inputs for the normal Git/Docker deployment:
python -m taxonomy_pipeline export .cache/taxonomy-releases/2028/RELEASE_REVISION --target taxonomies
```

Installation verifies checksums and bundle/server/filter consistency, copies to staging, and changes the catalog only after the release is complete. Filter sorting includes a stable tie-breaker for equivalent paragraph spellings, so validation and hashes agree across Python processes. Existing revisions are retained for requests from open browser sessions. Installing a failed or corrupted release leaves the catalog unchanged. Builds are reused only when source, dependency, controlled-cache, tool-code, version, label, and policy fingerprints match, and the cached release passes validation.

An entry point declaring multiple `entryPointDocument` elements is currently rejected explicitly. The pipeline does not silently load just its first document.

## Existing taxonomies and publishing

Package existing outputs without regenerating their IDs:

```bash
python -m taxonomy_pipeline package-existing --suite 2026 --base taxonomies \
  --output .cache/taxonomy-releases/2026
python -m taxonomy_pipeline prepare-all
```

`package-existing` is strict. Its explicit `--skip-invalid` option reports and excludes incomplete legacy entry points. `prepare-all` uses that option so the existing valid suites can be shipped despite historical incomplete outputs. Exclusions are recorded in each manifest's `provenance.unavailable_entrypoints`; they are never advertised as usable entry points. The previously empty 2024 IFRS and Core Full outputs have been repaired from the original FRC 2024 v1.0.0 package; all nine 2024 entry points are now included. Each repaired entry point contains 7,760 concepts. The other seven entry points retain their original data and IDs, and the repair provenance is recorded in `backend/taxonomies/2024/source-release.json`.

`prepare-all` discovers suites from their existing package metadata and generated trees. Optional suite display labels live in `backend/taxonomy-suites.json`; only Lloyd's and the draft 2027 label need overrides. Entry-point paths, labels, and groups are then stored explicitly in the release manifests. Runtime lookup uses these mappings rather than guessing folder names. Legacy discovery accepts both `META-INF` and the existing `META_INF` spelling, restoring 2027 Charities.

Generated releases and the catalog are build artifacts, excluded from Git. Continue checking source/generated input changes into the existing repository, then publish through the normal deployment workflow:

- Docker's build stage runs `prepare-all`; the runtime image includes only releases and the catalog, omitting original expanded trees, notebooks, and temporary extraction data.
- `build_and_copy.sh` (or `build_and_copy.bat` on Windows) builds the frontend and runs `prepare-all` for a direct checkout deployment. Set `TAXONOMY_PYTHON` if the backend environment is elsewhere.
- A locally installed release does not travel through Git automatically. Use `export` to create tracked generated server JSON, package metadata, provenance, and an explicit tree mapping. Review those changes and publish through the normal build. To update an existing suite, `export --replace` first preserves its old source directory under ignored `taxonomies/backup/`.

Source ZIPs/folders are retained separately. This checkout's user-supplied originals under `local/` are ignored and untouched.

## HTTP and compatibility

`GET /api/taxonomies` supplies suite values, labels and active revisions. `GET /api/entrypoint-manifest?year=...&href=...` supplies a revision and immutable bundle URL. Catalog and manifests use ETags with revalidation. Bundle URLs identify the suite, release, entry point and content hash; bundles use a one-year public immutable cache.

Bundles negotiate gzip and identity representations, honoring quality values and `gzip;q=0`, with `Vary: Accept-Encoding`. They contain all nine trees and precomputed search filter options. Superseded frontend loads are aborted. The selected revision travels with concept, dimensional, search, export, and alternate-presentation-location requests. Backend data caches are scoped to immutable release paths, and search/location keys include the selected revision. Unknown/removed revisions produce an actionable reload error.

The existing `POST /api/load-entrypoint` remains available with its former complete response shape for compatibility. It no longer warms the search index.

## Verification and limits

```bash
python -m taxonomy_pipeline compare CANDIDATE_RELEASE --suite 2026 --base taxonomies
python -m taxonomy_pipeline.benchmark --suite 2027
npm --prefix ../frontend test
npm --prefix ../frontend run build
```

`compare` reports differences against legacy outputs and exits 2 when any remain. It ignores occurrence UUIDs and generated tree path identifiers, but compares other content. A candidate comparison does not install or overwrite existing data.

The supplied 2026 FRC source was successfully loaded and fully extracted offline, including its UKSEF entry points. The nine tree networks, hypercubes and dimensions matched the existing outputs apart from generated identifiers. Existing concept counts and QNames matched. There are historical differences in displayed label-role names and primary-item labels, so the re-extracted candidate remains separate from the installed migration. An exact comparison of all 13 artifacts across all 65 installed entry points confirmed that the migration preserves existing payloads and IDs.

Notebook-vs-module tests exercise real Arelle models under FRC, Charities, Irish, IFRS and Lloyd's namespace policies. The replacement computes concept/relationship lookup indexes once rather than repeatedly scanning the model. On the supplied full 2026 FRS 102 model, its 7,995 concept records matched the unified notebook exactly. Concept extraction on that already-loaded model measured 0.506 seconds in the replacement versus 64.498 seconds in the notebook; this excludes model loading and other extraction stages. Primary-item labels now select standard label resources in the requested language; documentation labels cannot accidentally replace the standard label. Fresh occurrence UUIDs are deterministic and distinguish network, ELR and repeated relationship paths. The notebooks are retained under `archive/taxonomy-notebooks`.

The pre-existing dimensional test failure was a stale expectation: its fixture defined three hypercube occurrences sharing the selected dimension. The test now checks all three occurrences explicitly; runtime dimensional semantics were preserved.

For 2027 FRS 102, local delivery of the manifest and gzip bundle measured around 8–13 ms and 1.50 MiB in the final run, compared with the earlier approximately 2.1-second, 21.17-MiB complete response. This is local application delivery, excluding network transfer and browser rendering. The benchmark reports Python decompression/parsing separately and an ideal bandwidth-only estimate; use browser network throttling and performance recordings for end-user rendering measurements.

A release cache and identity bundles trade disk space for quick delivery. Gzip still leaves roughly 10 MiB of JSON to parse, and all-network rendering can remain significant on slower devices. Docker image creation and full production browser profiling require a deployment environment; Docker is not installed in this workspace.

Verification in this checkout passed all 42 backend tests, all 38 frontend tests, TypeScript checking, and the complete build-and-copy workflow.

The implementation also corrects three pre-existing TypeScript annotations found during verification (help-entry optional fields, the PrimeReact/local tree-node boundary, and the existing persistent-highlight navigation option). These changes preserve runtime behavior.
