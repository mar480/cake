# Refactor Status Review + Standard Git Workflow

Date: 2026-04-07

## 0) Branch/commit verification protocol (must run first)

Before each refactor PR review or merge decision, run:

```bash
git fetch --all --prune
git branch --show-current
git rev-parse HEAD
git status
```

Use this to confirm we are on the expected branch/commit for the discussion.

---

## 1) Repository status against the original multi-PR refactor plan

### Snapshot summary

- Backend modularization is already in place (routes/services/search/state split).
- Frontend container decomposition is already in place (hooks + service extraction).
- Archive phase has **already started** via `old_app_before_refactor/` (explicitly ignored in `.gitignore`).
- TypeScript alias/config alignment still needs work (`tsconfig.app.json` path/include mismatch vs Vite alias).
- Verbose backend debug logs are present and retained as requested.

### Detailed status by planned phase

#### PR 1 — Archive & Repository Hygiene

Status: **Complete (baseline achieved), with optional extension**

Evidence:
- `old_app_before_refactor/` is already excluded in `.gitignore`, indicating archive safety was applied.

Remaining option:
- Create an in-repo `archive/` folder for additional uncertain/dead artifacts that should remain visible in history.

#### PR 2 — Backend Modularization (preserve debug logs)

Status: **Mostly complete**

Evidence:
- `backend/app.py` is lightweight and delegates route registration.
- Routing is split into `backend/routes/api_routes.py` and `backend/routes/web_routes.py`.
- Search and taxonomy concerns are separated under `backend/search/*` and `backend/services/*`.
- Verbose diagnostics remain in endpoint flows.

Remaining opportunity:
- `api_routes.py` can be split further by endpoint domain later, if wanted.

#### PR 3 — Frontend Container Decomposition

Status: **Largely complete**

Evidence:
- `XBRLTaxonomyExplorerContainer.tsx` is orchestration-focused.
- Hooks exist for key concerns: `useEntrypointData`, `useAdvancedSearch`, `useTreeNavigation`.
- API logic exists in `services/explorerApi.ts`.

Remaining opportunity:
- Continue minor utility deduplication where repetition still exists.

#### PR 4 — Repetition + Dead Code Cleanup (archive-first)

Status: **Partially complete / needs focused pass**

Evidence:
- Structural cleanup already happened during modularization.
- A dedicated archive extension pass has not yet been done for newly identified uncertain files.

Action needed:
- Perform unused/dead-code sweep and move uncertain items into archive rather than deleting.

#### PR 5 — TypeScript “Not Embarrassing” Pass

Status: **Not complete**

Evidence:
- `frontend/tsconfig.app.json` still points to `viewer/frontend/src` while Vite alias points to `./src`.
- Strictness remains relaxed (acceptable for incremental approach).

Action needed:
- Align TS + Vite path resolution first.
- Then tighten typing in high-value flows (entrypoint/search payloads).

#### PR 6 — Stabilization + Handover Notes

Status: **Pending**

Action needed:
- Final parity checks + concise architecture/handover summary once archive/type/dead-code passes are complete.

---

## 2) Updated execution order from this point

Given PR1 is already effectively in place, proceed as:

1. **PR-B**: archive extension pass (only where new uncertain files are discovered).
2. **PR-C**: TS alias/config alignment + targeted type improvements.
3. **PR-D**: dead code/repetition cleanup (archive-first).
4. **PR-E**: stabilization + handover note.

---

## 3) Standard Git workflow we will always follow

### A. Start-of-task verification (mandatory)

```bash
git fetch --all --prune
git branch --show-current
git rev-parse --short HEAD
git status
git log --oneline --decorate -n 5
```

Rules:
- Never start coding without branch + commit verification.
- If branch is stale/unclear, stop and re-sync from `main`.

### B. Sync base branch

```bash
git switch main
git pull --ff-only origin main
```

### C. Create one branch per PR

```bash
git switch -c feature/<short-task-name>
```

Examples:
- `feature/archive-extension`
- `chore/ts-alias-alignment`
- `fix/advanced-search-types`

### D. Implement in small, clear commits

```bash
git status
```

Rules:
- Keep scope tight.
- Avoid mixing unrelated changes.
- Prefer multiple meaningful commits over one giant commit.

### E. Run checks for PR scope

```bash
python -m compileall backend
npm --prefix frontend run build
```

### F. Commit and push

```bash
git add -A
git commit -m "<Verb> <specific change>"
git push -u origin feature/<short-task-name>
```

### G. Open and merge PR

Rules:
- PR from feature branch → `main`.
- Review diff before merge.
- Use one consistent merge mode (recommended: **Squash and merge**).

### H. Post-merge local cleanup

```bash
git switch main
git pull --ff-only origin main
git branch -d feature/<short-task-name>
```

### I. Codex/cloud guardrail

At task start, explicitly state:
- repo
- base branch (`main`)
- new working branch name

At task end, always show:
- current branch
- `git status`
- latest commit hash

---

## 4) Merge-sync drill (what we will test next)

After this PR is merged on GitHub:

### On your local machine

```bash
git switch main
git pull --ff-only origin main
git log --oneline --decorate -n 3
```

Expected result:
- `main` includes the merge commit (or squash commit) for this PR.

### In Codex environment (next task start)

```bash
git fetch --all --prune
git switch main
git pull --ff-only origin main
git branch --show-current
git rev-parse HEAD
git status
```

Expected result:
- Branch is `main`.
- HEAD matches latest remote `main` commit.
- Working tree is clean.

Only then create the next task branch and continue refactor work.

---

## 5) Confirmed next steps before proceeding

1. Merge this updated workflow/status doc PR.
2. Run the merge-sync drill above (local + Codex).
3. Start next implementation on a fresh feature branch from synced `main`.
4. Begin with **PR-B archive extension pass**, then proceed to PR-C.
