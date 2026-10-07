"""Extraction semantics migrated from the unified notebook; no notebook runtime needed."""
# Schema information: Iterate over all concepts in the DTS, extract their schema information (including hypercube membership and custom UK arcroles crossref, inflows, outflows), and write to JSON (concepts.json)

from arelle import ModelXbrl
from arelle.ModelDtsObject import ModelConcept
from arelle import XbrlConst
import json
import re
import uuid
from .helpers import elr_sort_key, extract_elr_numeric_part

TAXONOMY_NAMESPACE_HINTS = ("frc", "xbrl.frc.org.uk", "xbrl.org/2024/iso3166")


class SimpleHypercubeFinder:
    """
    Finds all hypercubes associated with a given concept by climbing
    domain-member relationships until it finds a primary item with
    an 'all' relationship to a hypercube.
    Returns a list of hypercube QNames as strings.
    """

    def __init__(self, model_xbrl: ModelXbrl):
        self.model_xbrl = model_xbrl
        self.concepts_by_name = {(qn.namespaceURI.strip(), qn.localName.strip()): c for qn, c in model_xbrl.qnameConcepts.items()}
        self._hypercubes_by_concept = {}
        self.domainMemberRelSet = model_xbrl.relationshipSet(
            "http://xbrl.org/int/dim/arcrole/domain-member"
        )
        self.allRelSet = model_xbrl.relationshipSet(
            "http://xbrl.org/int/dim/arcrole/all"
        )

    def get_hypercubes(self, concept_ns: str, concept_name: str):
        concept = self._get_concept_by_name(concept_ns, concept_name)
        if concept is None:
            return []
        visited_concepts = set()
        found_hypercubes = set()
        self._collect_hypercubes(concept, visited_concepts, found_hypercubes)
        self._hypercubes_by_concept[concept] = frozenset(found_hypercubes)
        return sorted(str(h.qname) for h in found_hypercubes)

    def _collect_hypercubes(self, concept: ModelConcept, visited: set, results: set):
        if concept in visited:
            return
        visited.add(concept)
        if concept in self._hypercubes_by_concept:
            results.update(self._hypercubes_by_concept[concept])
            return
        parent_rels = self.domainMemberRelSet.toModelObject(concept)
        if not parent_rels:
            return
        for rel in parent_rels:
            parent = rel.fromModelObject
            if parent is not None:
                all_rels = self.allRelSet.fromModelObject(parent)
                if all_rels:
                    for all_rel in all_rels:
                        hypercube = all_rel.toModelObject
                        if hypercube is not None:
                            results.add(hypercube)
                else:
                    self._collect_hypercubes(parent, visited, results)

    def _get_concept_by_name(self, ns: str, ln: str):
        return self.concepts_by_name.get((ns.strip(), ln.strip()))


