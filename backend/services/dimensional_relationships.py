import json
import os
from functools import lru_cache

from services.search_filters import classify_concept_type, resolve_tree_dir_for_entrypoint


def _read_json(path: str):
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _standard_labels_from_entry(entry: dict) -> tuple[str, str]:
    english = ""
    welsh = ""
    for label in entry.get("labels", []) or []:
        label_type = (label.get("type") or "").strip()
        lang = (label.get("lang") or "").strip().lower()
        text = (label.get("label_text") or "").strip()
        if label_type != "Standard Label" or not text:
            continue
        if lang == "en" and not english:
            english = text
        elif lang == "cy" and not welsh:
            welsh = text
    fallback = entry.get("concept", {}).get("local_name") or ""
    return english or fallback, welsh or english or fallback


def _build_member_tree(member_node: dict, concepts: dict) -> dict:
    qname = member_node.get("member_qname") or member_node.get("qname") or ""
    concept_entry = concepts.get(qname, {}) if isinstance(concepts, dict) else {}
    label, label_cy = _standard_labels_from_entry(concept_entry)
    children = [
        _build_member_tree(child, concepts)
        for child in (member_node.get("children") or [])
        if isinstance(child, dict)
    ]
    return {
        "name": qname,
        "label": label or qname,
        "label_cy": label_cy or label or qname,
        "children": children,
    }


def _enrich_primary_item_tree(node: dict, concepts: dict) -> dict:
    qname = node.get("qname") or node.get("concept_id") or ""
    concept_entry = concepts.get(qname, {}) if isinstance(concepts, dict) else {}
    concept = concept_entry.get("concept", {}) if isinstance(concept_entry, dict) else {}
    label, label_cy = _standard_labels_from_entry(concept_entry or {})

    return {
        "qname": qname,
        "concept_id": qname,
        "label": node.get("label") or label or qname,
        "name": node.get("label") or label or qname,
        "label_cy": node.get("label_cy") or label_cy or label or qname,
        "xbrl_type": concept.get("xbrl_type"),
        "full_type": concept.get("full_type"),
        "substitution_group": concept.get("substitution_group"),
        "abstract": concept.get("abstract") is True or str(concept.get("abstract")).lower() == "true",
        "children": [
            _enrich_primary_item_tree(child, concepts)
            for child in (node.get("children") or [])
            if isinstance(child, dict)
        ],
    }


def _walk_primary_items(nodes: list[dict], hypercube_key: str, primary_item_to_hypercubes: dict):
    for node in nodes or []:
        qname = node.get("qname") or node.get("concept_id")
        if qname:
            primary_item_to_hypercubes.setdefault(qname, set()).add(hypercube_key)
        _walk_primary_items(node.get("children") or [], hypercube_key, primary_item_to_hypercubes)


def _walk_members(
    nodes: list[dict], dimension_qname: str, member_to_dimensions: dict, member_to_dimension_paths: dict
):
    for node in nodes or []:
        qname = node.get("member_qname") or node.get("qname")
        if qname:
            member_to_dimensions.setdefault(qname, set()).add(dimension_qname)
            member_to_dimension_paths.setdefault((qname, dimension_qname), True)
        _walk_members(
            node.get("children") or [], dimension_qname, member_to_dimensions, member_to_dimension_paths
        )


def _occurrence_key(elr: str | None, hypercube_qname: str) -> str:
    return f"{elr or ''}::{hypercube_qname}"


def _sorted_hypercube_keys(hypercube_keys, hypercube_by_key: dict) -> list[str]:
    return sorted(
        {key for key in (hypercube_keys or []) if key in hypercube_by_key},
        key=lambda key: (
            hypercube_by_key.get(key, {}).get("elr_id") is None,
            hypercube_by_key.get(key, {}).get("elr_id"),
            hypercube_by_key.get(key, {}).get("hypercubeELR") or "",
            hypercube_by_key.get(key, {}).get("hypercubeName") or key,
        ),
    )


def _dimension_info_from_tree_node(node: dict, dimension_by_qname: dict) -> dict:
    dimension_qname = node.get("qname") or node.get("concept_id") or ""
    existing = dimension_by_qname.get(dimension_qname)
    if existing:
        return existing

    label = node.get("name") or node.get("label") or dimension_qname
    return {
        "dimensionName": dimension_qname,
        "dimensionELR": None,
        "definition": label,
        "elr_id": None,
        "defaultMember": None,
        "domainMembers": [],
    }


