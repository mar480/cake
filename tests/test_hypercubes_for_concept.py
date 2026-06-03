import json
import sys
from pathlib import Path

import pytest
from flask import Flask

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routes.api_routes import register_api_routes
from services.dimensional_relationships import (
    load_dimensional_relationship_index,
    resolve_dimensional_relationships,
)
from services.search_filters import load_cached_concepts_json_for_entrypoint
from state import taxonomy_cache


@pytest.fixture(autouse=True)
def _clear_global_taxonomy_state():
    taxonomy_cache["active"] = {"should_not_be_used": True}
    load_cached_concepts_json_for_entrypoint.cache_clear()
    load_dimensional_relationship_index.cache_clear()
    yield
    taxonomy_cache["active"] = None
    load_cached_concepts_json_for_entrypoint.cache_clear()
    load_dimensional_relationship_index.cache_clear()


def _write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _write_taxonomy_package(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<taxonomyPackage xmlns="http://xbrl.org/2016/taxonomy-package">
  <entryPoints>
    <entryPoint>
      <name>Entrypoint A</name>
      <entryPointDocument href="entry-a.xsd" />
    </entryPoint>
    <entryPoint>
      <name>Entrypoint B</name>
      <entryPointDocument href="entry-b.xsd" />
    </entryPoint>
  </entryPoints>
</taxonomyPackage>
""",
        encoding="utf-8",
    )


def _make_client(tmp_path):
    taxonomy_base_dir = tmp_path / "taxonomies"
    _write_taxonomy_package(
        taxonomy_base_dir / "2099" / "META-INF" / "taxonomyPackage.xml"
    )

    shared_dimensions = [
        {
            "dimension_qname": "core:ScenarioDimension",
            "elr": "http://example.com/roles/Dimension-Scenario",
            "elr_id": 7001,
            "role_definition": "7001 - Dimension - Scenario",
            "default_member": "core:ScenarioDefault",
            "domain_members": [
                {
                    "member_qname": "core:ScenarioMember",
                    "children": [],
                }
            ],
        }
    ]

    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint A" / "concepts.json",
        {
            "core:Revenue": {
                "concept": {
                    "qname": "core:Revenue",
                    "full_type": "xbrli:monetaryItemType",
                    "substitution_group": "xbrli:item",
                },
                "hypercubes": ["core:HypercubeForA"],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Revenue"}],
            },
            "core:OnlyFromConcepts": {
                "concept": {
                    "qname": "core:OnlyFromConcepts",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrli:item",
                },
                "hypercubes": ["core:HypercubeForA"],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Only from concepts"}],
            },
            "core:PrimaryOnly": {
                "concept": {
                    "qname": "core:PrimaryOnly",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrli:item",
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Primary only"}],
            },
            "core:PrimaryRootA": {
                "concept": {
                    "qname": "core:PrimaryRootA",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrli:item",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Primary root A"}],
            },
            "core:ScenarioDimension": {
                "concept": {
                    "qname": "core:ScenarioDimension",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrldt:dimensionItem",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Scenario dimension"}],
            },
            "core:ScenarioMember": {
                "concept": {
                    "qname": "core:ScenarioMember",
                    "full_type": "nonnum:domainItemType",
                    "substitution_group": "xbrli:item",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Scenario member"}],
            },
            "core:HypercubeForA": {
                "concept": {
                    "qname": "core:HypercubeForA",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrldt:hypercubeItem",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Hypercube A"}],
            },
        },
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint A" / "hypercubes.json",
        [
            {
                "hypercube_qname": "core:HypercubeForA",
                "elr": "http://example.com/roles/Hypercube-A",
                "elr_id": 9001,
                "role_definition": "9001 - Hypercube - A",
                "dimensions": ["core:ScenarioDimension"],
                "primary_items": ["core:PrimaryRootA"],
            }
        ],
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint A" / "dimensions.json",
        shared_dimensions,
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint A" / "primary_items.json",
        [
            {
                "elr": "http://example.com/roles/Hypercube-A",
                "definition": "9001 - Hypercube - A",
                "elr_id": 9001,
                "primary_items_tree": [
                    {
                        "qname": "core:PrimaryRootA",
                        "label": "Primary root A",
                        "children": [
                            {
                                "qname": "core:Revenue",
                                "label": "Revenue",
                                "children": [],
                            },
                            {
                                "qname": "core:PrimaryOnly",
                                "label": "Primary only",
                                "children": [],
                            },
                        ],
                    }
                ],
            }
        ],
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint B" / "concepts.json",
        {
            "core:Revenue": {
                "concept": {
                    "qname": "core:Revenue",
                    "full_type": "xbrli:monetaryItemType",
                    "substitution_group": "xbrli:item",
                },
                "hypercubes": ["core:HypercubeForB"],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Revenue"}],
            },
            "core:OnlyFromConcepts": {
                "concept": {
                    "qname": "core:OnlyFromConcepts",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrli:item",
                },
                "hypercubes": ["core:HypercubeForB"],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Only from concepts"}],
            },
            "core:PrimaryRootB": {
                "concept": {
                    "qname": "core:PrimaryRootB",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrli:item",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Primary root B"}],
            },
            "core:ScenarioDimension": {
                "concept": {
                    "qname": "core:ScenarioDimension",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrldt:dimensionItem",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Scenario dimension"}],
            },
            "core:HypercubeForB": {
                "concept": {
                    "qname": "core:HypercubeForB",
                    "full_type": "xbrli:stringItemType",
                    "substitution_group": "xbrldt:hypercubeItem",
                    "abstract": True,
                },
                "hypercubes": [],
                "labels": [{"type": "Standard Label", "lang": "en", "label_text": "Hypercube B"}],
            },
        },
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint B" / "hypercubes.json",
        [
            {
                "hypercube_qname": "core:HypercubeForB",
                "elr": "http://example.com/roles/Hypercube-B",
                "elr_id": 9002,
                "role_definition": "9002 - Hypercube - B",
                "dimensions": ["core:ScenarioDimension"],
                "primary_items": ["core:PrimaryRootB"],
            }
        ],
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint B" / "dimensions.json",
        shared_dimensions,
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint B" / "primary_items.json",
        [
            {
                "elr": "http://example.com/roles/Hypercube-B",
                "definition": "9002 - Hypercube - B",
                "elr_id": 9002,
                "primary_items_tree": [
                    {
                        "qname": "core:PrimaryRootB",
                        "label": "Primary root B",
                        "children": [
                            {
                                "qname": "core:Revenue",
                                "label": "Revenue",
                                "children": [],
                            }
                        ],
                    }
                ],
            }
        ],
    )

    app = Flask(__name__)
    register_api_routes(app, str(taxonomy_base_dir))
    return app.test_client(), taxonomy_base_dir


def test_hypercube_lookup_is_entrypoint_scoped_after_another_entrypoint_lookup(tmp_path):
    client, _ = _make_client(tmp_path)

    response_b = client.post(
        "/api/hypercubes-for-concept",
        json={"year": "2099", "href": "entry-b.xsd", "qname": "core:Revenue"},
    )
    assert response_b.status_code == 200
    assert response_b.get_json() == {"hypercubes": ["core:HypercubeForB"]}

    response_a = client.post(
        "/api/hypercubes-for-concept",
        json={"year": "2099", "href": "entry-a.xsd", "qname": "core:Revenue"},
    )
    assert response_a.status_code == 200
    assert response_a.get_json() == {"hypercubes": ["core:HypercubeForA"]}


def test_hypercube_lookup_requires_entrypoint_parameters(tmp_path):
    client, _ = _make_client(tmp_path)

    response = client.post(
        "/api/hypercubes-for-concept",
        json={"year": "2099", "href": "entry-a.xsd"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "Missing year, href, or qname"}


def test_hypercube_lookup_uses_resolved_union_not_raw_concepts_field(tmp_path):
    client, _ = _make_client(tmp_path)

    response = client.post(
        "/api/hypercubes-for-concept",
        json={"year": "2099", "href": "entry-a.xsd", "qname": "core:OnlyFromConcepts"},
    )

    assert response.status_code == 200
    assert response.get_json() == {"hypercubes": ["core:HypercubeForA"]}


def test_resolve_dimensional_relationships_unions_concept_and_primary_membership(tmp_path):
    _, taxonomy_base_dir = _make_client(tmp_path)

    payload = resolve_dimensional_relationships(
        taxonomy_base_dir=str(taxonomy_base_dir),
        year="2099",
        href="entry-a.xsd",
        qname="core:Revenue",
    )

    assert [item["hypercubeName"] for item in payload["hypercubes"]] == ["core:HypercubeForA"]
    assert payload["hypercubes"][0]["dimensions"][0]["dimensionName"] == "core:ScenarioDimension"
    assert payload["hypercubes"][0]["primaryItemsTree"][0]["qname"] == "core:PrimaryRootA"


def test_resolve_dimensional_relationships_includes_concepts_only_membership(tmp_path):
    _, taxonomy_base_dir = _make_client(tmp_path)

    payload = resolve_dimensional_relationships(
        taxonomy_base_dir=str(taxonomy_base_dir),
        year="2099",
        href="entry-a.xsd",
        qname="core:OnlyFromConcepts",
    )

    assert [item["hypercubeName"] for item in payload["hypercubes"]] == ["core:HypercubeForA"]
    assert payload["hypercubes"][0]["definition"] == "9001 - Hypercube - A"


def test_resolve_dimensional_relationships_keeps_primary_item_roots_without_concept_membership(tmp_path):
    _, taxonomy_base_dir = _make_client(tmp_path)

    payload = resolve_dimensional_relationships(
        taxonomy_base_dir=str(taxonomy_base_dir),
        year="2099",
        href="entry-a.xsd",
        qname="core:PrimaryRootA",
    )

    assert [item["hypercubeName"] for item in payload["hypercubes"]] == ["core:HypercubeForA"]


def test_resolve_dimensional_relationships_dimension_member_selection_does_not_use_concept_hypercubes(tmp_path):
    _, taxonomy_base_dir = _make_client(tmp_path)

    payload = resolve_dimensional_relationships(
        taxonomy_base_dir=str(taxonomy_base_dir),
        year="2099",
        href="entry-a.xsd",
        qname="core:ScenarioMember",
    )

    assert payload["selection"]["concept_type"] == "dimension member"
    assert [item["hypercubeName"] for item in payload["hypercubes"]] == ["core:HypercubeForA"]
    assert payload["hypercubes"][0]["dimensions"][0]["containsSelectedMember"] is True
