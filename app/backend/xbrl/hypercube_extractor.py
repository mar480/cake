# from collections import defaultdict
import re
from arelle import ModelXbrl 
from arelle.ModelDtsObject import ModelConcept
from arelle.ModelRelationshipSet import ModelRelationship

class HypercubeDiscoverer:
    """
    Navigates from a domain-member concept up to its hypercube(s).
    For each hypercube discovered, collects:
      - Dimensions (via hypercube-dimension),
      - The dimension default (via dimension-default),
      - Domain members (via dimension-domain -> domain-member).
    """

    def __init__(self, model_xbrl: ModelXbrl):
        self.model_xbrl = model_xbrl

        # Preload relationship sets once to avoid repeated calls.
        self.domainMemberRelSet       = model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/domain-member")
        self.dimensionDomainRelSet    = model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/dimension-domain")
        self.hypercubeDimensionRelSet = model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/hypercube-dimension")
        self.allRelSet                = model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/all")
        self.dimensionDefaultRelSet   = model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/dimension-default")

    def find_hypercubes_for_concept(self, concept_ns: str, concept_name: str):

        concept = self._get_concept_by_name(concept_ns, concept_name)
        if concept is None:
            print(f"[WARN] No concept found for localName='{concept_name}' in ns='{concept_ns}'.")
            return []

        print(f"Starting bottom-up search for concept: {concept.qname}")

        # We'll collect final hypercube info objects in this list
        hypercube_info_list = []

        # A visited set to avoid cycles when climbing domain-member arcs
        visited_concepts = set()

        # A set of hypercube concepts we've already processed, 
        # to avoid duplicates in the final output
        visited_hypercubes = set()

        self._find_hypercubes(
            concept,
            visited_concepts,
            visited_hypercubes,
            hypercube_info_list
        )

        print(f"\nDiscovered {len(hypercube_info_list)} hypercube(s) for {concept.qname}\n")
        for hcinfo in hypercube_info_list:
            print(f" - Hypercube: {hcinfo['hypercubeName']}")
            print(f" - Hypercube: {hcinfo['definition']}")

            for dim in hcinfo["dimensions"]:
                print(f"    Dimension: {dim['dimensionName']}")
                print(f"    Dimension: {dim['dimensionELR']}")
                print(f"      Default: {dim['defaultMember']}")
                print(f"      Members: {dim['domainMembers']}")

        return hypercube_info_list

    def _find_hypercubes(self,
                         concept: ModelConcept,
                         visited_concepts: set,
                         visited_hypercubes: set,
                         hypercube_info_list: list):
        """
        Climb up domain-member relationships from 'concept'. If we reach a concept
        that has an 'all' arc to a hypercube, we gather the hypercube details.
        Otherwise, keep climbing.

        visited_concepts: track which concepts we've climbed from, to avoid cycles
        visited_hypercubes: track which hypercube concepts we've already processed
                            to avoid duplicating them in the final list
        """
        if concept in visited_concepts:
            return
        visited_concepts.add(concept)

        parent_rels = self.domainMemberRelSet.toModelObject(concept)
        if parent_rels is None or len(parent_rels) == 0:
            # No parents => can't climb further
            return

        for rel in parent_rels:
            parent_concept = rel.fromModelObject
            if parent_concept is not None:
                # print(f"  Parent found via domain-member: {parent_concept.qname} -> {concept.qname}")

                # Check if the parent has an "all" arc to a hypercube
                all_relationships = self.allRelSet.fromModelObject(parent_concept)
                if all_relationships is not None and len(all_relationships) > 0:
                    for all_rel in all_relationships:
                        hypercube = all_rel.toModelObject
                        if hypercube is not None:
                            if hypercube not in visited_hypercubes:
                                # Only process this hypercube if we haven't already
                                visited_hypercubes.add(hypercube)

                                # print(f"    Found hypercube via 'all': {hypercube.qname}")
                                hc_info = self._collect_hypercube_info(hypercube, all_rel)
                                if hc_info is not None:
                                    hypercube_info_list.append(hc_info)
                else:
                    # If no hypercube is found here, climb further up
                    self._find_hypercubes(parent_concept,
                                          visited_concepts,
                                          visited_hypercubes,
                                          hypercube_info_list)

    def _collect_hypercube_info(self, hypercube: ModelConcept, arc: ModelRelationship):
        """
        Collect top-level info for the hypercube and delegate dimension collection.
        """
        hypercube_qn = str(hypercube.qname)
        elr = arc.linkrole

        role_type = self.model_xbrl.roleTypes.get(elr)
        definition = role_type[0].definition if (role_type and role_type[0].definition) else elr

        match = re.search(r"(\d+)", definition)
        elr_id = int(match.group(1)) if match else None

        dimensions = self._collect_dimensions_for_hypercube(hypercube)

        return {
            "hypercubeName": hypercube_qn,
            "hypercubeELR": elr,
            "definition": definition,
            "elr_id": elr_id,
            "dimensions": dimensions
        }


    def _collect_dimensions_for_hypercube(self, hypercube: ModelConcept):
        """
        Given a hypercube concept, find its dimensions and delegate to dimension collector.
        """
        dimensions = []
        seen_keys = set()
        dims = self.hypercubeDimensionRelSet.fromModelObject(hypercube)

        if dims is not None:
            for drel in dims:
                dim_concept = drel.toModelObject
                if dim_concept is not None:
                    dim_qn = str(dim_concept.qname)

                    for rel in self.dimensionDomainRelSet.modelRelationships:
                        if rel.fromModelObject == dim_concept:
                            elr = rel.linkrole
                            key = (dim_qn, elr)
                            if key in seen_keys:
                                continue
                            seen_keys.add(key)

                            dim_info = self._collect_dimension_info(dim_concept, elr)
                            if dim_info is not None:
                                dimensions.append(dim_info)

        return dimensions


    def _collect_dimension_info(self, dimension: ModelConcept, elr: str):
        """
        Return dimension metadata + default + full domain member tree.
        """
        dim_qn = str(dimension.qname)

        role_type = self.model_xbrl.roleTypes.get(elr)
        definition = role_type[0].definition if (role_type and role_type[0].definition) else elr

        match = re.search(r"(\d+)", definition)
        elr_id = int(match.group(1)) if match else None

        default_member = self._get_dimension_default(dimension, elr)
        default_qn = str(default_member.qname) if default_member is not None else None

        domain_members = self._get_domain_members(dimension, elr)

        return {
            "dimensionName": dim_qn,
            "dimensionELR": elr,
            "definition": definition,
            "elr_id": elr_id,
            "defaultMember": default_qn,
            "domainMembers": domain_members
        }


    def _get_domain_members(self, dimension: ModelConcept, elr: str):
        """
        Find root domain concepts for a dimension and build full nested tree for each.
        """
        if dimension.isTypedDimension:
            return []

        if elr:
            dim_domain_rels = self.model_xbrl.relationshipSet(
                "http://xbrl.org/int/dim/arcrole/dimension-domain", linkrole=elr
            ).fromModelObject(dimension)
        else:
            dim_domain_rels = self.dimensionDomainRelSet.fromModelObject(dimension)

        if dim_domain_rels is None:
            return []

        members = []
        seen_qnames = set()

        for rel in dim_domain_rels:
            domain_concept = rel.toModelObject
            if domain_concept is not None:
                tree = self._build_member_tree_dedup(domain_concept, seen_qnames, elr)
                if tree is not None:
                    members.append(tree)

        return members


    def _build_member_tree_dedup(self, concept: ModelConcept, seen_qnames: set, elr: str) -> dict:
        """
        Recursively walk domain-member arcs from a domain concept.
        """
        qn_str = str(concept.qname)
        if qn_str in seen_qnames:
            return None
        seen_qnames.add(qn_str)

        children = []

        if elr:
            rels = self.model_xbrl.relationshipSet(
                "http://xbrl.org/int/dim/arcrole/domain-member", linkrole=elr
            ).fromModelObject(concept)
        else:
            rels = self.domainMemberRelSet.fromModelObject(concept)

        if rels is not None:
            for rel in rels:
                child = rel.toModelObject
                if child is not None:
                    subtree = self._build_member_tree_dedup(child, seen_qnames, elr)
                    if subtree is not None:
                        children.append(subtree)

        return {
            "name": qn_str,
            "label": self._get_concept_label(concept, lang="en"),
            "label_cy": self._get_concept_label(concept, lang="cy"),
            "children": children
        }


    def _get_concept_label(self, concept: ModelConcept, lang: str) -> str:
        """
        Return the label in the requested language (e.g., 'en', 'cy') using explicit inspection
        of label resources. Fallback to QName if no match is found.
        """
        rel_set = self.model_xbrl.relationshipSet("http://www.xbrl.org/2003/arcrole/concept-label")
        if rel_set is not None:
            for labRel in rel_set.fromModelObject(concept):
                label_resource = labRel.toModelObject
                if label_resource is not None and label_resource.xmlLang == lang:
                    return label_resource.text
        return str(concept.qname)



    def _get_dimension_default(self, dimension: ModelConcept, elr: str):
        """
        dimension-default arcs typically go: Dimension -> DefaultMember
        We'll just return the first one we find for the specified ELR (if given), else fallback.
        """
        if elr is not None:
            rels = self.model_xbrl.relationshipSet("http://xbrl.org/int/dim/arcrole/dimension-default", linkrole=elr).fromModelObject(dimension)
        else:
            rels = self.dimensionDefaultRelSet.fromModelObject(dimension)

        if rels is not None:
            for rel in rels:
                default_concept = rel.toModelObject
                if default_concept is not None:
                    return default_concept
        return None









    # -----------------------------------------------------------
    # Utility for concept lookup
    # -----------------------------------------------------------
    def _get_concept_by_name(self, ns: str, ln: str):
        """
        Retrieve a concept by localName and namespace using QName string comparison.
        """
        expected_prefix = None
        for qn in self.model_xbrl.qnameConcepts.keys():
            if qn.namespaceURI.strip() == ns.strip():
                if hasattr(qn, "prefix"):
                    expected_prefix = qn.prefix
                else:
                    parts = str(qn).split(":")
                    if len(parts) > 1:
                        expected_prefix = parts[0]
                break

        if expected_prefix is None:
            print("Could not determine a prefix for namespace:", ns)
            return None

        expected_qname_str = f"{expected_prefix}:{ln.strip()}"
        print(f"Expected QName string: {expected_qname_str}")

        for qn, concept in self.model_xbrl.qnameConcepts.items():
            qn_str = str(qn).strip()
            if qn_str == expected_qname_str:
                print(f"FOUND MATCH: {qn_str} for concept")
                return concept

        print("Concept not found for", expected_qname_str)
        return None