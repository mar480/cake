import json
from copy import deepcopy
import os
import time
from csv import DictWriter
from datetime import datetime, timezone
from io import StringIO

from flask import g, jsonify, make_response, request

from search.cache import get_search_index, set_search_index
from search.index_builder import build_search_index
from search.query_engine import search_index
from services.dimensional_relationships import resolve_dimensional_relationships
from services.search_filters import (
    build_search_filter_options_from_concepts,
    entrypoint_cache_key,
    entrypoint_name_from_href,
    load_cached_concepts_json_for_entrypoint,
    load_concepts_json_for_entrypoint,
    resolve_tree_dir_for_entrypoint,
)
from services.taxonomy_service import (
    get_entrypoints_for_year,
    safe_close_taxonomy,
)
from state import (
    presentation_locations_cache,
    search_filter_options_cache,
    taxonomy_cache,
    taxonomy_lock,
)


def get_active_taxonomy_with_retry(max_attempts: int = 3, delay_seconds: float = 0.2):
    for attempt in range(max_attempts):
        with taxonomy_lock:
            taxonomy = taxonomy_cache.get("active")
            is_loading = taxonomy_cache.get("is_loading", False)

        if taxonomy is not None and not is_loading:
            return taxonomy

        if attempt < max_attempts - 1:
            time.sleep(delay_seconds)

    return None


