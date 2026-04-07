# PR-D archive (dead code/repetition cleanup)

Date: 2026-04-07

This archive captures frontend artifacts that were not referenced by the active application entry path (`frontend/src/main.tsx` -> `App` -> `Index` -> taxonomy explorer container) at the time of the PR-D sweep.

Archived items were moved (not deleted) to preserve history and allow easy restoration if needed.

## Archived artifacts

- Legacy, unused taxonomy explorer panels:
  - `DetailPanel.tsx`
  - `ToolsPanel.tsx`
- Unused legacy shared type file:
  - `frontend/src/components/types.ts`
- Unused Supabase template integration files:
  - `frontend/src/integrations/supabase/client.ts`
  - `frontend/src/integrations/supabase/types.ts`
- Unused stylesheets:
  - `frontend/src/App.css`
  - `frontend/src/custom.css`

## Validation

After moving these files, frontend build and backend bytecode compilation checks still pass.
