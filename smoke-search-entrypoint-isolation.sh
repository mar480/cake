#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
YEAR_A="${YEAR_A:-2026}"
HREF_A="${HREF_A:-https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd}"
Q_A="${Q_A:-turnover}"
EXPECT_A_QNAME_REGEX="${EXPECT_A_QNAME_REGEX:-^core:}"

YEAR_B="${YEAR_B:-lloyds-2025}"
HREF_B="${HREF_B:-https://www.lloyds.com/lloyds/2025-01-01/v2/lloyds-2025-01-01.xsd}"
Q_B="${Q_B:-syndicate}"
EXPECT_B_QNAME_REGEX="${EXPECT_B_QNAME_REGEX:-^lloyds:}"

LIMIT="${LIMIT:-10}"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }
info() { echo "ℹ️  $1"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }

need_cmd curl
need_cmd jq

request_search() {
  local year="$1"
  local href="$2"
  local query="$3"
  local out_file="$4"
  local body
  body="$(jq -cn \
    --arg year "$year" \
    --arg href "$href" \
    --arg query "$query" \
    --argjson limit "$LIMIT" \
    '{year:$year, href:$href, q:$query, filters:{}, limit:$limit, offset:0}')"

  curl -sS -o "$out_file" -w '%{http_code}' \
    "$BASE_URL/api/search-concepts" \
    -H "Content-Type: application/json" \
    -d "$body"
}

assert_status() {
  local status="$1"
  local expected="$2"
  local context="$3"
  local file="$4"

  if [[ "$status" != "$expected" ]]; then
    echo "---- $context response ----"
    jq . "$file" 2>/dev/null || cat "$file"
    echo "---------------------------"
    fail "$context expected HTTP $expected, got $status"
  fi
}

assert_has_results() {
  local file="$1"
  local context="$2"

  jq -e '(.results | type == "array") and ((.results | length) > 0) and (.total > 0)' "$file" >/dev/null \
    || {
      echo "---- $context response ----"
      jq . "$file" 2>/dev/null || cat "$file"
      echo "---------------------------"
      fail "$context returned no results"
    }
}

assert_qnames_match() {
  local file="$1"
  local regex="$2"
  local context="$3"

  jq -e --arg regex "$regex" 'all(.results[].qname; test($regex))' "$file" >/dev/null \
    || {
      echo "---- $context qnames ----"
      jq -r '.results[].qname' "$file" 2>/dev/null || cat "$file"
      echo "-------------------------"
      fail "$context contained qnames that did not match regex: $regex"
    }
}

qname_window() {
  local file="$1"
  jq -c '[.results[].qname]' "$file"
}

info "BASE_URL=$BASE_URL"
info "A: year=$YEAR_A href=$HREF_A q=$Q_A expect=$EXPECT_A_QNAME_REGEX"
info "B: year=$YEAR_B href=$HREF_B q=$Q_B expect=$EXPECT_B_QNAME_REGEX"

first_a_file="$(mktemp)"
second_b_file="$(mktemp)"
second_a_file="$(mktemp)"
trap 'rm -f "$first_a_file" "$second_b_file" "$second_a_file"' EXIT

# 1) Search entrypoint A for a term known to exist.
first_a_status="$(request_search "$YEAR_A" "$HREF_A" "$Q_A" "$first_a_file")"
assert_status "$first_a_status" "200" "first search for entrypoint A" "$first_a_file"
assert_has_results "$first_a_file" "first search for entrypoint A"
assert_qnames_match "$first_a_file" "$EXPECT_A_QNAME_REGEX" "first search for entrypoint A"
first_a_qnames="$(qname_window "$first_a_file")"
pass "entrypoint A first search returned results valid for A"

# 2) Search entrypoint B for a term known to exist.
second_b_status="$(request_search "$YEAR_B" "$HREF_B" "$Q_B" "$second_b_file")"
assert_status "$second_b_status" "200" "search for entrypoint B" "$second_b_file"
assert_has_results "$second_b_file" "search for entrypoint B"
assert_qnames_match "$second_b_file" "$EXPECT_B_QNAME_REGEX" "search for entrypoint B"
pass "entrypoint B search returned results valid for B"

# 3) Search entrypoint A again and assert the first result window is unchanged.
second_a_status="$(request_search "$YEAR_A" "$HREF_A" "$Q_A" "$second_a_file")"
assert_status "$second_a_status" "200" "second search for entrypoint A" "$second_a_file"
assert_has_results "$second_a_file" "second search for entrypoint A"
assert_qnames_match "$second_a_file" "$EXPECT_A_QNAME_REGEX" "second search for entrypoint A"
second_a_qnames="$(qname_window "$second_a_file")"

if [[ "$first_a_qnames" != "$second_a_qnames" ]]; then
  echo "---- entrypoint A first qnames ----"
  jq -r '.[]' <<<"$first_a_qnames"
  echo "---- entrypoint A second qnames ----"
  jq -r '.[]' <<<"$second_a_qnames"
  echo "-----------------------------------"
  fail "entrypoint A results changed after searching entrypoint B"
fi

pass "entrypoint A remained isolated after entrypoint B search"
pass "All entrypoint isolation smoke checks passed"