@lru_cache(maxsize=32)
def load_dimensional_relationship_index(taxonomy_base_dir: str, year: str, href: str) -> dict:
    tree_dir = resolve_tree_dir_for_entrypoint(taxonomy_base_dir, year, href)
    if not os.path.isdir(tree_dir):
        raise FileNotFoundError(f"Tree directory not found: {tree_dir}")

    concepts = _read_json(os.path.join(tree_dir, "concepts.json")) or {}
    hypercubes = _read_json(os.path.join(tree_dir, "hypercubes.json")) or []
    dimensions = _read_json(os.path.join(tree_dir, "dimensions.json")) or []
    primary_items = _read_json(os.path.join(tree_dir, "primary_items.json")) or []
    definition_hydim_tree = _read_json(os.path.join(tree_dir, "definition_hydim_tree.json")) or []

    concept_meta = {}
    concept_to_hypercubes_from_concepts: dict[str, set[str]] = {}
    for qname, entry in (concepts or {}).items():
        concept = (entry or {}).get("concept", {}) or {}
        label, label_cy = _standard_labels_from_entry(entry or {})
        concept_meta[qname] = {
            "qname": qname,
            "concept_type": classify_concept_type(
                concept.get("full_type"),
                concept.get("substitution_group"),
            ),
            "label": label or qname,
            "label_cy": label_cy or label or qname,
            "full_type": concept.get("full_type"),
            "substitution_group": concept.get("substitution_group"),
        }
        concept_hypercubes = {
            str(hypercube).strip()
            for hypercube in (entry or {}).get("hypercubes") or []
            if str(hypercube).strip()
        }
        if concept_hypercubes:
            concept_to_hypercubes_from_concepts[qname] = concept_hypercubes

    primary_items_by_elr = {
        item.get("elr"): item for item in primary_items if isinstance(item, dict) and item.get("elr")
    }

    dimension_by_qname = {}
    member_to_dimensions: dict[str, set[str]] = {}
    member_to_dimension_paths = {}

    for dimension in dimensions:
        if not isinstance(dimension, dict):
            continue
        dimension_qname = dimension.get("dimension_qname")
        if not dimension_qname:
            continue

        domain_members = [
            _build_member_tree(member, concepts)
            for member in (dimension.get("domain_members") or [])
            if isinstance(member, dict)
        ]
        raw_members = [member for member in (dimension.get("domain_members") or []) if isinstance(member, dict)]
        _walk_members(raw_members, dimension_qname, member_to_dimensions, member_to_dimension_paths)

        dimension_by_qname[dimension_qname] = {
            "dimensionName": dimension_qname,
            "dimensionELR": dimension.get("elr"),
            "definition": dimension.get("role_definition") or dimension.get("definition") or dimension_qname,
            "elr_id": dimension.get("elr_id"),
            "defaultMember": dimension.get("default_member"),
            "domainMembers": domain_members,
        }

        concept_meta.setdefault(
            dimension_qname,
            {
                "qname": dimension_qname,
                "concept_type": "dimension",
                "label": dimension_by_qname[dimension_qname]["definition"],
                "label_cy": dimension_by_qname[dimension_qname]["definition"],
            },
        )

    hypercube_metadata_by_elr = {
        hypercube.get("elr"): hypercube
        for hypercube in hypercubes
        if isinstance(hypercube, dict) and hypercube.get("elr")
    }
    hypercube_by_key = {}
    hypercube_keys_by_qname: dict[str, set[str]] = {}
    dimension_to_hypercubes: dict[str, set[str]] = {}
    primary_item_to_hypercubes: dict[str, set[str]] = {}

    def add_hypercube_occurrence(
        *,
        hypercube_qname: str,
        elr: str | None,
        elr_id,
        definition: str | None,
        dimension_qnames: list[str],
        primary_roots: list[str],
        primary_tree: list[dict],
    ):
        if not hypercube_qname:
            return

        occurrence_key = _occurrence_key(elr, hypercube_qname)
        if occurrence_key in hypercube_by_key:
            return

        enriched_dimensions = []
        for dimension_qname in dimension_qnames or []:
            if not dimension_qname:
                continue
            dimension_to_hypercubes.setdefault(dimension_qname, set()).add(occurrence_key)
            dimension_info = dimension_by_qname.get(dimension_qname) or {
                "dimensionName": dimension_qname,
                "dimensionELR": None,
                "definition": dimension_qname,
                "elr_id": None,
                "defaultMember": None,
                "domainMembers": [],
            }
            enriched_dimensions.append(dimension_info)

        _walk_primary_items(primary_tree, occurrence_key, primary_item_to_hypercubes)

        hypercube_by_key[occurrence_key] = {
            "hypercubeKey": occurrence_key,
            "hypercubeName": hypercube_qname,
            "hypercubeELR": elr,
            "definition": definition or hypercube_qname,
            "elr_id": elr_id,
            "dimensions": enriched_dimensions,
            "primaryItemsTree": primary_tree,
            "primaryItemRoots": primary_roots,
        }
        hypercube_keys_by_qname.setdefault(hypercube_qname, set()).add(occurrence_key)
        concept_meta.setdefault(
            hypercube_qname,
            {
                "qname": hypercube_qname,
                "concept_type": "hypercube",
                "label": hypercube_by_key[occurrence_key]["definition"],
                "label_cy": hypercube_by_key[occurrence_key]["definition"],
            },
        )

    for group in definition_hydim_tree:
        if not isinstance(group, dict):
            continue
        elr = group.get("elr")
        metadata = hypercube_metadata_by_elr.get(elr) or {}
        primary_item_entry = primary_items_by_elr.get(elr) or {}
        primary_tree = [
            _enrich_primary_item_tree(node, concepts)
            for node in (primary_item_entry.get("primary_items_tree") or [])
            if isinstance(node, dict)
        ]
        primary_roots = [
            node.get("qname") or node.get("concept_id")
            for node in primary_tree
            if node.get("qname") or node.get("concept_id")
        ]

        for root in group.get("root_tree") or []:
            if not isinstance(root, dict):
                continue
            hypercube_qname = root.get("qname") or root.get("concept_id")
            if not hypercube_qname:
                continue

            dimension_qnames = []
            for child in root.get("children") or []:
                if not isinstance(child, dict):
                    continue
                dimension_info = _dimension_info_from_tree_node(child, dimension_by_qname)
                dimension_qname = dimension_info.get("dimensionName")
                if dimension_qname and dimension_qname not in dimension_by_qname:
                    dimension_by_qname[dimension_qname] = dimension_info
                if dimension_qname:
                    dimension_qnames.append(dimension_qname)

            group_elr_id = group.get("numeric_part")
            if group_elr_id is None:
                group_elr_id = metadata.get("elr_id")

            add_hypercube_occurrence(
                hypercube_qname=hypercube_qname,
                elr=elr,
                elr_id=group_elr_id,
                definition=group.get("definition") or metadata.get("role_definition") or metadata.get("definition"),
                dimension_qnames=dimension_qnames,
                primary_roots=primary_roots or metadata.get("primary_items") or [],
                primary_tree=primary_tree,
            )

    for hypercube in hypercubes:
        if not isinstance(hypercube, dict):
            continue
        hypercube_qname = hypercube.get("hypercube_qname")
        if not hypercube_qname:
            continue

        raw_primary_tree = (primary_items_by_elr.get(hypercube.get("elr")) or {}).get("primary_items_tree") or []
        primary_tree = [
            _enrich_primary_item_tree(node, concepts)
            for node in raw_primary_tree
            if isinstance(node, dict)
        ]
        add_hypercube_occurrence(
            hypercube_qname=hypercube_qname,
            elr=hypercube.get("elr"),
            elr_id=hypercube.get("elr_id"),
            definition=hypercube.get("role_definition") or hypercube.get("definition") or hypercube_qname,
            dimension_qnames=hypercube.get("dimensions") or [],
            primary_roots=hypercube.get("primary_items") or [],
            primary_tree=primary_tree,
        )

    concept_to_hypercubes_from_concepts_by_occurrence = {
        key: _sorted_hypercube_keys(
            {
                occurrence_key
                for hypercube_qname in value
                for occurrence_key in hypercube_keys_by_qname.get(hypercube_qname, set())
            },
            hypercube_by_key,
        )
        for key, value in concept_to_hypercubes_from_concepts.items()
    }

    concept_membership_edges_only = 0
    derived_membership_edges_only = 0
    disagreement_qnames = 0

    for qname in set(concept_to_hypercubes_from_concepts) | set(primary_item_to_hypercubes):
        concept_memberships = concept_to_hypercubes_from_concepts.get(qname, set())
        derived_memberships = {
            hypercube_by_key.get(key, {}).get("hypercubeName")
            for key in primary_item_to_hypercubes.get(qname, set())
            if hypercube_by_key.get(key, {}).get("hypercubeName")
        }
        if concept_memberships != derived_memberships:
            disagreement_qnames += 1
        concept_membership_edges_only += len(concept_memberships - derived_memberships)
        derived_membership_edges_only += len(derived_memberships - concept_memberships)

    if disagreement_qnames:
        print(
            "[dimensional-relationships] membership disagreement "
            f"year={year} href={href} qnames={disagreement_qnames} "
            f"concept_only_edges={concept_membership_edges_only} "
            f"derived_only_edges={derived_membership_edges_only}"
        )

    return {
        "concept_meta": concept_meta,
        "hypercube_by_key": hypercube_by_key,
        "hypercube_keys_by_qname": {
            key: _sorted_hypercube_keys(value, hypercube_by_key)
            for key, value in hypercube_keys_by_qname.items()
        },
        "dimension_by_qname": dimension_by_qname,
        "dimension_to_hypercubes": {
            key: _sorted_hypercube_keys(value, hypercube_by_key)
            for key, value in dimension_to_hypercubes.items()
        },
        "member_to_dimensions": {key: sorted(value) for key, value in member_to_dimensions.items()},
        "concept_to_hypercubes_from_concepts": concept_to_hypercubes_from_concepts_by_occurrence,
        "primary_item_to_hypercubes": {
            key: _sorted_hypercube_keys(value, hypercube_by_key)
            for key, value in primary_item_to_hypercubes.items()
        },
        "member_to_dimension_paths": member_to_dimension_paths,
    }


