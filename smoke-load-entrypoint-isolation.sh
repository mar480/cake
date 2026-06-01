#!/usr/bin/env bash
set -euo pipefail

# Smoke test for /api/load-entrypoint per-entrypoint isolation.
#
# Prerequisite: start the backend before running this script, for example:
#   cd backend && python app.py
#
# Usage:
#   ./smoke-load-entrypoint-isolation.sh
#
# Optional overrides:
#   BASE_URL=http://127.0.0.1:5000 ./smoke-load-entrypoint-isolation.sh
#   YEAR_A=2026 HREF_A='https://...' YEAR_B=2025 HREF_B='https://...' ./smoke-load-entrypoint-isolation.sh

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

YEAR_A="${YEAR_A:-2026}"
HREF_A="${HREF_A:-https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd}"

YEAR_B="${YEAR_B:-2025}"
HREF_B="${HREF_B:-https://xbrl.frc.org.uk/IFRS/2025-01-01/IFRS-2025-01-01.xsd}"

REQUIRED_TREE_KEYS_A="${REQUIRED_TREE_KEYS_A:-presentation_tree concepts}"
REQUIRED_TREE_KEYS_B="${REQUIRED_TREE_KEYS_B:-presentation_tree concepts}"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }
info() { echo "ℹ️  $1"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }
need_cmd curl

PYTHON_CMD=()

try_python_cmd() {
  local candidate="$1"
  local -a parts=()
  read -r -a parts <<<"$candidate"

  if [[ ${#parts[@]} -eq 0 ]] || ! command -v "${parts[0]}" >/dev/null 2>&1; then
    return 1
  fi

  "${parts[@]}" -c 'import json' >/dev/null 2>&1
}

select_python_cmd() {
  local candidates=()

  if [[ -n "${PYTHON:-}" ]]; then
    candidates+=("$PYTHON")
  fi

  candidates+=("python3" "python" "py -3" "py")

  local candidate
  for candidate in "${candidates[@]}"; do
    if try_python_cmd "$candidate"; then
      read -r -a PYTHON_CMD <<<"$candidate"
      return 0
    fi
  done

  fail "Could not find a working Python command. Set PYTHON=/path/to/python and try again."
}

json_body() {
  local year="$1"
  local href="$2"

  "${PYTHON_CMD[@]}" -c 'import json, sys; print(json.dumps({"year": sys.argv[1], "href": sys.argv[2]}))' "$year" "$href"
}

post_load_entrypoint() {
  local label="$1"
  local year="$2"
  local href="$3"
  local out_file="$4"
  local body
  local status

  body="$(json_body "$year" "$href")"
  info "POST /api/load-entrypoint for $label (year=$year href=$href)"

  status="$(curl -sS -o "$out_file" -w '%{http_code}' \
    -X POST "$BASE_URL/api/load-entrypoint" \
    -H 'Content-Type: application/json' \
    -d "$body")"

  if [[ "$status" != "200" ]]; then
    echo "---- $label response (HTTP $status) ----"
    cat "$out_file"
    echo
    echo "----------------------------------------"
    fail "$label expected HTTP 200, got $status"
  fi
}

select_python_cmd

A1_JSON="$TMP_DIR/load-entrypoint-a1.json"
B_JSON="$TMP_DIR/load-entrypoint-b.json"
A2_JSON="$TMP_DIR/load-entrypoint-a2.json"

post_load_entrypoint "entrypoint A first load" "$YEAR_A" "$HREF_A" "$A1_JSON"
post_load_entrypoint "entrypoint B" "$YEAR_B" "$HREF_B" "$B_JSON"
post_load_entrypoint "entrypoint A second load" "$YEAR_A" "$HREF_A" "$A2_JSON"

A1_JSON="$A1_JSON" \
B_JSON="$B_JSON" \
A2_JSON="$A2_JSON" \
HREF_A="$HREF_A" \
HREF_B="$HREF_B" \
REQUIRED_TREE_KEYS_A="$REQUIRED_TREE_KEYS_A" \
REQUIRED_TREE_KEYS_B="$REQUIRED_TREE_KEYS_B" \
"${PYTHON_CMD[@]}" - <<'PY'
import json
import os
from pathlib import Path


def load_json(path_env):
    path = Path(os.environ[path_env])
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def require_loaded(payload, label):
    assert payload.get("status") == "loaded", f"{label} did not return status=loaded"
    assert isinstance(payload.get("trees"), dict), f"{label} did not return a trees object"
    assert payload["trees"], f"{label} returned an empty trees object"


def require_tree_keys(payload, keys, label):
    trees = payload["trees"]
    for key in keys.split():
        assert key in trees, f"{label} missing expected tree key: {key}"


a1 = load_json("A1_JSON")
b = load_json("B_JSON")
a2 = load_json("A2_JSON")

require_loaded(a1, "entrypoint A first load")
require_loaded(b, "entrypoint B")
require_loaded(a2, "entrypoint A second load")

require_tree_keys(a1, os.environ["REQUIRED_TREE_KEYS_A"], "entrypoint A first load")
require_tree_keys(b, os.environ["REQUIRED_TREE_KEYS_B"], "entrypoint B")
require_tree_keys(a2, os.environ["REQUIRED_TREE_KEYS_A"], "entrypoint A second load")

assert a1.get("entrypoint") == a2.get("entrypoint"), "entrypoint A changed after loading B"
assert set(a1["trees"].keys()) == set(a2["trees"].keys()), "entrypoint A tree keys changed after loading B"
assert "concepts" in a2["trees"], "entrypoint A concepts tree missing after loading B"
assert "presentation_tree" in a1["trees"], "entrypoint A presentation_tree missing"
assert "presentation_tree" in b["trees"], "entrypoint B presentation_tree missing"

if os.environ["HREF_A"] != os.environ["HREF_B"]:
    assert a1.get("entrypoint") != b.get("entrypoint"), "test fixtures should use distinct entrypoint names"

print("load-entrypoint isolation assertions passed")
PY

pass "all three load-entrypoint responses returned status=loaded"
pass "entrypoint A contains required tree keys: $REQUIRED_TREE_KEYS_A"
pass "entrypoint B contains required tree keys: $REQUIRED_TREE_KEYS_B"
pass "loading entrypoint B did not break entrypoint A"