class ConceptDetailsExtractor:
    """
    Extracts all relevant details about a single concept from the UK Taxonomy Suite.
    """

    def __init__(self, model_taxonomy: ModelXbrl, namespace_hints=None):
        self.model_taxonomy = model_taxonomy
        self.namespace_hints = namespace_hints or TAXONOMY_NAMESPACE_HINTS
        self.hypercube_finder = SimpleHypercubeFinder(model_taxonomy)
        self.concepts_by_name = self.hypercube_finder.concepts_by_name
        self.crossrefs_by_source = {}
        crossref_arcrole = "http://xbrl.frc.org.uk/general/types/arcroles/crossref"
        relset = model_taxonomy.relationshipSet(crossref_arcrole)
        if relset:
            for elr in relset.linkRoleUris:
                for rel in model_taxonomy.relationshipSet(crossref_arcrole, linkrole=elr).modelRelationships:
                    if rel.toModelObject is not None:
                        self.crossrefs_by_source.setdefault(rel.fromModelObject, []).append(str(rel.toModelObject.qname))
        self.cash_flow_by_target = {}
        for arcrole, classification in [("http://xbrl.frc.org.uk/general/types/arcroles/inflow", "inflow"),
                                        ("http://xbrl.frc.org.uk/general/types/arcroles/outflow", "outflow")]:
            relset = model_taxonomy.relationshipSet(arcrole)
            if relset is not None:
                for rel in relset.modelRelationships:
                    self.cash_flow_by_target.setdefault(rel.toModelObject, classification)

    def _role_label(self, role_uri: str, known_roles: dict[str, str]) -> str:
        known_label = known_roles.get(role_uri)
        if known_label:
            return known_label

        role_types = self.model_taxonomy.roleTypes.get(role_uri) or []
        if role_types:
            definition = (getattr(role_types[0], "definition", None) or "").strip()
            if definition:
                return definition

        return role_uri

    def is_valid_concept(self, concept):
        """
        Removes XBRL specific concepts (e.g. xl:documentation).
        """
        ns = (concept.qname.namespaceURI or "").lower()
        return any(hint in ns for hint in self.namespace_hints) and (
            concept.isItem or concept.isDimensionItem or concept.isDomainMember
        )

    def get_concept_json(self, concept_ns: str, concept_name: str):
        concept = self.concepts_by_name.get((concept_ns.strip(), concept_name.strip()))
        if concept is None:
            return None

        # Preferred label role (from presentation arcs)
        LABEL_ROLE_TO_TYPE = {
            "http://www.xbrl.org/2003/role/label": "Standard Label",
            "http://www.xbrl.org/2003/role/documentation": "Documentation",
            "http://www.xbrl.org/2003/role/reference": "Reference",
            "http://www.xbrl.org/2003/role/periodStartLabel": "Period Start Label",
            "http://www.xbrl.org/2003/role/periodEndLabel": "Period End Label",
            "http://www.xbrl.org/2003/role/verboseLabel": "Verbose Label",
            "http://www.xbrl.org/2003/role/terseLabel": "Terse Label",
        }
        preferred_label_role = None
        for presRel in self.model_taxonomy.relationshipSet(
            XbrlConst.parentChild
        ).toModelObject(concept):
            if getattr(presRel, "preferredLabel", None):
                role_uri = presRel.preferredLabel
                preferred_label_role = self._role_label(role_uri, LABEL_ROLE_TO_TYPE)
                break

        # Labels
        labels = []
        for labRel in self.model_taxonomy.relationshipSet(
            XbrlConst.conceptLabel
        ).fromModelObject(concept):
            label_resource = labRel.toModelObject
            if label_resource is not None:
                role = label_resource.role
                label_type = self._role_label(role, LABEL_ROLE_TO_TYPE)
                labels.append(
                    {
                        "lang": label_resource.xmlLang,
                        "type": label_type,
                        "label_text": label_resource.text,
                    }
                )

        # References
        REFERENCE_ROLE_URI_TO_LABEL = {
            "http://www.xbrl.org/2003/role/reference": "Reference",
            "http://xbrl.frc.org.uk/general/ref/roles/AuditRegs": "Audit Regulations",
            "http://xbrl.frc.org.uk/general/ref/roles/Cic34": "CIC 34",
            "http://xbrl.frc.org.uk/general/ref/roles/CompaniesAct": "Companies Act",
            "http://xbrl.frc.org.uk/general/ref/roles/FRS101": "FRS 101",
            "http://xbrl.frc.org.uk/general/ref/roles/FRS102": "FRS 102",
            "http://xbrl.frc.org.uk/char/ref/roles/CharitiesAct2011": "Charities Act 2011",
            "http://xbrl.frc.org.uk/char/ref/roles/CharitiesSORP": "Charities SORP 2019",
            "http://xbrl.frc.org.uk/char/ref/roles/CharitiesSORP2026": "Charities SORP 2026",
            "http://xbrl.frc.org.uk/general/ref/roles/Full": "Full",
            "http://xbrl.frc.org.uk/general/ref/roles/Standard": "Standard",
            "http://xbrl.frc.org.uk/general/ref/roles/fullFRS101": "Full / FRS 101",
        }

        def extract_references(model_taxonomy, concept: ModelConcept):
            """
            Extract all references from the reference linkbase for this concept.
            """
            refs_info = []

            ref_rels = model_taxonomy.relationshipSet(
                XbrlConst.conceptReference
            ).fromModelObject(concept)

            for ref_rel in ref_rels:
                ref_resource = ref_rel.toModelObject
                if ref_resource is not None:
                    role_uri = ref_resource.role
                    ref_data = {"reference_role_uri": role_uri}

                    for child in ref_resource.iterchildren():
                        local_tag = (
                            child.tag.split("}")[1] if "}" in child.tag else child.tag
                        )
                        ref_data[local_tag] = child.text

                    refs_info.append(ref_data)

            return refs_info

        raw_refs = extract_references(self.model_taxonomy, concept)

        references = []
        for ref_data in raw_refs:
            lower_ref_data = {k.lower(): v for k, v in ref_data.items()}
            reference_role_uri = ref_data.get("reference_role_uri")
            references.append(
                {
                    "reference_key_values": ref_data,  # full key/value mapping
                    "reference_role_uri": reference_role_uri,
                    "reference_role": self._role_label(
                        reference_role_uri, REFERENCE_ROLE_URI_TO_LABEL
                    ),
                    "name": lower_ref_data.get("name"),
                    "number": lower_ref_data.get("number"),
                    "year": lower_ref_data.get("year"),
                    "schedule": lower_ref_data.get("schedule"),
                    "part": lower_ref_data.get("part"),
                    "section": lower_ref_data.get("section"),
                    "paragraph": lower_ref_data.get("paragraph"),
                    "report": lower_ref_data.get("report"),
                }
            )

        # Hypercubes
        hypercubes = self.hypercube_finder.get_hypercubes(concept_ns, concept_name)

        cross_ref_destination = self.crossrefs_by_source.get(concept) or None
        cash_flow_classification = self.cash_flow_by_target.get(concept)

        # Main concept dict
        concept_json = {
            "concept": {
                "local_name": concept.qname.localName,
                "xbrl_type": str(concept.baseXbrliType),
                "period_type": concept.periodType,
                "balance": concept.balance,
                "abstract": concept.isAbstract,
                "nillable": concept.nillable,
                "namespace": concept.qname.namespaceURI,
                "full_type": str(concept.typeQname) if concept.typeQname else None,
                "substitution_group": (
                    str(concept.substitutionGroupQname)
                    if concept.substitutionGroupQname
                    else None
                ),
                "preferred_label_role": preferred_label_role,
            },
            "labels": labels,
            "references": references,
            "hypercubes": hypercubes,
            "cash_flow_classification": cash_flow_classification,
            "cross_ref_destination": cross_ref_destination,
        }
        return concept_json

    def get_all_concept_details(self):
        """
        Iterate over all valid concepts and return a dictionary keyed by QName string.
        """
        all_concepts = {}
        for concept in self.model_taxonomy.qnameConcepts.values():
            if not self.is_valid_concept(concept):
                continue
            qname_str = str(concept.qname)
            ns = concept.qname.namespaceURI
            ln = concept.qname.localName
            concept_json = self.get_concept_json(ns, ln)
            if concept_json:
                all_concepts[qname_str] = concept_json
        return all_concepts

    #  1/3 Extract all hypercubes and their dimensions/primaries