def register_api_routes(app, taxonomy_base_dir: str):
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"})

    SEARCH_EXPORT_MAX_ROWS = 10000
    SEARCH_EXPORT_FIELDS = {
        "qname": "qname",
        "label": "label",
        "local_name": "local_name",
        "namespace": "namespace",
        "balance": "balance",
        "period_type": "period_type",
        "xbrl_type": "xbrl_type",
        "full_type": "full_type",
        "abstract": "abstract",
        "nillable": "nillable",
        "substitution_group": "substitution_group",
        "concept_type": "concept_type",
        "hypercubes": "hypercubes",
        "reference_displays": "reference_displays",
        "score": "score",
        "matched_fields": "matched_fields",
    }

    def _coerce_export_fields(fields_value):
        if not isinstance(fields_value, list):
            return None

        normalized_fields = []
        for field in fields_value:
            if not isinstance(field, str):
                return None
            normalized = field.strip()
            if not normalized:
                continue
            if normalized not in SEARCH_EXPORT_FIELDS:
                return None
            if normalized not in normalized_fields:
                normalized_fields.append(normalized)

        return normalized_fields

    def _project_search_export_rows(results, selected_fields, flatten_lists=False):
        projected_rows = []
        for result in results or []:
            row = {}
            for field in selected_fields:
                value = result.get(SEARCH_EXPORT_FIELDS[field])
                if flatten_lists and isinstance(value, list):
                    row[field] = " | ".join(str(item) for item in value)
                else:
                    row[field] = value
            projected_rows.append(row)
        return projected_rows

    def _build_search_export_filename(year, href, query, export_format):
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        href_slug = "".join(ch if ch.isalnum() else "-" for ch in (href or "").lower()).strip("-")
        query_slug = "".join(ch if ch.isalnum() else "-" for ch in (query or "").lower()).strip("-")
        href_slug = href_slug[:40] or "entrypoint"
        query_slug = query_slug[:40] or "all-results"
        return f"search-export-{year}-{href_slug}-{query_slug}-{timestamp}.{export_format}"

    def _get_presentation_qnames_for_entrypoint(year, href):
        cache_key = entrypoint_cache_key(year, href)
        qname_to_elrs = presentation_locations_cache.get(cache_key)

        if qname_to_elrs is None:
            tree_dir = resolve_tree_dir_for_entrypoint(taxonomy_base_dir, year, href)
            presentation_path = os.path.join(tree_dir, "presentation_tree.json")
            if not os.path.exists(presentation_path):
                presentation_locations_cache[cache_key] = {}
                return set()

            with open(presentation_path, "r", encoding="utf-8") as handle:
                presentation_tree = json.load(handle)

            qname_to_elrs = collect_presentation_elrs_by_qname(presentation_tree)
            presentation_locations_cache[cache_key] = qname_to_elrs

        return set(qname_to_elrs.keys())

    def _apply_presentation_tree_filter(payload, year, href, filters):
        if not (filters or {}).get("excludeNotInPresentationTree"):
            return payload

        visible_qnames = _get_presentation_qnames_for_entrypoint(year, href)
        filtered_results = [
            item for item in (payload.get("results") or []) if item.get("qname") in visible_qnames
        ]

        return {
            **payload,
            "results": filtered_results,
            "total": len(filtered_results),
            "offset": 0,
        }

    def _run_search_payload(index, year, href, query, filters, limit, offset):
        if (filters or {}).get("excludeNotInPresentationTree"):
            unpaged_payload = search_index(
                index=index,
                query=query,
                limit=max(len(index.concepts_by_qname), 1),
                offset=0,
                filters=filters,
            )
            filtered_payload = _apply_presentation_tree_filter(unpaged_payload, year, href, filters)
            paged_results = filtered_payload.get("results", [])[offset : offset + limit]
            return {
                **filtered_payload,
                "results": paged_results,
                "limit": limit,
                "offset": offset,
            }

        return search_index(
            index=index,
            query=query,
            limit=limit,
            offset=offset,
            filters=filters,
        )

    def collect_presentation_elrs_by_qname(root_nodes):
        qname_to_elrs = {}

        def walk(node, elr_definition):
            qname = (node or {}).get("qname")
            if qname and elr_definition:
                qname_to_elrs.setdefault(qname, [])
                if elr_definition not in qname_to_elrs[qname]:
                    qname_to_elrs[qname].append(elr_definition)

            for child in (node or {}).get("children", []) or []:
                walk(child, elr_definition)

        for group in root_nodes or []:
            elr_definition = group.get("definition") or group.get("elr") or ""
            for root in group.get("root_tree", []) or []:
                walk(root, elr_definition)

        return qname_to_elrs

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

    @app.route("/api/dimensional-relationships", methods=["POST"])
    def dimensional_relationships():
        data = request.get_json() or {}
        year = (data.get("year") or "").strip()
        href = (data.get("href") or "").strip()
        qname = (data.get("qname") or "").strip()

        if not year or not href or not qname:
            return jsonify({"error": "Missing year, href, or qname"}), 400

        try:
            payload = resolve_dimensional_relationships(
                taxonomy_base_dir=taxonomy_base_dir,
                year=year,
                href=href,
                qname=qname,
            )
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 404
        except Exception as exc:
            print(f"[dimensional-relationships] ERROR: {exc}")
            return jsonify({"error": "Failed to resolve dimensional relationships"}), 500

        return jsonify(payload)

    @app.route("/api/concept-details")
    def concept_details():
        year = request.args.get("year", "").strip()
        href = request.args.get("href", "").strip()
        qname = request.args.get("qname", "").strip()

        if not year or not href or not qname:
            return jsonify({"error": "Missing year, href, or qname"}), 400

        if ":" not in qname:
            return (
                jsonify(
                    {"error": "Invalid qname: expected a prefixed name like 'prefix:localName'"}
                ),
                400,
            )

        try:
            concepts_payload = load_cached_concepts_json_for_entrypoint(
                taxonomy_base_dir, year, href
            )
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 404
        except Exception as exc:
            print(f"[concept-details] ERROR loading concepts.json: {exc}")
            return jsonify({"error": "Failed to load concept details"}), 500

        if not concepts_payload:
            return (
                jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                404,
            )

        concept_data = concepts_payload.get(qname)
        if not concept_data:
            return (
                jsonify(
                    {
                        "error": (
                            f"Concept '{qname}' not found in concepts.json for "
                            f"year '{year}' and href '{href}'"
                        )
                    }
                ),
                404,
            )

        concept_data = deepcopy(concept_data)
        concept_data.setdefault("concept", {})["qname"] = qname
        return jsonify(concept_data)

    @app.route("/api/warm-concept-details")
    def warm_concept_details():
        taxonomy = getattr(g, "taxonomy", None)
        if taxonomy is None:
            taxonomy = get_active_taxonomy_with_retry()

        if taxonomy is None:
            with taxonomy_lock:
                is_loading = taxonomy_cache.get("is_loading", False)
            return (
                jsonify(
                    {
                        "error": (
                            "Taxonomy is still loading"
                            if is_loading
                            else "Taxonomy temporarily unavailable"
                        ),
                        "retryable": True,
                    }
                ),
                503,
            )

        g.taxonomy = taxonomy

        try:
            for qn in g.taxonomy.model.qnameConcepts.keys():
                namespace = getattr(qn, "namespaceURI", None)
                local_name = getattr(qn, "localName", None)
                if not namespace or not local_name:
                    continue

                g.taxonomy.concepts.get_concept_json(namespace, local_name)
                return ("", 204)
        except Exception as exc:
            print(f"[warm-concept-details] ERROR: {exc}")
            return jsonify({"error": "Failed to warm concept details"}), 500

        return ("", 204)

    @app.route("/api/entrypoints", methods=["GET"])
    def list_entrypoints_by_year():
        year = request.args.get("year")
        if not year:
            return jsonify({"error": "Year is required"}), 400

        try:
            entrypoints = get_entrypoints_for_year(taxonomy_base_dir, year)
            return jsonify({"entrypoints": entrypoints})
        except FileNotFoundError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    @app.route("/api/load-entrypoint", methods=["POST"])
    def load_entrypoint():
        data = request.get_json() or {}
        year = data.get("year")
        href = data.get("href")

        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400

        try:
            print("\n[load-entrypoint] ===== START =====")
            print(f"[load-entrypoint] year={year}")
            print(f"[load-entrypoint] href={href}")

            entrypoint_name = entrypoint_name_from_href(href)
            print(f"[Flask] Extracted entrypoint_name: {entrypoint_name}")

            tree_files = resolve_tree_dir_for_entrypoint(taxonomy_base_dir, year, href)
            print(f"[Flask] Looking for tree files in: {tree_files}")

            trees = {}
            for file in os.listdir(tree_files):
                if file.endswith(".json"):
                    with open(os.path.join(tree_files, file), "r", encoding="utf-8") as f:
                        tree_name = file.replace(".json", "")
                        trees[tree_name] = json.load(f)

            print("[Flask] Returning tree keys:", list(trees.keys()))

            # Build + cache search filter options for this entrypoint when concepts are present.
            concepts_payload = trees.get("concepts")
            if isinstance(concepts_payload, dict):
                cache_key = entrypoint_cache_key(year, href)
                search_filter_options_cache[cache_key] = (
                    build_search_filter_options_from_concepts(concepts_payload)
                )
                # Prewarm the search index under the same entrypoint-specific key used by search routes.
                set_search_index(cache_key, build_search_index(concepts_payload))
                print(f"[load-entrypoint] cached search filter options key={cache_key}")

            print("[load-entrypoint] ===== END OK =====\n")

            return jsonify(
                {"status": "loaded", "entrypoint": os.path.basename(href), "trees": trees}
            )

        except Exception as e:
            print(f"[load-entrypoint] ERROR: {e}")
            return jsonify({"error": f"Failed to load entrypoint: {str(e)}"}), 500

    @app.route("/api/presentation-entrypoint-locations", methods=["GET"])
    def presentation_entrypoint_locations():
        year = request.args.get("year", "").strip()
        qname = request.args.get("qname", "").strip()
        exclude_href = request.args.get("excludeHref", "").strip()

        if not year or not qname:
            return jsonify({"error": "Year and qname are required"}), 400

        try:
            entrypoints = get_entrypoints_for_year(taxonomy_base_dir, year)
            matches = []

            for entrypoint in entrypoints:
                href = (entrypoint.get("href") or "").strip()
                if not href or href == exclude_href:
                    continue

                cache_key = entrypoint_cache_key(year, href)
                qname_to_elrs = presentation_locations_cache.get(cache_key)

                if qname_to_elrs is None:
                    tree_dir = resolve_tree_dir_for_entrypoint(taxonomy_base_dir, year, href)
                    presentation_path = os.path.join(tree_dir, "presentation_tree.json")
                    if not os.path.exists(presentation_path):
                        presentation_locations_cache[cache_key] = {}
                        continue

                    with open(presentation_path, "r", encoding="utf-8") as handle:
                        presentation_tree = json.load(handle)
                    qname_to_elrs = collect_presentation_elrs_by_qname(presentation_tree)
                    presentation_locations_cache[cache_key] = qname_to_elrs

                elrs = qname_to_elrs.get(qname, [])
                if elrs:
                    matches.append(
                        {
                            "entrypoint": {
                                "name": entrypoint.get("name") or href,
                                "href": href,
                            },
                            "elrs": elrs,
                        }
                    )

            return jsonify({"matches": matches})
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 404
        except Exception as exc:
            print(f"[presentation-entrypoint-locations] ERROR: {exc}")
            return jsonify({"error": "Failed to load presentation entrypoint locations"}), 500

    @app.route("/api/search-filter-options", methods=["GET"])
    def search_filter_options():
        """
        Returns filter options for advanced search, including:
        - checkbox options
        - referenceSources
        - referenceParagraphsBySource
        """
        year = request.args.get("year", "").strip()
        href = request.args.get("href", "").strip()

        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400

        # User-facing search filter options are entrypoint-scoped. Do not fall back
        # to a process-global "active" key; concurrent users may load different entrypoints.
        cache_key = entrypoint_cache_key(year, href)

        cached = search_filter_options_cache.get(cache_key)
        if cached is not None:
            return jsonify(cached)

        # Fallback: build from the requested entrypoint's concepts.json on disk if cache miss.
        concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
        if not concepts_payload:
            return (
                jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                404,
            )

        payload = build_search_filter_options_from_concepts(concepts_payload)
        search_filter_options_cache[cache_key] = payload
        return jsonify(payload)

    @app.route("/api/search-concepts", methods=["POST"])
    def search_concepts():
        data = request.get_json() or {}
        year = (data.get("year") or "").strip()
        href = (data.get("href") or "").strip()
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

        cache_key = entrypoint_cache_key(year, href)
        index = get_search_index(cache_key)

        if index is None:
            print(f"[search-concepts] cache miss entrypoint_key={cache_key}; loading entrypoint concepts.json only")
            concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
            if not concepts_payload:
                return (
                    jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                    404,
                )
            index = build_search_index(concepts_payload)
            # Search indexes must remain entrypoint-keyed so separate users/entrypoints never share results.
            set_search_index(cache_key, index)

        payload = _run_search_payload(index, year, href, q, filters, limit, offset)

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

    @app.route("/api/search-concepts/export", methods=["POST"])
    def export_search_concepts():
        data = request.get_json() or {}
        year = (data.get("year") or "").strip()
        href = (data.get("href") or "").strip()
        q = (data.get("q") or "").strip()
        filters = data.get("filters") or {}
        export_format = (data.get("format") or "csv").strip().lower()
        fields = _coerce_export_fields(data.get("fields"))

        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400
        if not isinstance(filters, dict):
            return jsonify({"error": "filters must be an object"}), 400
        if export_format not in {"csv", "json"}:
            return jsonify({"error": "format must be csv or json"}), 400
        if fields is None or len(fields) == 0:
            return jsonify({"error": "fields must be a non-empty list of allowed field names"}), 400

        cache_key = entrypoint_cache_key(year, href)
        index = get_search_index(cache_key)

        if index is None:
            print(f"[search-concepts/export] cache miss entrypoint_key={cache_key}; loading entrypoint concepts.json only")
            concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
            if not concepts_payload:
                return (
                    jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                    404,
                )
            index = build_search_index(concepts_payload)
            # Search indexes must remain entrypoint-keyed so separate users/entrypoints never share exports.
            set_search_index(cache_key, index)

        total_matches = _run_search_payload(index, year, href, q, filters, 1, 0).get("total", 0)

        if total_matches > SEARCH_EXPORT_MAX_ROWS:
            return (
                jsonify(
                    {
                        "error": (
                            f"Export exceeds maximum row limit of {SEARCH_EXPORT_MAX_ROWS}. "
                            f"Current result count: {total_matches}."
                        )
                    }
                ),
                400,
            )

        payload = _run_search_payload(index, year, href, q, filters, max(total_matches, 1), 0)
        projected_rows = _project_search_export_rows(
            payload.get("results") or [],
            fields,
            flatten_lists=export_format == "csv",
        )

        timestamp = datetime.now(timezone.utc).isoformat()
        filename = _build_search_export_filename(year, href, q, export_format)
        response_headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Export-Generated-At": timestamp,
            "X-Export-Total-Rows": str(total_matches),
            "X-Export-Query": q,
            "X-Export-Year": str(year),
            "X-Export-Href": str(href),
            "X-Export-Fields": ",".join(fields),
        }

        if export_format == "json":
            response = make_response(json.dumps(projected_rows, ensure_ascii=False, indent=2))
            response.mimetype = "application/json"
            response.headers.extend(response_headers)
            return response

        csv_buffer = StringIO()
        writer = DictWriter(csv_buffer, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(projected_rows)

        response = make_response(csv_buffer.getvalue())
        response.mimetype = "text/csv"
        response.headers.extend(response_headers)
        return response

    @app.teardown_appcontext
    def cleanup(exception=None):
        taxonomy = getattr(g, "taxonomy", None)
        active = taxonomy_cache.get("active")

        print("\n[teardown] ===== START =====")
        print(f"[teardown] exception={exception}")
        print(f"[teardown] g has taxonomy? {taxonomy is not None}")
        print(f"[teardown] active exists? {active is not None}")

        if taxonomy is not None and taxonomy is not active:
            safe_close_taxonomy(taxonomy)

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
