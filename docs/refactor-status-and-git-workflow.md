# Refactor Status Review + Standard Git Workflow

Date: 2026-04-07

## 1) Repository status against the original multi-PR refactor plan

### Snapshot summary

- The backend has already been partially modularized from a monolithic `app.py` into route, service, search, and state modules.
- The frontend explorer container has already been decomposed with dedicated hooks and service utilities.
- The archive-first phase appears **not yet completed** (no `archive/` directory currently present).
- TypeScript config alignment still needs work: Vite alias uses `./src` while `tsconfig.app.json` paths/include still point to `viewer/frontend/src/*`.
- Debug logging is still present and verbose in backend API flows, matching the stated preference to keep diagnostics.

### Detailed status by planned phase

#### PR 1 — Archive & Repository Hygiene

Status: **Not complete**

Evidence:
- No `archive/` directory currently exists.
- No visible archive destination for old reference data is present.

Action needed:
- Add a dedicated `archive/` structure.
- Move legacy/uncertain assets there (starting with old frontend reference material per earlier decision).

#### PR 2 — Backend Modularization (preserve debug logs)

Status: **Mostly complete**

Evidence:
- `backend/app.py` is now lightweight and delegates route registration.
- Route logic is separated into `backend/routes/api_routes.py` and `backend/routes/web_routes.py`.
- Search and taxonomy concerns are split into `backend/search/*` and `backend/services/*` modules.
- Verbose diagnostics are still present in API handlers.

Remaining opportunity:
- `api_routes.py` is still large and can be split further by endpoint domain in a later pass if desired.

#### PR 3 — Frontend Container Decomposition

Status: **Largely complete**

Evidence:
- `XBRLTaxonomyExplorerContainer.tsx` is now compact and orchestration-focused.
- Hooks exist for major concerns: `useEntrypointData`, `useAdvancedSearch`, `useTreeNavigation`.
- Service layer exists: `services/explorerApi.ts`.

Remaining opportunity:
- Continue minor cleanup by extracting any remaining cross-cutting utility logic into shared helpers where duplication appears.

#### PR 4 — Repetition + Dead Code Cleanup (archive-first)

Status: **Partially complete / needs a focused pass**

Evidence:
- Some structural cleanup already happened as part of PR2/PR3 style decomposition.
- Archive-first policy has not yet been visibly applied in-repo.

Action needed:
- Run an explicit unused/dead-code sweep and archive uncertain files instead of deleting.

#### PR 5 — TypeScript “Not Embarrassing” Pass

Status: **Not complete**

Evidence:
- `frontend/tsconfig.app.json` currently has mismatched alias/include paths (`viewer/frontend/src`) vs actual Vite alias (`./src`).
- Strictness remains mostly disabled, which is fine for incremental adoption, but alias consistency should be fixed first.

Action needed:
- Align TS and Vite path resolution first.
- Then apply targeted type strengthening in explorer/search payloads.

#### PR 6 — Stabilization + Handover Notes

Status: **Pending**

Action needed:
- Once archive + TS alignment + dead code pass are done, run stabilization checks and produce a concise architecture/handover note.

## 2) Updated refactor execution order (recommended)

Given current state, the original plan should be updated to avoid rework:

1. **PR-A: Git workflow guardrails + branch hygiene docs** (this document + operational discipline).
2. **PR-B: Archive phase** (create `archive/`, move agreed legacy/reference data safely).
3. **PR-C: TS alias/config alignment + targeted type cleanup** (low-risk correctness first).
4. **PR-D: Dead code/repetition sweep** (archive uncertain items, keep runtime behavior unchanged).
5. **PR-E: Stabilization and handover summary**.

This sequence matches current code reality better than restarting from a broad backend/frontend split.

## 3) Standard Git workflow we will always follow

This is the **mandatory workflow** for every change set.

### A. Start of work (state verification)

```bash
git fetch --all --prune
git branch --show-current
git status
git log --oneline --decorate -n 5
```

Rules:
- Never start new work without first checking branch + clean status.
- If branch is stale or unknown, stop and reset to `main` flow below.

### B. Sync main before creating a feature branch

```bash
git switch main
git pull --ff-only origin main
```

Rules:
- `main` must fast-forward cleanly before branching.
- Do not branch from stale `main`.

### C. Create exactly one task branch per PR

```bash
git switch -c feature/<short-task-name>
```

Examples:
- `feature/archive-oldref`
- `chore/ts-alias-alignment`
- `fix/search-filter-types`

### D. During implementation

```bash
git status
```

Rules:
- Keep commits small and scoped.
- Prefer multiple focused commits over one “misc changes” commit.
- Do not mix unrelated refactors in one branch.

### E. Pre-commit checks (project-relevant)

Run the agreed checks for that PR scope (examples):

```bash
# backend
python -m compileall backend

# frontend
npm --prefix frontend run build
```

Rules:
- If a check fails, fix or clearly document why before commit.

### F. Commit and push

```bash
git add -A
git commit -m "<Verb> <specific change>"
git push -u origin feature/<short-task-name>
```

Commit style:
- `Archive old frontend reference dataset`
- `Align tsconfig path alias with Vite`
- `Extract search filter helper for reuse`

### G. Open PR and merge policy

Rules:
- Open PR from feature branch into `main`.
- Review “Files changed” before merging.
- Use one consistent merge method for this repo (recommended: **Squash and merge** for clean solo history).
- After merge, always sync local/main before any next task.

### H. Post-merge cleanup (required)

```bash
git switch main
git pull --ff-only origin main
git branch -d feature/<short-task-name>
```

### I. Codex-specific guardrail (critical)

At the start of every Codex task, explicitly confirm in prompt:
- target repo
- target base branch (`main`)
- expected working branch name for the new PR

At the end of every Codex task, verify commands are shown in output:
- current branch
- git status
- latest commit hash

This prevents stale-branch PR drift and repeated merge conflicts.

## 4) Confirmed next steps before proceeding

No further refactor implementation should start until these are acknowledged:

1. Approve this updated order: **PR-A → PR-B → PR-C → PR-D → PR-E**.
2. Confirm merge style default for this repo (**Squash and merge** recommended).
3. Confirm branch naming convention (`feature/`, `fix/`, `chore/`) to enforce consistently.
4. Then begin PR-B (archive phase) on a fresh branch from updated `main`.

