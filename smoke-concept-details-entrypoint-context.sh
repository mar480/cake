#!/usr/bin/env bash
set -euo pipefail

# Smoke test for /api/concept-details entrypoint scoping.
#
# By default this script uses two checked-in taxonomy entrypoints and qnames whose
# namespace values differ by year. It requests A, then B, then A again and asserts
# A did not change after B was requested.
#
# Usage:
#   ./smoke-concept-details-entrypoint-context.sh
#
# Optional overrides:
#   BASE_URL=http://127.0.0.1:5000 ./smoke-concept-details-entrypoint-context.sh
#   START_BACKEND=0 ./smoke-concept-details-entrypoint-context.sh  # require running backend

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
START_BACKEND="${START_BACKEND:-auto}"
BACKEND_PORT="${BACKEND_PORT:-5000}"

YEAR_A="${YEAR_A:-2026}"
HREF_A="${HREF_A:-https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd}"
QNAME_A="${QNAME_A:-core:TurnoverRevenue}"
EXPECTED_NAMESPACE_A="${EXPECTED_NAMESPACE_A:-http://xbrl.frc.org.uk/fr/2026-01-01/core}"

YEAR_B="${YEAR_B:-2025}"
HREF_B="${HREF_B:-https://xbrl.frc.org.uk/FRS-101/2025-01-01/FRS-101-2025-01-01.xsd}"
QNAME_B="${QNAME_B:-core:TurnoverRevenue}"
EXPECTED_NAMESPACE_B="${EXPECTED_NAMESPACE_B:-http://xbrl.frc.org.uk/fr/2025-01-01/core}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
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

  "${parts[@]}" -c 'import json, urllib.parse' >/dev/null 2>&1
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

select_python_cmd

healthcheck() {
  curl -fsS --max-time 2 "$BASE_URL/api/health" >/dev/null 2>&1
}

wait_for_backend() {
  local attempts="${1:-30}"
  for _ in $(seq 1 "$attempts"); do
    if healthcheck; then
      return 0
    fi
    sleep 1
  done
  return 1
}

maybe_start_backend() {
  if healthcheck; then
    pass "backend is already running at $BASE_URL"
    return 0
  fi

  if [[ "$START_BACKEND" == "0" || "$START_BACKEND" == "false" ]]; then
    fail "backend is not reachable at $BASE_URL. Start it first or omit START_BACKEND=0."
  fi

  case "$BASE_URL" in
    "http://127.0.0.1:${BACKEND_PORT}"|"http://localhost:${BACKEND_PORT}")
      info "backend not reachable; starting backend on port $BACKEND_PORT"
      (cd "$SCRIPT_DIR/backend" && "${PYTHON_CMD[@]}" app.py --port "$BACKEND_PORT") >"$TMP_DIR/backend.log" 2>&1 &
      BACKEND_PID="$!"
      if ! wait_for_backend 45; then
        echo "---- backend log ----"
        cat "$TMP_DIR/backend.log" || true
        echo "---------------------"
        fail "backend did not become healthy at $BASE_URL"
      fi
      pass "started backend at $BASE_URL"
      ;;
    *)
      fail "backend is not reachable at $BASE_URL. For auto-start, use http://127.0.0.1:${BACKEND_PORT} or http://localhost:${BACKEND_PORT}."
      ;;
  esac
}

urlencode() {
  "${PYTHON_CMD[@]}" -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

concept_url() {
  local year="$1"
  local href="$2"
  local qname="$3"
  printf '%s/api/concept-details?year=%s&href=%s&qname=%s' \
    "$BASE_URL" "$(urlencode "$year")" "$(urlencode "$href")" "$(urlencode "$qname")"
}

fetch_concept() {
  local label="$1"
  local year="$2"
  local href="$3"
  local qname="$4"
  local out_file="$5"

  info "requesting concept $label ($year, $qname)"
  curl -fsS "$(concept_url "$year" "$href" "$qname")" >"$out_file"
}

maybe_start_backend

A1_JSON="$TMP_DIR/concept-a-1.json"
B_JSON="$TMP_DIR/concept-b.json"
A2_JSON="$TMP_DIR/concept-a-2.json"

fetch_concept "A first pass" "$YEAR_A" "$HREF_A" "$QNAME_A" "$A1_JSON"
fetch_concept "B" "$YEAR_B" "$HREF_B" "$QNAME_B" "$B_JSON"
fetch_concept "A second pass" "$YEAR_A" "$HREF_A" "$QNAME_A" "$A2_JSON"

A1_JSON="$A1_JSON" \
A2_JSON="$A2_JSON" \
B_JSON="$B_JSON" \
QNAME_A="$QNAME_A" \
QNAME_B="$QNAME_B" \
EXPECTED_NAMESPACE_A="$EXPECTED_NAMESPACE_A" \
EXPECTED_NAMESPACE_B="$EXPECTED_NAMESPACE_B" \
"${PYTHON_CMD[@]}" - <<'PY'
import json
import os
from pathlib import Path

expected_qname_a = os.environ["QNAME_A"]
expected_qname_b = os.environ["QNAME_B"]
expected_namespace_a = os.environ["EXPECTED_NAMESPACE_A"]
expected_namespace_b = os.environ["EXPECTED_NAMESPACE_B"]

def load(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)

a1 = load(os.environ["A1_JSON"])
a2 = load(os.environ["A2_JSON"])
b = load(os.environ["B_JSON"])

assert a1["concept"]["qname"] == expected_qname_a, "Concept A first response returned the wrong qname"
assert a2["concept"]["qname"] == expected_qname_a, "Concept A second response returned the wrong qname"
assert b["concept"]["qname"] == expected_qname_b, "Concept B returned the wrong qname"

assert a1["concept"]["namespace"] == expected_namespace_a, "Concept A first response returned the wrong namespace"
assert a2["concept"]["namespace"] == expected_namespace_a, "Concept A second response returned the wrong namespace"
assert b["concept"]["namespace"] == expected_namespace_b, "Concept B returned the wrong namespace"

assert a1["concept"]["qname"] == a2["concept"]["qname"], "Concept A qname changed after requesting B"
assert a1["concept"]["namespace"] == a2["concept"]["namespace"], "Concept A namespace changed after requesting B"
assert expected_namespace_a != expected_namespace_b, "Smoke test fixtures should use distinct namespaces"

print("concept details entrypoint-context smoke test passed")
PY

pass "concept details entrypoint-context smoke test passed"