def resolve_dimensional_relationships(taxonomy_base_dir: str, year: str, href: str, qname: str) -> dict:
    index = load_dimensional_relationship_index(taxonomy_base_dir, year, href)
    concept_meta = index["concept_meta"]
    concept_type = concept_meta.get(qname, {}).get("concept_type", "concept")

    matched_dimensions: list[str] = []
    matched_hypercubes: list[str] = []

    if concept_type == "hypercube":
        matched_hypercubes = index["hypercube_keys_by_qname"].get(qname, [])
    elif concept_type == "dimension":
        matched_dimensions = [qname] if qname in index["dimension_by_qname"] else []
        matched_hypercubes = index["dimension_to_hypercubes"].get(qname, [])
    elif concept_type == "dimension member":
        matched_dimensions = index["member_to_dimensions"].get(qname, [])
        cube_set = set()
        for dimension_qname in matched_dimensions:
            cube_set.update(index["dimension_to_hypercubes"].get(dimension_qname, []))
        matched_hypercubes = _sorted_hypercube_keys(cube_set, index["hypercube_by_key"])
    else:
        primary_item_matches = index["primary_item_to_hypercubes"].get(qname, [])
        concept_matches = index["concept_to_hypercubes_from_concepts"].get(qname, [])
        if primary_item_matches:
            primary_hypercube_names = {
                index["hypercube_by_key"].get(key, {}).get("hypercubeName")
                for key in primary_item_matches
            }
            concept_only_matches = [
                key
                for key in concept_matches
                if index["hypercube_by_key"].get(key, {}).get("hypercubeName") not in primary_hypercube_names
            ]
            matched_hypercubes = _sorted_hypercube_keys(
                set(primary_item_matches) | set(concept_only_matches),
                index["hypercube_by_key"],
            )
        else:
            matched_hypercubes = concept_matches

    resolved_hypercubes = []
    for hypercube_key in matched_hypercubes:
        hypercube = index["hypercube_by_key"].get(hypercube_key)
        if not hypercube:
            continue

        dimensions = []
        for dimension in hypercube.get("dimensions") or []:
            dimension_qname = dimension.get("dimensionName")
            is_selected_dimension = dimension_qname == qname
            contains_selected_member = bool(
                concept_type == "dimension member"
                and dimension_qname in matched_dimensions
                and index["member_to_dimension_paths"].get((qname, dimension_qname))
            )
            dimensions.append(
                {
                    **dimension,
                    "isSelectedDimension": is_selected_dimension,
                    "containsSelectedMember": contains_selected_member,
                }
            )

        resolved_hypercubes.append(
            {
                **hypercube,
                "isSelectedHypercube": hypercube.get("hypercubeName") == qname,
                "containsSelectedDimension": any(
                    dimension.get("dimensionName") in matched_dimensions for dimension in dimensions
                ),
                "dimensions": dimensions,
            }
        )

    return {
        "selection": {
            "qname": qname,
            "concept_type": concept_type,
            "matched_dimensions": matched_dimensions,
        },
        "hypercubes": resolved_hypercubes,
    }
