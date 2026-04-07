# Schema information: Iterate over all concepts in the DTS, extract their schema information (including hypercube membership and custom UK arcroles crossref, inflows, outflows), and write to JSON (concepts.json)

from arelle import ModelXbrl, XbrlConst
from arelle.ModelDtsObject import ModelConcept


class SimpleHypercubeFinder:
    """
    Finds all hypercubes associated with a given concept by climbing
    domain-member relationships until it finds a primary item with
    an 'all' relationship to a hypercube.
    Returns a list of hypercube QNames as strings.
    """

    def __init__(self, model_xbrl: ModelXbrl):
        self.model_xbrl = model_xbrl
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
        return sorted(str(h.qname) for h in found_hypercubes)

    def _collect_hypercubes(self, concept: ModelConcept, visited: set, results: set):
        if concept in visited:
            return
        visited.add(concept)
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
        expected_prefix = None
        for qn in self.model_xbrl.qnameConcepts:
            if qn.namespaceURI.strip() == ns.strip():
                expected_prefix = getattr(qn, "prefix", str(qn).split(":")[0])
                break
        if expected_prefix is None:
            return None
        expected_qname_str = f"{expected_prefix}:{ln.strip()}"
        for qn, concept in self.model_xbrl.qnameConcepts.items():
            if str(qn).strip() == expected_qname_str:
                return concept
        return None


class ConceptDetailsExtractor:
    """
    Extracts all relevant details about a single concept from the UK Taxonomy Suite.
    """

    def __init__(self, model_taxonomy: ModelXbrl):
        self.model_taxonomy = model_taxonomy

    @staticmethod
    def is_valid_concept(concept):
        """
        Removes XBRL specific concepts (e.g. xl:documentation).
        """
        ns = concept.qname.namespaceURI
        return "frc" in ns and (
            concept.isItem or concept.isDimensionItem or concept.isDomainMember
        )

    def get_concept_json(self, concept_ns: str, concept_name: str):
        # Find the concept
        expected_prefix = None
        for qn in self.model_taxonomy.qnameConcepts.keys():
            if qn.namespaceURI.strip() == concept_ns.strip():
                expected_prefix = getattr(qn, "prefix", str(qn).split(":")[0])
                break
        if expected_prefix is None:
            return None
        expected_qname_str = f"{expected_prefix}:{concept_name.strip()}"
        concept = None
        for qn, c in self.model_taxonomy.qnameConcepts.items():
            if str(qn).strip() == expected_qname_str:
                concept = c
                break
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
                preferred_label_role = LABEL_ROLE_TO_TYPE.get(role_uri, role_uri)
                break

        # Labels
        labels = []
        for labRel in self.model_taxonomy.relationshipSet(
            XbrlConst.conceptLabel
        ).fromModelObject(concept):
            label_resource = labRel.toModelObject
            if label_resource is not None:
                role = label_resource.role
                label_type = LABEL_ROLE_TO_TYPE.get(role, role)
                labels.append(
                    {
                        "lang": label_resource.xmlLang,
                        "type": label_type,
                        "label_text": label_resource.text,
                    }
                )

        # References
        references = []
        ref_rels = self.model_taxonomy.relationshipSet(
            XbrlConst.conceptReference
        ).fromModelObject(concept)
        for ref_rel in ref_rels:
            ref_resource = ref_rel.toModelObject
            if ref_resource is not None:
                ref_data = {}
                for child in ref_resource.iterchildren():
                    local_tag = (
                        child.tag.split("}")[1] if "}" in child.tag else child.tag
                    )
                    ref_data[local_tag.lower()] = (
                        child.text
                    )  # use lowercase keys for uniformity

                role_uri = ref_resource.role
                role_label = (
                    self.model_taxonomy.roleTypeDefinition(role_uri) or "Standard"
                )

                references.append(
                    {
                        "reference_role": role_label,
                        "name": ref_data.get("name"),
                        "number": ref_data.get("number"),
                        "year": ref_data.get("year"),
                        "schedule": ref_data.get("schedule"),
                        "part": ref_data.get("part"),
                        "section": ref_data.get("section"),
                        "paragraph": ref_data.get("paragraph"),
                        "report": ref_data.get("report"),
                    }
                )

        # Hypercubes
        hypercube_finder = SimpleHypercubeFinder(self.model_taxonomy)
        hypercubes = hypercube_finder.get_hypercubes(concept_ns, concept_name)

        # Arcrole extraction
        crossref_arcrole = "http://xbrl.frc.org.uk/general/types/arcroles/crossref"
        inflow_arcrole = "http://xbrl.frc.org.uk/general/types/arcroles/inflow"
        outflow_arcrole = "http://xbrl.frc.org.uk/general/types/arcroles/outflow"

        # Crossref: find all sources that point to this concept
        crossref_sources = []
        relset = self.model_taxonomy.relationshipSet(crossref_arcrole)
        if relset:
            for elr in relset.linkRoleUris:
                crossref_rels = self.model_taxonomy.relationshipSet(
                    crossref_arcrole, linkrole=elr
                ).modelRelationships
                for rel in crossref_rels:
                    if rel.fromModelObject == concept:
                        crossref_sources.append(str(rel.toModelObject.qname))
        cross_ref_destination = crossref_sources if crossref_sources else None

        # Cash flow classification: inflow/outflow if this concept is a target
        cash_flow_classification = None
        for arcrole, classification in [
            (inflow_arcrole, "inflow"),
            (outflow_arcrole, "outflow"),
        ]:
            relset = self.model_taxonomy.relationshipSet(arcrole)
            if relset is not None:
                for rel in relset.modelRelationships:
                    if rel.toModelObject == concept:
                        cash_flow_classification = classification
                        break
            if cash_flow_classification:
                break

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