def extract_hypercubes(model_xbrl):
    hypercubes = {}

    all_relset = model_xbrl.relationshipSet(XbrlConst.all)
    for elr in all_relset.linkRoleUris:
        rel_set = model_xbrl.relationshipSet(XbrlConst.all, linkrole=elr)
        root_concepts = rel_set.rootConcepts

        role_type = model_xbrl.roleTypes.get(elr)
        definition = (
            role_type[0].definition if (role_type and role_type[0].definition) else elr
        )
        elr_id = extract_elr_numeric_part(definition)

        for primary_item in root_concepts:
            all_relationships = rel_set.fromModelObject(primary_item)
            for all_rel in all_relationships:
                hypercube = all_rel.toModelObject
                if hypercube is None:
                    continue
                hc_qn = str(hypercube.qname)
                if hc_qn not in hypercubes:
                    # Get dimensions for this hypercube
                    dims = []
                    hc_dim_rels = model_xbrl.relationshipSet(
                        XbrlConst.hypercubeDimension, linkrole=elr
                    ).fromModelObject(hypercube)
                    for dim_rel in hc_dim_rels or []:
                        dimension = dim_rel.toModelObject
                        if dimension is not None:
                            dims.append(str(dimension.qname))
                    hypercubes[hc_qn] = {
                        "hypercube_qname": hc_qn,
                        "elr": elr,
                        "elr_id": elr_id,
                        "role_definition": definition,
                        "dimensions": dims,
                        "primary_items": set(),
                    }
                # Add this primary item to the hypercube's list
                hypercubes[hc_qn]["primary_items"].add(str(primary_item.qname))
        # Convert sets to lists for JSON serialization
    for hc in hypercubes.values():
        hc["primary_items"] = list(hc["primary_items"])
    return list(hypercubes.values())


# 2/3 Extract all dimensions, their defaults, and domain member trees


