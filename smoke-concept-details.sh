#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat <<'MSG'
ℹ️  /api/concept-details now requires explicit year, href, and qname query parameters.
ℹ️  Running the entrypoint-context smoke test instead.
MSG

exec "$SCRIPT_DIR/smoke-concept-details-entrypoint-context.sh"
