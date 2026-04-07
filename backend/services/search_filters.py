import json
import os
import re


def entrypoint_name_from_href(href: str) -> str:
    raw_entrypoint_name = os.path.splitext(os.path.basename(href))[0]
    return re.split(r"[-_]\d{4}-\d{2}-\d{2}", raw_entrypoint_name)[0]


def entrypoint_cache_key(year: str, href: str) -> str:
    return f"{year}::{entrypoint_name_from_href(href)}"


def normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v == "true":
            return True
        if v == "false":
            return False
    return None


def roman_to_int(token: str):
    """
    Convert simple roman numerals to int for sorting.
    Returns None if token is not a valid roman numeral.
    """
    if not token:
        return None
    token = token.lower().strip()
    roman_map = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
    if any(ch not in roman_map for ch in token):
        return None

    total = 0
    prev = 0
    for ch in reversed(token):
        val = roman_map[ch]
        if val < prev:
            total -= val
        else:
            total += val
        prev = val

    # Very loose validity guard: ensure token was actually roman-looking
    # (prevents accidental conversion of random alpha strings)
    return total if total > 0 else None


def natural_sort_key(value: str):
    """
    Human sort for source-like labels:
    IFRS 2 < IFRS 10, IAS 7 < IAS 37.
    """
    s = (value or "").strip().lower()
    parts = re.split(r"(\d+)", s)
    key = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return key


def paragraph_sort_key(value: str):
    """
    Sort paragraph refs more naturally:
      34.7.c.i < 34.7.c.ii < 34.7.c.v < 34.7A < 35.11 < 35.12A ...
    Handles:
      - numeric tokens
      - alpha tokens
      - roman numerals (i, ii, iii, iv, ...)
      - mixed tokens like 12A
      - punctuation separators ., , -, spaces, etc.
    """
    s = (value or "").strip().lower()

    # split on non-alnum, preserving sequence
    primary_parts = re.split(r"[^a-z0-9]+", s)

    key = []
    for part in primary_parts:
        if not part:
            continue

        # split mixed chunks into digit/non-digit components
        subparts = re.split(r"(\d+)", part)
        for sp in subparts:
            if not sp:
                continue

            if sp.isdigit():
                key.append((0, int(sp)))
                continue

            # alphabetic segment - try roman numeral first
            roman_val = roman_to_int(sp)
            if roman_val is not None:
                key.append((1, roman_val))  # roman bucket
            else:
                key.append((2, sp))  # plain alpha bucket

    return key


def load_concepts_json_for_entrypoint(taxonomy_base_dir: str, year: str, href: str) -> dict:
    entrypoint_name = entrypoint_name_from_href(href)
    concepts_path = os.path.join(
        taxonomy_base_dir, year, "trees", entrypoint_name, "concepts.json"
    )
    if not os.path.exists(concepts_path):
        return {}
    with open(concepts_path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_search_filter_options_from_concepts(concepts: dict) -> dict:
    namespaces = set()
    balances = set()
    periods = set()
    xbrl_types = set()
    full_types = set()
    substitution_groups = set()

    abstract_values = set()
    nillable_values = set()

    reference_sources = set()
    paragraphs_by_source = {}

    for _, entry in (concepts or {}).items():
        concept = (entry or {}).get("concept", {}) or {}

        namespace = concept.get("namespace")
        balance = concept.get("balance")
        period_type = concept.get("period_type")
        xbrl_type = concept.get("xbrl_type")
        full_type = concept.get("full_type")
        substitution_group = concept.get("substitution_group")

        if namespace:
            namespaces.add(str(namespace))
        if balance:
            balances.add(str(balance))
        if period_type:
            periods.add(str(period_type))
        if xbrl_type:
            xbrl_types.add(str(xbrl_type))
        if full_type:
            full_types.add(str(full_type))
        if substitution_group:
            substitution_groups.add(str(substitution_group))

        abstract_bool = normalize_bool(concept.get("abstract"))
        nillable_bool = normalize_bool(concept.get("nillable"))
        if abstract_bool is not None:
            abstract_values.add(abstract_bool)
        if nillable_bool is not None:
            nillable_values.add(nillable_bool)

        for ref in (entry or {}).get("references", []) or []:
            name = (ref.get("name") or "").strip()
            number = (ref.get("number") or "").strip()
            paragraph = (ref.get("paragraph") or "").strip()

            # source display key: "FRS 102", "IFRS 15", etc.
            if not name and not number:
                continue

            source = f"{name} {number}".strip()
            reference_sources.add(source)

            if source not in paragraphs_by_source:
                paragraphs_by_source[source] = set()

            if paragraph:
                paragraphs_by_source[source].add(paragraph)

    return {
        "namespace": sorted(namespaces, key=natural_sort_key),
        "balance": sorted(balances, key=natural_sort_key),
        "periodType": sorted(periods, key=natural_sort_key),
        "xbrlType": sorted(xbrl_types, key=natural_sort_key),
        "fullType": sorted(full_types, key=natural_sort_key),
        "abstract": sorted(abstract_values),  # [False, True]
        "nillable": sorted(nillable_values),  # [False, True]
        "substitutionGroup": sorted(substitution_groups, key=natural_sort_key),
        "referenceSources": sorted(reference_sources, key=natural_sort_key),
        "referenceParagraphsBySource": {
            source: sorted(values, key=paragraph_sort_key)
            for source, values in sorted(
                paragraphs_by_source.items(), key=lambda kv: natural_sort_key(kv[0])
            )
        },
    }
