#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
YEAR="${YEAR:-2026}"
Q="${Q:-turnover}"
HREF="${HREF:-https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd}" # optional override

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }
info() { echo "ℹ️  $1"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }

need_cmd curl
need_cmd jq

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local out_file
  out_file="$(mktemp)"
  local status

  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' -d "$body")"
  else
    status="$(curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url")"
  fi

  echo "$status|$out_file"
}

assert_status() {
  local status="$1"
  local expected="$2"
  local context="$3"
  [[ "$status" == "$expected" ]] || {
    echo "---- $context response ----"
    cat "$4" | jq . || cat "$4"
    echo "---------------------------"
    fail "$context expected HTTP $expected, got $status"
  }
}

# 1) Discover entrypoints
ep_resp="$(request_json GET "$BASE_URL/api/entrypoints?year=$YEAR")"
ep_status="${ep_resp%%|*}"
ep_file="${ep_resp##*|}"
assert_status "$ep_status" "200" "entrypoints lookup" "$ep_file"

if [[ -z "$HREF" ]]; then
  HREF="$(jq -r '.entrypoints[0].href // empty' "$ep_file")"
fi
[[ -n "$HREF" ]] || fail "No href available. Set HREF env var or check /api/entrypoints output."
pass "resolved href: $HREF"

# 2) Load entrypoint
load_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" '{year:$y, href:$h}')"
load_resp="$(request_json POST "$BASE_URL/api/load-entrypoint" "$load_body")"
load_status="${load_resp%%|*}"
load_file="${load_resp##*|}"
assert_status "$load_status" "200" "load-entrypoint" "$load_file"
jq -e '.status=="loaded"' "$load_file" >/dev/null || {
  cat "$load_file" | jq .
  fail "load-entrypoint did not return status=loaded"
}
pass "load-entrypoint succeeded"

# helper for search calls
search_call() {
  local body="$1"
  request_json POST "$BASE_URL/api/search-concepts" "$body"
}

# 3) Happy path
happy_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{}, limit:25, offset:0}')"
happy_resp="$(search_call "$happy_body")"
happy_status="${happy_resp%%|*}"
happy_file="${happy_resp##*|}"
assert_status "$happy_status" "200" "happy search" "$happy_file"
jq -e '.results and .total!=null and .limit==25 and .offset==0' "$happy_file" >/dev/null \
  || fail "Happy path missing expected keys"
pass "happy path returns paginated JSON"

# 4) Missing year/href
bad1_resp="$(search_call '{"q":"turnover"}')"
bad1_status="${bad1_resp%%|*}"
bad1_file="${bad1_resp##*|}"
assert_status "$bad1_status" "400" "missing year/href" "$bad1_file"
jq -e '.error=="Missing year or href"' "$bad1_file" >/dev/null \
  || fail "Unexpected missing year/href error message"
pass "missing year/href validation"

# 5) limit upper bound
bad2_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{}, limit:101, offset:0}')"
bad2_resp="$(search_call "$bad2_body")"
bad2_status="${bad2_resp%%|*}"
bad2_file="${bad2_resp##*|}"
assert_status "$bad2_status" "400" "limit upper bound" "$bad2_file"
jq -e '.error=="limit must be between 1 and 100"' "$bad2_file" >/dev/null \
  || fail "Unexpected limit error message"
pass "limit upper-bound validation"

# 6) offset lower bound
bad3_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{}, limit:25, offset:-1}')"
bad3_resp="$(search_call "$bad3_body")"
bad3_status="${bad3_resp%%|*}"
bad3_file="${bad3_resp##*|}"
assert_status "$bad3_status" "400" "offset lower bound" "$bad3_file"
jq -e '.error=="offset must be >= 0"' "$bad3_file" >/dev/null \
  || fail "Unexpected offset error message"
pass "offset lower-bound validation"

# 7) Deterministic ordering
ord1_resp="$(search_call "$happy_body")"
ord2_resp="$(search_call "$happy_body")"
ord1_file="${ord1_resp##*|}"
ord2_file="${ord2_resp##*|}"

ord1="$(jq -c '[.results[].qname]' "$ord1_file")"
ord2="$(jq -c '[.results[].qname]' "$ord2_file")"
[[ "$ord1" == "$ord2" ]] || fail "Ordering changed between identical requests"
pass "deterministic order across repeated identical calls"

# 8) Pagination shift
p1_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{}, limit:10, offset:0}')"
p2_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{}, limit:10, offset:10}')"

p1_resp="$(search_call "$p1_body")"
p2_resp="$(search_call "$p2_body")"
p1_file="${p1_resp##*|}"
p2_file="${p2_resp##*|}"

p1_first="$(jq -r '.results[0].qname // empty' "$p1_file")"
p2_first="$(jq -r '.results[0].qname // empty' "$p2_file")"

if [[ -n "$p1_first" && -n "$p2_first" && "$p1_first" == "$p2_first" ]]; then
  fail "Pagination appears not to shift (same first item on page 1 and 2)"
fi
pass "pagination offset shifts result window"

# 9) Filter smoke (balance)
filt_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" --arg q "$Q" \
  '{year:$y, href:$h, q:$q, filters:{balance:["credit"]}, limit:25, offset:0}')"
filt_resp="$(search_call "$filt_body")"
filt_status="${filt_resp%%|*}"
filt_file="${filt_resp##*|}"
assert_status "$filt_status" "200" "balance filter search" "$filt_file"
jq -e '.total!=null' "$filt_file" >/dev/null || fail "Filtered search missing total"
pass "filter path executes"

# 10) Explainability shape
jq -e '(.results|length)==0 or (.results[0].score_breakdown|type=="object")' "$happy_file" >/dev/null \
  || fail "score_breakdown missing from result payload"
pass "score breakdown present for explainability"

echo
pass "All smoke checks passed"