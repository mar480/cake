import json
import os

from flask import g, jsonify, request

from search.cache import get_search_index, set_search_index
from search.index_builder import build_search_index
from search.query_engine import search_index
from services.search_filters import (
    build_search_filter_options_from_concepts,
    entrypoint_cache_key,
    entrypoint_name_from_href,
    load_concepts_json_for_entrypoint,
)
from services.taxonomy_service import (
    get_entrypoints_for_year,
    load_taxonomy_with_lloyds_fallback,
    safe_close_taxonomy,
)
from state import search_filter_options_cache, taxonomy_cache


def register_api_routes(app, taxonomy_base_dir: str):
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

        # Keep existing resolution logic with logs
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
            entrypoints = get_entrypoints_for_year(taxonomy_base_dir, year)
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
                safe_close_taxonomy(old_taxonomy)
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

            g.taxonomy = load_taxonomy_with_lloyds_fallback(
                taxonomy_base_dir, year, entrypoint_path
            )
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

            tree_dir = os.path.join(taxonomy_base_dir, year, "trees")
            if not os.path.isdir(tree_dir):
                return jsonify({"error": f"Tree directory not found: {tree_dir}"}), 404

            entrypoint_name = entrypoint_name_from_href(href)
            print(f"[Flask] Extracted entrypoint_name: {entrypoint_name}")

            tree_files = os.path.join(taxonomy_base_dir, year, "trees", entrypoint_name)
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
                cache_key = entrypoint_cache_key(year, href)
                search_filter_options_cache[cache_key] = (
                    build_search_filter_options_from_concepts(concepts_payload)
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

        if year and href:
            cache_key = entrypoint_cache_key(year, href)
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

        concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
        if not concepts_payload:
            return (
                jsonify({"error": "concepts.json not found or empty for entrypoint"}),
                404,
            )

        payload = build_search_filter_options_from_concepts(concepts_payload)
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

        cache_key = entrypoint_cache_key(year, href)
        index = get_search_index(cache_key)

        if index is None:
            concepts_payload = load_concepts_json_for_entrypoint(taxonomy_base_dir, year, href)
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