def get_default_member(model_xbrl, dimension, elr):
    rels = model_xbrl.relationshipSet(
        XbrlConst.dimensionDefault, linkrole=elr
    ).fromModelObject(dimension)
    if rels:
        for rel in rels:
            return str(rel.toModelObject.qname)
    return None


def collect_domain_tree(
    model_xbrl, dimension_concept, domain_concept, elr, visited=None
):
    if visited is None:
        visited = set()
    if domain_concept in visited:
        return None
    visited.add(domain_concept)
    children = []
    domain_member_rels = model_xbrl.relationshipSet(
        XbrlConst.domainMember, linkrole=elr
    ).fromModelObject(domain_concept)
    for rel in domain_member_rels or []:
        child = rel.toModelObject
        if child is not None:
            subtree = collect_domain_tree(
                model_xbrl, dimension_concept, child, elr, visited
            )
            if subtree:
                children.append(subtree)
    return {"member_qname": str(domain_concept.qname), "children": children}


def extract_dimensions(model_xbrl):
    dimensions = []

    dim_relset = model_xbrl.relationshipSet("XBRL-dimensions")
    for elr in dim_relset.linkRoleUris:
        rel_set = model_xbrl.relationshipSet("XBRL-dimensions", linkrole=elr)
        root_concepts = rel_set.rootConcepts

        role_type = model_xbrl.roleTypes.get(elr)
        definition = (
            role_type[0].definition if role_type and role_type[0].definition else elr
        )
        elr_id = extract_elr_numeric_part(definition)

        for dimension in root_concepts:
            if not (dimension.isExplicitDimension or dimension.isTypedDimension):
                continue
            default_member = get_default_member(model_xbrl, dimension, elr)
            domain_rels = model_xbrl.relationshipSet(
                XbrlConst.dimensionDomain, linkrole=elr
            ).fromModelObject(dimension)
            domain_trees = []
            for drel in domain_rels or []:
                domain = drel.toModelObject
                if domain is not None:
                    tree = collect_domain_tree(model_xbrl, dimension, domain, elr)
                    if tree:
                        domain_trees.append(tree)
            dimensions.append(
                {
                    "dimension_qname": str(dimension.qname),
                    "elr": elr,
                    "elr_id": elr_id,
                    "role_definition": definition,
                    "default_member": default_member,
                    "domain_members": domain_trees,
                }
            )
    return dimensions


# 3/3 Extract primary items and their trees for each hypercube


def is_digit_ending_hypercube_role(definition: str) -> bool:
    digit_at_end = re.compile(r".*\d+\s*$")
    return "Hypercube" in definition and bool(digit_at_end.match(definition))


def is_hypercube_elr(elr: str, definition: str) -> bool:
    """
    Returns True if the ELR or its definition indicates a hypercube.
    """
    return "Hypercube" in definition or "Hypercube" in elr


def is_hypercube(concept) -> bool:
    """
    Returns True if the concept is a hypercube (substitutionGroupQname.localName == 'hypercubeItem').
    """
    sub_group = getattr(concept, "substitutionGroupQname", None)
    return (
        sub_group is not None
        and getattr(sub_group, "localName", "").lower() == "hypercubeitem"
    )


def get_label_in_language(concept, lang_code="cy"):
    """
    Returns the label for the concept in the specified language code (e.g., 'cy' for Welsh).
    Returns None if not found.
    """
    for labRel in concept.modelXbrl.relationshipSet(
        "http://www.xbrl.org/2003/arcrole/concept-label"
    ).fromModelObject(concept):
        label_resource = labRel.toModelObject
        if (
            label_resource is not None
            and getattr(label_resource, "xmlLang", None) == lang_code
            and getattr(label_resource, "role", "http://www.xbrl.org/2003/role/label") == "http://www.xbrl.org/2003/role/label"
        ):
            return label_resource.text
    return None


def build_primary_items_tree(element, rel_set, visited, level=0, skip_visited=False):
    """
    Recursively build a tree of primary items (line items) for a given hypercube root.
    Excludes hypercube and dimension items from children.
    """
    if not skip_visited and element in visited:
        return None
    visited.add(element)

    # Exclude hypercube and dimension items from children
    if (
        is_hypercube(element)
        or getattr(element, "isDimensionItem", False)
        or getattr(element, "isTypedDimension", False)
    ):
        return None

    node = {
        "qname": str(element.qname),
        "label": get_label_in_language(element, "en") or str(element.qname),
        "label_cy": get_label_in_language(element, "cy"),
        "children": [],
    }

    for rel in rel_set.fromModelObject(element):
        child = rel.toModelObject
        if child is not None:
            child_node = build_primary_items_tree(
                child, rel_set, visited, level + 1, skip_visited=skip_visited
            )
            if child_node:
                node["children"].append(child_node)
    return node


