import json
import os
import re
from urllib.parse import unquote, urlparse

from flask import Flask, g, jsonify, render_template, request, send_from_directory
from lxml import etree
from search.cache import get_search_index, set_search_index
from search.index_builder import build_search_index
from search.query_engine import search_index
from xbrl.loader import TaxonomyContext

taxonomy_cache = {}

search_filter_options_cache = {}  # key: "<year>::<entrypoint_name>" -> options payload


def _entrypoint_name_from_href(href: str) -> str:
    raw_entrypoint_name = os.path.splitext(os.path.basename(href))[0]
    return re.split(r"[-_]\d{4}-\d{2}-\d{2}", raw_entrypoint_name)[0]


def _entrypoint_cache_key(year: str, href: str) -> str:
    return f"{year}::{_entrypoint_name_from_href(href)}"


def _normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v == "true":
            return True
        if v == "false":
            return False
    return None


def _roman_to_int(token: str):
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


def _natural_sort_key(value: str):
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


def _paragraph_sort_key(value: str):
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
            roman_val = _roman_to_int(sp)
            if roman_val is not None:
                key.append((1, roman_val))  # roman bucket
            else:
                key.append((2, sp))  # plain alpha bucket

    return key


def _load_concepts_json_for_entrypoint(year: str, href: str) -> dict:
    entrypoint_name = _entrypoint_name_from_href(href)
    concepts_path = os.path.join(
        TAXONOMY_BASE_DIR, year, "trees", entrypoint_name, "concepts.json"
    )
    if not os.path.exists(concepts_path):
        return {}
    with open(concepts_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _build_search_filter_options_from_concepts(concepts: dict) -> dict:
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

        abstract_bool = _normalize_bool(concept.get("abstract"))
        nillable_bool = _normalize_bool(concept.get("nillable"))
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
        "namespace": sorted(namespaces, key=_natural_sort_key),
        "balance": sorted(balances, key=_natural_sort_key),
        "periodType": sorted(periods, key=_natural_sort_key),
        "xbrlType": sorted(xbrl_types, key=_natural_sort_key),
        "fullType": sorted(full_types, key=_natural_sort_key),
        "abstract": sorted(abstract_values),  # [False, True]
        "nillable": sorted(nillable_values),  # [False, True]
        "substitutionGroup": sorted(substitution_groups, key=_natural_sort_key),
        "referenceSources": sorted(reference_sources, key=_natural_sort_key),
        "referenceParagraphsBySource": {
            source: sorted(values, key=_paragraph_sort_key)
            for source, values in sorted(
                paragraphs_by_source.items(), key=lambda kv: _natural_sort_key(kv[0])
            )
        },
    }


app = Flask(__name__, static_folder="static", template_folder="templates")

TAXONOMY_BASE_DIR = os.path.join(os.path.dirname(__file__), "taxonomies")


@app.errorhandler(404)
def handle_404(err):
    """
    Ensure API clients always receive JSON, not HTML error pages.
    """
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found", "path": request.path}), 404
    return err


@app.errorhandler(405)
def handle_405(err):
    """
    Ensure API clients always receive JSON, not HTML error pages.
    """
    if request.path.startswith("/api/"):
        return (
            jsonify(
                {
                    "error": "Method not allowed",
                    "path": request.path,
                    "method": request.method,
                }
            ),
            405,
        )
    return err


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    """
    Prevent Flask's default HTML 500 page for API routes.
    """
    if request.path.startswith("/api/"):
        print(f"[api-error] {request.path}: {err}")
        return jsonify({"error": "Internal server error"}), 500
    raise err


def _is_lloyds_year_key(year: str) -> bool:
    return isinstance(year, str) and year.lower().startswith("lloyds")


def _is_http_href(href: str) -> bool:
    return isinstance(href, str) and href.startswith(("http://", "https://"))


