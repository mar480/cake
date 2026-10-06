import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.search.index_builder import build_search_index
from backend.taxonomies.unified_tree_generator import (
    build_primary_items_tree,
    concept_namespace_allowed,
    elr_sort_key,
    extract_elr_numeric_part,
    find_sibling_frc_packages,
)


class _LabelResource:
    def __init__(self, language, text):
        self.xmlLang = language
        self.text = text


class _Relationship:
    def __init__(self, target):
        self.toModelObject = target


class _RelationshipSet:
    def __init__(self, relationships):
        self.relationships = relationships

    def fromModelObject(self, concept):
        return self.relationships.get(concept, [])


class _Concept:
    def __init__(self, qname, labels):
        self.qname = qname
        self.modelXbrl = type(
            "ModelXbrl",
            (),
            {"relationshipSet": lambda _self, _arcrole: _RelationshipSet({self: labels})},
        )()


def test_extract_elr_numeric_part_returns_first_number():
    assert extract_elr_numeric_part("9800 - Hypercube - Income") == 9800
    assert extract_elr_numeric_part("Hypercube 90002 - Detail 7") == 90002


def test_extract_elr_numeric_part_returns_none_for_unnumbered_definition():
    numeric_part = extract_elr_numeric_part("Country List")

    assert numeric_part is None
    assert extract_elr_numeric_part(None) is None
    assert json.dumps({"numeric_part": numeric_part}, allow_nan=False) == '{"numeric_part": null}'


def test_elr_sort_key_puts_unnumbered_elrs_last_alphabetically():
    groups = [
        {"elr": "role/zulu", "definition": "Zulu List", "numeric_part": None},
        {"elr": "role/9800", "definition": "9800 - Hypercube", "numeric_part": 9800},
        {"elr": "role/country", "definition": "Country List", "numeric_part": None},
        {"elr": "role/9000", "definition": "9000 - Hypercube", "numeric_part": 9000},
    ]

    assert [group["definition"] for group in sorted(groups, key=elr_sort_key)] == [
        "9000 - Hypercube",
        "9800 - Hypercube",
        "Country List",
        "Zulu List",
    ]


def test_elr_sort_key_supports_primary_item_elr_id_field():
    groups = [
        {"elr": "role/country", "definition": "Country List", "elr_id": None},
        {"elr": "role/9800", "definition": "9800 - Hypercube", "elr_id": 9800},
    ]

    assert sorted(groups, key=elr_sort_key)[0]["elr_id"] == 9800


def test_standard_namespace_filter_admits_iso_countries_only():
    assert concept_namespace_allowed("https://xbrl.org/2024/iso3166", False)
    assert concept_namespace_allowed("https://xbrl.frc.org.uk/fr/2027-01-01", False)
    assert not concept_namespace_allowed("http://www.xbrl.org/2003/instance", False)


def test_lloyds_namespace_filter_does_not_admit_iso_countries():
    assert not concept_namespace_allowed("https://xbrl.org/2024/iso3166", True)


def test_primary_item_labels_are_language_specific_regardless_of_resource_order():
    expected = {"label": "English label", "label_cy": "Label Cymraeg"}
    resources = [
        _Relationship(_LabelResource("cy", "Label Cymraeg")),
        _Relationship(_LabelResource("en", "English label")),
    ]

    for ordered_resources in (resources, list(reversed(resources))):
        concept = _Concept("core:Example", ordered_resources)
        tree = build_primary_items_tree(concept, _RelationshipSet({}), set())

        assert {key: tree[key] for key in expected} == expected


def test_primary_item_english_label_falls_back_to_qname():
    concept = _Concept(
        "core:NoEnglishLabel",
        [_Relationship(_LabelResource("cy", "Label Cymraeg"))],
    )

    tree = build_primary_items_tree(concept, _RelationshipSet({}), set())

    assert tree["label"] == "core:NoEnglishLabel"
    assert tree["label_cy"] == "Label Cymraeg"


def test_country_codes_and_names_are_included_in_search_index():
    index = build_search_index(
        {
            "country:GB": {
                "concept": {
                    "local_name": "GB",
                    "namespace": "https://xbrl.org/2024/iso3166",
                    "full_type": "dtr:domainItemType",
                    "substitution_group": "xbrli:item",
                },
                "labels": [
                    {
                        "lang": "en",
                        "type": "Standard Label",
                        "label_text": "United Kingdom of Great Britain and Northern Ireland",
                    },
                    {"lang": "en", "type": "Alphabetic 3 character code", "label_text": "GBR"},
                    {"lang": "en", "type": "Numeric code", "label_text": "826"},
                ],
                "references": [],
                "hypercubes": [],
            }
        }
    )

    assert index.token_index["kingdom"] == {"country:GB"}
    assert index.token_index["gbr"] == {"country:GB"}
    assert index.token_index["826"] == {"country:GB"}


def test_extension_package_discovers_sibling_frc_dependency(tmp_path):
    frc_zip = tmp_path / "FRC-2027-Taxonomy-v0.1.0.zip"
    frc_zip.touch()
    extension_zip = tmp_path / "Charities-2027-Taxonomy-v0.1.0.zip"
    extension_zip.touch()

    assert find_sibling_frc_packages(str(extension_zip)) == [str(frc_zip)]
    assert find_sibling_frc_packages(str(frc_zip)) == []
