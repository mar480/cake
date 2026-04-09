#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000}"
YEAR="${YEAR:-2026}"
HREF="${HREF:-https://xbrl.frc.org.uk/FRS-102/2026-01-01/FRS-102-2026-01-01.xsd}"
GOOD_QNAME="${GOOD_QNAME:-core:TurnoverRevenue}"
BAD_QNAME_FORMAT="${BAD_QNAME_FORMAT:-not-a-qname}"
BAD_PREFIX_QNAME="${BAD_PREFIX_QNAME:-madeup:Whatever}"
BAD_CONCEPT_QNAME="${BAD_CONCEPT_QNAME:-core:DefinitelyNotRealConcept}"

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
  local actual="$1"
  local expected="$2"
  local context="$3"
  local file="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "---- $context response ----"
    cat "$file" | jq . || cat "$file"
    echo "---------------------------"
    fail "$context expected HTTP $expected, got $actual"
  fi
}

info "1) Invalid qname format should be 400"
r1="$(request_json GET "$BASE_URL/api/concept-details?qname=$(python - <<'PY'
import urllib.parse
print(urllib.parse.quote("not-a-qname", safe=""))
PY
)")"
s1="${r1%%|*}"; f1="${r1##*|}"
assert_status "$s1" "400" "invalid qname" "$f1"
jq -e '.error=="Invalid qname"' "$f1" >/dev/null || fail "invalid qname error message mismatch"
pass "invalid qname returns 400"

info "2) Load entrypoint"
load_body="$(jq -cn --arg y "$YEAR" --arg h "$HREF" '{year:$y, href:$h}')"
r2="$(request_json POST "$BASE_URL/api/load-entrypoint" "$load_body")"
s2="${r2%%|*}"; f2="${r2##*|}"
assert_status "$s2" "200" "load-entrypoint" "$f2"
jq -e '.status=="loaded"' "$f2" >/dev/null || fail "load-entrypoint status not loaded"
pass "entrypoint loaded"

info "3) Valid concept qname should be 200"
enc_good="$(python - <<PY
import urllib.parse
print(urllib.parse.quote("$GOOD_QNAME", safe=""))
PY
)"
r3="$(request_json GET "$BASE_URL/api/concept-details?qname=$enc_good")"
s3="${r3%%|*}"; f3="${r3##*|}"
assert_status "$s3" "200" "valid concept-details" "$f3"
jq -e '.concept and .concept.qname != null' "$f3" >/dev/null || fail "valid concept payload shape mismatch"
pass "valid concept returns 200"

info "4) Unknown prefix should be 404"
enc_bad_prefix="$(python - <<PY
import urllib.parse
print(urllib.parse.quote("$BAD_PREFIX_QNAME", safe=""))
PY
)"
r4="$(request_json GET "$BASE_URL/api/concept-details?qname=$enc_bad_prefix")"
s4="${r4%%|*}"; f4="${r4##*|}"
assert_status "$s4" "404" "unknown prefix" "$f4"
jq -e '.error|type=="string"' "$f4" >/dev/null || fail "unknown prefix payload mismatch"
pass "unknown prefix returns 404"

info "5) Unknown concept (valid prefix) should be 404"
enc_bad_concept="$(python - <<PY
import urllib.parse
print(urllib.parse.quote("$BAD_CONCEPT_QNAME", safe=""))
PY
)"
r5="$(request_json GET "$BASE_URL/api/concept-details?qname=$enc_bad_concept")"
s5="${r5%%|*}"; f5="${r5##*|}"
assert_status "$s5" "404" "unknown concept" "$f5"
jq -e '.error|type=="string"' "$f5" >/dev/null || fail "unknown concept payload mismatch"
pass "unknown concept returns 404"

info "6) Optional concurrency probe (load + concept-details in parallel)"
for i in {1..5}; do
  request_json POST "$BASE_URL/api/load-entrypoint" "$load_body" >/dev/null &
done
wait

# Query once more after churn; expect stable success or a retryable 503 if still transitioning
r6="$(request_json GET "$BASE_URL/api/concept-details?qname=$enc_good")"
s6="${r6%%|*}"; f6="${r6##*|}"
if [[ "$s6" == "200" ]]; then
  pass "post-churn concept-details stabilized at 200"
elif [[ "$s6" == "503" ]]; then
  jq -e '.retryable==true' "$f6" >/dev/null || fail "503 without retryable=true"
  pass "post-churn returned retryable 503 (acceptable transitional behavior)"
else
  echo "---- post-churn response ----"
  cat "$f6" | jq . || cat "$f6"
  echo "-----------------------------"
  fail "unexpected post-churn status: $s6"
fi

echo
pass "All concept-details transition checks passed"