def _find_local_entrypoint_from_href(year: str, href: str) -> str:
    """
    Resolve a remote entrypoint URL to a local file inside backend/taxonomies/<year>.
    Strategy:
      1) filename exact match
      2) URL path suffix match
    """
    year_root = os.path.join(TAXONOMY_BASE_DIR, year)
    if not os.path.isdir(year_root):
        raise FileNotFoundError(f"Year root not found: {year_root}")

    parsed = urlparse(href)
    remote_path = unquote(parsed.path).lstrip(
        "/"
    )  # e.g. lloyds/2025-.../lloyds-2025-...xsd
    base_name = os.path.basename(remote_path)

    file_paths = []
    for root, _, files in os.walk(year_root):
        for f in files:
            file_paths.append(os.path.join(root, f))

    # 1) Exact filename matches
    name_matches = [p for p in file_paths if os.path.basename(p) == base_name]
    if len(name_matches) == 1:
        return name_matches[0]
    if len(name_matches) > 1:
        name_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return name_matches[0]

    # 2) Path suffix match
    remote_suffix = remote_path.replace("\\", "/")
    suffix_matches = [
        p for p in file_paths if p.replace("\\", "/").endswith(remote_suffix)
    ]
    if len(suffix_matches) == 1:
        return suffix_matches[0]
    if len(suffix_matches) > 1:
        suffix_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return suffix_matches[0]

    raise FileNotFoundError(
        f"Could not map href to local file for year='{year}': {href}"
    )


def _safe_close_taxonomy(taxonomy_obj):
    if taxonomy_obj is None:
        return
    try:
        taxonomy_obj.controller.close()
    except Exception:
        pass


def _load_taxonomy_with_lloyds_fallback(year: str, href: str):
    """
    Primary: load href as-is.
    Fallback (Lloyds only): if remote load appears empty/forbidden, resolve local file and reload.
    """
    print(f"[taxonomy-load] Attempt primary load: {href}")
    primary = TaxonomyContext(href)
    primary_count = len(getattr(primary.model, "qnameConcepts", {}))
    print(f"[taxonomy-load] Primary qnameConcepts count={primary_count}")

    # Apply fallback only for Lloyds-style keys and only for remote hrefs with empty model
    if _is_lloyds_year_key(year) and _is_http_href(href) and primary_count == 0:
        print(
            "[taxonomy-load] Lloyds fallback triggered (empty model after remote load)"
        )
        _safe_close_taxonomy(primary)

        local_entrypoint = _find_local_entrypoint_from_href(year, href)
        print(f"[taxonomy-load] Local fallback entrypoint: {local_entrypoint}")

        fallback = TaxonomyContext(local_entrypoint)
        fallback_count = len(getattr(fallback.model, "qnameConcepts", {}))
        print(f"[taxonomy-load] Fallback qnameConcepts count={fallback_count}")

        if fallback_count == 0:
            _safe_close_taxonomy(fallback)
            raise RuntimeError(
                f"Local fallback loaded but model still empty for {local_entrypoint}"
            )

        return fallback

    # Not fallback case, or primary load succeeded
    if primary_count == 0:
        print(
            "[taxonomy-load] Warning: model empty after primary load (fallback not applied)"
        )
    return primary


def get_entrypoints_for_year(year: str):
    package_path = os.path.join(
        TAXONOMY_BASE_DIR, year, "META-INF", "taxonomyPackage.xml"
    )
    if not os.path.exists(package_path):
        raise FileNotFoundError(f"taxonomyPackage.xml not found for year {year}")

    ns = {"tp": "http://xbrl.org/2016/taxonomy-package"}
    tree = etree.parse(package_path)
    entrypoints = tree.xpath("//tp:entryPoint", namespaces=ns)
    result = []
    for ep in entrypoints:
        name = ep.findtext("tp:name", namespaces=ns)
        ep_doc = ep.find("tp:entryPointDocument", namespaces=ns)
        href = ep_doc.get("href") if ep_doc is not None else ""
        if name and href:
            result.append({"name": name, "href": href})
    return result


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(app.static_folder, "assets"), filename)