def extract_hypercube_primary_items(model_taxonomy):
    """
    For each hypercube ELR, extract the hierarchical tree of primary items.
    Returns a list of dicts, one per ELR/hypercube.
    """
    dim_rs = model_taxonomy.relationshipSet("XBRL-dimensions")
    elr_data = []

    for elr in dim_rs.linkRoleUris:
        rel_set = model_taxonomy.relationshipSet("XBRL-dimensions", linkrole=elr)
        role_type = model_taxonomy.roleTypes.get(elr)
        definition = (
            role_type[0].definition if (role_type and role_type[0].definition) else elr
        )
        numeric_part = extract_elr_numeric_part(definition)

        # Only process if this ELR is for a hypercube
        if not is_hypercube_elr(elr, definition):
            continue

        root_concepts = rel_set.rootConcepts
        skip_visited = is_digit_ending_hypercube_role(definition)

        # Build the tree for each root concept
        visited = set()
        trees = []
        for root in root_concepts:
            tree = build_primary_items_tree(
                root, rel_set, visited, 0, skip_visited=skip_visited
            )
            if tree:
                trees.append(tree)

        elr_data.append(
            {
                "elr": elr,
                "definition": definition,
                "elr_id": numeric_part,
                "primary_items_tree": trees,
            }
        )

    # Sort by elr_id for consistency
    elr_data_sorted = sorted(elr_data, key=elr_sort_key)
    return elr_data_sorted


def recurse_concept(
    concept, rel_set, elr, level=0, index=0, prefix="0000", parent_rel=None, arcrole="", ancestors=(), occurrence_path=()
):
    if concept in ancestors:
        raise ValueError(f"Relationship cycle in {arcrole} / {elr}: {concept.qname}")
    tree_id = f"{prefix}" + (f"-{str(index).zfill(4)}" if level > 0 else "")
    preferred_label = parent_rel.preferredLabel if parent_rel is not None else None
    name = concept.label(preferredLabel=preferred_label, lang="en")
    return {
        "tree_id": tree_id,
        "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, json.dumps([arcrole, elr, occurrence_path, str(concept.qname)]))),
        "qname": str(concept.qname),
        "name": name,
        "xbrl_type": concept.typeQname.localName if concept.typeQname else "",
        "full_type": str(concept.typeQname) if concept.typeQname else "",
        "label_cy": concept.label(lang="cy") or "",
        "substitution_group": (
            str(concept.substitutionGroupQname)
            if concept.substitutionGroupQname
            else ""
        ),
        "concept_id": str(concept.qname),
        "abstract": concept.isAbstract,
        "children": [
            recurse_concept(
                rel.toModelObject, rel_set, elr, level + 1, i, tree_id, parent_rel=rel,
                arcrole=arcrole, ancestors=(*ancestors, concept), occurrence_path=(*occurrence_path, i)
            )
            for i, rel in enumerate(rel_set.fromModelObject(concept))
        ],
    }


def export_linkbase_tree(model_taxonomy, arcrole, filename, print_label):
    tree_data = []
    for elr in model_taxonomy.relationshipSet(arcrole).linkRoleUris:
        rel_set = model_taxonomy.relationshipSet(arcrole, linkrole=elr)
        root_concepts = rel_set.rootConcepts
        role_type = model_taxonomy.roleTypes.get(elr)
        definition = (
            role_type[0].definition if role_type and role_type[0].definition else elr
        )
        numeric_part = extract_elr_numeric_part(definition)
        root_tree = [
            recurse_concept(c, rel_set, elr, prefix="0000", arcrole=arcrole, occurrence_path=(i,))
            for i, c in enumerate(root_concepts)
        ]
        tree_data.append(
            {
                "elr": elr,
                "definition": definition,
                "numeric_part": numeric_part,
                "root_tree": root_tree,
            }
        )
    tree_data.sort(key=elr_sort_key)
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(tree_data, f, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    print(f"{print_label} exported to: {filename}", flush=True)