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


def _walk_primary_items(nodes: list[dict], hypercube_qname: str, primary_item_to_hypercubes: dict):
    for node in nodes or []:
        qname = node.get("qname") or node.get("concept_id")
        if qname:
            primary_item_to_hypercubes.setdefault(qname, set()).add(hypercube_qname)
        _walk_primary_items(node.get("children") or [], hypercube_qname, primary_item_to_hypercubes)


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


def _sorted_hypercube_qnames(hypercube_qnames, hypercube_by_qname: dict) -> list[str]:
    return sorted(
        {qname for qname in (hypercube_qnames or []) if qname in hypercube_by_qname},
        key=lambda qname: (
            hypercube_by_qname.get(qname, {}).get("elr_id") is None,
            hypercube_by_qname.get(qname, {}).get("elr_id"),
            qname,
        ),
    )


@lru_cache(maxsize=32)
def load_dimensional_relationship_index(taxonomy_base_dir: str, year: str, href: str) -> dict:
    tree_dir = resolve_tree_dir_for_entrypoint(taxonomy_base_dir, year, href)
    if not os.path.isdir(tree_dir):
        raise FileNotFoundError(f"Tree directory not found: {tree_dir}")

    concepts = _read_json(os.path.join(tree_dir, "concepts.json")) or {}
    hypercubes = _read_json(os.path.join(tree_dir, "hypercubes.json")) or []
    dimensions = _read_json(os.path.join(tree_dir, "dimensions.json")) or []
    primary_items = _read_json(os.path.join(tree_dir, "primary_items.json")) or []

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

    hypercube_by_qname = {}
    dimension_to_hypercubes: dict[str, set[str]] = {}
    primary_item_to_hypercubes: dict[str, set[str]] = {}

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
        _walk_primary_items(primary_tree, hypercube_qname, primary_item_to_hypercubes)

        enriched_dimensions = []
        for dimension_qname in hypercube.get("dimensions") or []:
            if not dimension_qname:
                continue
            dimension_to_hypercubes.setdefault(dimension_qname, set()).add(hypercube_qname)
            dimension_info = dimension_by_qname.get(dimension_qname) or {
                "dimensionName": dimension_qname,
                "dimensionELR": None,
                "definition": dimension_qname,
                "elr_id": None,
                "defaultMember": None,
                "domainMembers": [],
            }
            enriched_dimensions.append(dimension_info)

        hypercube_by_qname[hypercube_qname] = {
            "hypercubeName": hypercube_qname,
            "hypercubeELR": hypercube.get("elr"),
            "definition": hypercube.get("role_definition") or hypercube.get("definition") or hypercube_qname,
            "elr_id": hypercube.get("elr_id"),
            "dimensions": enriched_dimensions,
            "primaryItemsTree": primary_tree,
            "primaryItemRoots": hypercube.get("primary_items") or [],
        }
        concept_meta.setdefault(
            hypercube_qname,
            {
                "qname": hypercube_qname,
                "concept_type": "hypercube",
                "label": hypercube_by_qname[hypercube_qname]["definition"],
                "label_cy": hypercube_by_qname[hypercube_qname]["definition"],
            },
        )

    concept_membership_edges_only = 0
    derived_membership_edges_only = 0
    disagreement_qnames = 0

    for qname in set(concept_to_hypercubes_from_concepts) | set(primary_item_to_hypercubes):
        concept_memberships = concept_to_hypercubes_from_concepts.get(qname, set())
        derived_memberships = primary_item_to_hypercubes.get(qname, set())
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
        "hypercube_by_qname": hypercube_by_qname,
        "dimension_by_qname": dimension_by_qname,
        "dimension_to_hypercubes": {key: sorted(value) for key, value in dimension_to_hypercubes.items()},
        "member_to_dimensions": {key: sorted(value) for key, value in member_to_dimensions.items()},
        "concept_to_hypercubes_from_concepts": {
            key: _sorted_hypercube_qnames(value, hypercube_by_qname)
            for key, value in concept_to_hypercubes_from_concepts.items()
        },
        "primary_item_to_hypercubes": {
            key: _sorted_hypercube_qnames(value, hypercube_by_qname)
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
        matched_hypercubes = [qname] if qname in index["hypercube_by_qname"] else []
    elif concept_type == "dimension":
        matched_dimensions = [qname] if qname in index["dimension_by_qname"] else []
        matched_hypercubes = index["dimension_to_hypercubes"].get(qname, [])
    elif concept_type == "dimension member":
        matched_dimensions = index["member_to_dimensions"].get(qname, [])
        cube_set = set()
        for dimension_qname in matched_dimensions:
            cube_set.update(index["dimension_to_hypercubes"].get(dimension_qname, []))
        matched_hypercubes = _sorted_hypercube_qnames(cube_set, index["hypercube_by_qname"])
    else:
        matched_hypercubes = _sorted_hypercube_qnames(
            set(index["primary_item_to_hypercubes"].get(qname, []))
            | set(index["concept_to_hypercubes_from_concepts"].get(qname, [])),
            index["hypercube_by_qname"],
        )

    resolved_hypercubes = []
    for hypercube_qname in matched_hypercubes:
        hypercube = index["hypercube_by_qname"].get(hypercube_qname)
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
                "isSelectedHypercube": hypercube_qname == qname,
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