@app.route("/api/hello", methods=["POST"])
def get_hypercubes():
    taxonomy = getattr(g, "taxonomy", taxonomy_cache.get("active"))

    if taxonomy is None:
        return jsonify({"error": "No taxonomy loaded"}), 400

    g.taxonomy = taxonomy

    data = request.get_json()
    qname = data.get("qname", "")
    if not qname or ":" not in qname:
        return jsonify({"error": "Invalid qname"}), 400

    ns_prefix, local_name = qname.split(":", 1)
    concept_ns = g.taxonomy.model.prefixedNamespaces.get(ns_prefix)

    results = g.taxonomy.hypercubes.find_hypercubes_for_concept(
        concept_ns=concept_ns, concept_name=local_name
    )

    return jsonify({"hypercubes": results})


@app.route("/api/concept-details")
def concept_details():
    taxonomy = getattr(g, "taxonomy", taxonomy_cache.get("active"))

    print("\n[concept-details] ===== START =====")
    print(f"[concept-details] requested qname={request.args.get('qname', '')}")
    print(f"[concept-details] g has taxonomy? {hasattr(g, 'taxonomy')}")
    print(
        f"[concept-details] cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}"
    )

    if taxonomy is None:
        print("[concept-details] taxonomy is None")
        return jsonify({"error": "No taxonomy loaded"}), 400

    g.taxonomy = taxonomy

    print(f"[concept-details] taxonomy id={id(g.taxonomy)}")
    print(f"[concept-details] model id={id(getattr(g.taxonomy, 'model', None))}")

    try:
        qdict = getattr(g.taxonomy.model, "qnameConcepts", {})
        qcount = len(qdict)
        print(f"[concept-details] qnameConcepts count={qcount}")

        sample_qnames = [str(qn) for qn in list(qdict.keys())[:10]]
        print(f"[concept-details] sample qnames={sample_qnames}")

        available_prefixes = sorted(
            {
                getattr(qn, "prefix", "")
                for qn in qdict.keys()
                if getattr(qn, "prefix", None)
            }
        )
        print(
            f"[concept-details] available prefixes (sample): {available_prefixes[:50]}"
        )
    except Exception as ex:
        print(f"[concept-details] model inspection error: {ex}")
        available_prefixes = []

    qname = request.args.get("qname", "")
    if ":" not in qname:
        print("[concept-details] invalid qname format")
        return jsonify({"error": "Invalid qname"}), 400

    prefix, local_name = qname.split(":", 1)
    print(f"[concept-details] requested prefix={prefix}, local_name={local_name}")

    # Keep your existing resolution logic for now, just with logs around it:
    ns = None
    for qn in g.taxonomy.model.qnameConcepts.keys():
        if getattr(qn, "prefix", None) == prefix:
            ns = qn.namespaceURI
            break

    print(f"[concept-details] resolved namespace={ns}")

    if ns is None:
        print("[concept-details] namespace resolution failed")
        return (
            jsonify(
                {
                    "error": f"Prefix '{prefix}' not found in loaded taxonomy",
                    "available_prefixes": available_prefixes[:50],
                }
            ),
            404,
        )

    concept_data = g.taxonomy.concepts.get_concept_json(ns, local_name)
    if not concept_data:
        print("[concept-details] concept_data not found")
        return jsonify({"error": f"Concept '{qname}' not found"}), 404

    concept_data["concept"]["qname"] = qname
    print("[concept-details] ===== END OK =====\n")
    return jsonify(concept_data)


@app.route("/api/entrypoints", methods=["GET"])
def list_entrypoints_by_year():
    year = request.args.get("year")
    if not year:
        return jsonify({"error": "Year is required"}), 400

    try:
        entrypoints = get_entrypoints_for_year(year)
        return jsonify({"entrypoints": entrypoints})
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@app.route("/api/load-entrypoint", methods=["POST"])
def load_entrypoint():
    data = request.get_json()
    year = data.get("year")
    href = data.get("href")

    if not year or not href:
        return jsonify({"error": "Missing year or href"}), 400

    entrypoint_path = href

    try:
        print("\n[load-entrypoint] ===== START =====")
        print(f"[load-entrypoint] year={year}")
        print(f"[load-entrypoint] href={href}")
        print(f"[load-entrypoint] entrypoint_path={entrypoint_path}")
        print(
            f"[load-entrypoint] taxonomy_cache has active? {'active' in taxonomy_cache and taxonomy_cache.get('active') is not None}"
        )

        old_taxonomy = taxonomy_cache.get("active")
        if old_taxonomy is not None:
            _safe_close_taxonomy(old_taxonomy)
            print(
                f"[load-entrypoint] old taxonomy id={id(old_taxonomy)} model_id={id(getattr(old_taxonomy, 'model', None))}"
            )
            try:
                old_count = len(getattr(old_taxonomy.model, "qnameConcepts", {}))
            except Exception as ex:
                old_count = f"ERR: {ex}"
            print(f"[load-entrypoint] old qnameConcepts count={old_count}")
            # close old taxonomy before replace
            try:
                old_taxonomy.controller.close()
                print("[load-entrypoint] old taxonomy controller closed")
            except Exception as ex:
                print(f"[load-entrypoint] old taxonomy close error: {ex}")

        # g.taxonomy = TaxonomyContext(entrypoint_path)
        g.taxonomy = _load_taxonomy_with_lloyds_fallback(year, entrypoint_path)
        taxonomy_cache["active"] = g.taxonomy

        print(f"[load-entrypoint] new taxonomy id={id(g.taxonomy)}")
        print(
            f"[load-entrypoint] new model id={id(getattr(g.taxonomy, 'model', None))}"
        )

        try:
            qdict = getattr(g.taxonomy.model, "qnameConcepts", {})
            qcount = len(qdict)
            print(f"[load-entrypoint] new qnameConcepts count={qcount}")

            sample_qnames = [str(qn) for qn in list(qdict.keys())[:10]]
            print(f"[load-entrypoint] sample qnames={sample_qnames}")

            sample_prefixes = sorted(
                {
                    getattr(qn, "prefix", "")
                    for qn in qdict.keys()
                    if getattr(qn, "prefix", None)
                }
            )[:30]
            print(f"[load-entrypoint] sample prefixes={sample_prefixes}")
        except Exception as ex:
            print(f"[load-entrypoint] model inspection error: {ex}")

        print("[load-entrypoint] ===== MODEL LOADED =====")

        # --- keep your existing tree_dir/tree loading code below unchanged ---
        tree_dir = os.path.join(TAXONOMY_BASE_DIR, year, "trees")
        if not os.path.isdir(tree_dir):
            return jsonify({"error": f"Tree directory not found: {tree_dir}"}), 404

        raw_entrypoint_name = os.path.splitext(os.path.basename(href))[0]
        entrypoint_name = re.split(r"[-_]\d{4}-\d{2}-\d{2}", raw_entrypoint_name)[0]
        print(f"[Flask] Extracted entrypoint_name: {entrypoint_name}")

        tree_files = os.path.join(TAXONOMY_BASE_DIR, year, "trees", entrypoint_name)
        print(f"[Flask] Looking for tree files in: {tree_files}")

        trees = {}
        for file in os.listdir(tree_files):
            if file.endswith(".json"):
                with open(os.path.join(tree_files, file), "r", encoding="utf-8") as f:
                    tree_name = file.replace(".json", "")
                    trees[tree_name] = json.load(f)

        print("[Flask] Returning tree keys:", list(trees.keys()))

        # Build + cache search filter options for this entrypoint
        concepts_payload = trees.get("concepts", {})
        if isinstance(concepts_payload, dict):
            cache_key = _entrypoint_cache_key(year, href)
            search_filter_options_cache[cache_key] = (
                _build_search_filter_options_from_concepts(concepts_payload)
            )
            set_search_index(cache_key, build_search_index(concepts_payload))
            taxonomy_cache["active_search_filter_options_key"] = cache_key
            print(f"[load-entrypoint] cached search filter options key={cache_key}")

        print("[load-entrypoint] ===== END OK =====\n")

        return jsonify(
            {"status": "loaded", "entrypoint": os.path.basename(href), "trees": trees}
        )

    except Exception as e:
        print(f"[load-entrypoint] ERROR: {e}")
        return jsonify({"error": f"Failed to load taxonomy: {str(e)}"}), 500


@app.route("/api/search-filter-options", methods=["GET"])
def search_filter_options():
    """
    Returns filter options for advanced search, including:
    - checkbox options
    - referenceSources
    - referenceParagraphsBySource
    """
    year = request.args.get("year")
    href = request.args.get("href")

    cache_key = None
    if year and href:
        cache_key = _entrypoint_cache_key(year, href)
    else:
        cache_key = taxonomy_cache.get("active_search_filter_options_key")

    if not cache_key:
        return (
            jsonify({"error": "No active entrypoint context. Provide year and href."}),
            400,
        )

    cached = search_filter_options_cache.get(cache_key)
    if cached is not None:
        return jsonify(cached)

    # Fallback: build from concepts.json on disk if cache miss
    if not (year and href):
        return jsonify({"error": "Cache miss and year/href not provided."}), 404

    concepts_payload = _load_concepts_json_for_entrypoint(year, href)
    if not concepts_payload:
        return (
            jsonify({"error": "concepts.json not found or empty for entrypoint"}),
            404,
        )

    payload = _build_search_filter_options_from_concepts(concepts_payload)
    search_filter_options_cache[cache_key] = payload
    taxonomy_cache["active_search_filter_options_key"] = cache_key
    return jsonify(payload)


@app.route("/api/search-concepts", methods=["POST"])
def search_concepts():
    data = request.get_json() or {}
    year = data.get("year")
    href = data.get("href")
    q = (data.get("q") or "").strip()
    filters = data.get("filters") or {}

    try:
        limit = int(data.get("limit", 25))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer"}), 400

    try:
        offset = int(data.get("offset", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "offset must be an integer"}), 400

    if not year or not href:
        return jsonify({"error": "Missing year or href"}), 400
    if not isinstance(filters, dict):
        return jsonify({"error": "filters must be an object"}), 400

    if limit < 1 or limit > 100:
        return jsonify({"error": "limit must be between 1 and 100"}), 400
    if offset < 0:
        return jsonify({"error": "offset must be >= 0"}), 400

    cache_key = _entrypoint_cache_key(year, href)
    index = get_search_index(cache_key)

    if index is None:
        concepts_payload = _load_concepts_json_for_entrypoint(year, href)
        if not concepts_payload:
            return (
                jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                404,
            )
        index = build_search_index(concepts_payload)
        set_search_index(cache_key, index)

    payload = search_index(
        index=index,
        query=q,
        limit=limit,
        offset=offset,
        filters=filters,
    )

    top_scores = [
        {
            "qname": item.get("qname"),
            "score": item.get("score"),
            "matched_fields": item.get("matched_fields"),
            "score_breakdown": item.get("score_breakdown"),
        }
        for item in (payload.get("results") or [])[:10]
    ]
    print(
        f"[search-concepts] year={year} href={href} q='{q}' "
        f"offset={offset} limit={limit} total={payload.get('total')}"
    )
    print(f"[search-concepts] top_scores={top_scores}")

    return jsonify(payload)


@app.teardown_appcontext
def cleanup(exception=None):
    taxonomy = getattr(g, "taxonomy", None)
    active = taxonomy_cache.get("active")

    print("\n[teardown] ===== START =====")
    print(f"[teardown] exception={exception}")
    print(f"[teardown] g has taxonomy? {taxonomy is not None}")
    print(f"[teardown] active exists? {active is not None}")

    if taxonomy is not None and taxonomy is not active:
        _safe_close_taxonomy(taxonomy)

    if taxonomy is not None:
        print(
            f"[teardown] g.taxonomy id={id(taxonomy)} model_id={id(getattr(taxonomy, 'model', None))}"
        )
        try:
            count = len(getattr(taxonomy.model, "qnameConcepts", {}))
        except Exception as ex:
            count = f"ERR: {ex}"
        print(f"[teardown] g.taxonomy qnameConcepts count={count}")

    if active is not None:
        print(
            f"[teardown] active taxonomy id={id(active)} model_id={id(getattr(active, 'model', None))}"
        )
        try:
            count = len(getattr(active.model, "qnameConcepts", {}))
        except Exception as ex:
            count = f"ERR: {ex}"
        print(f"[teardown] active qnameConcepts count={count}")

    # TEMP: do not close anything while diagnosing
    print("[teardown] TEMP no-close mode enabled")
    print("[teardown] ===== END =====\n")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def catch_all(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
