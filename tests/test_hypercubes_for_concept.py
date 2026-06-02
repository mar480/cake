import json
import sys
from pathlib import Path

import pytest
from flask import Flask

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routes.api_routes import register_api_routes
from services.search_filters import load_cached_concepts_json_for_entrypoint
from state import taxonomy_cache


@pytest.fixture(autouse=True)
def _clear_global_taxonomy_state():
    taxonomy_cache["active"] = {"should_not_be_used": True}
    yield
    taxonomy_cache["active"] = None


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
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint A" / "concepts.json",
        {
            "core:Revenue": {
                "concept": {"qname": "core:Revenue"},
                "hypercubes": ["core:HypercubeForA"],
                "references": [
                    {
                        "reference_key_values": {
                            "Name": "ICAEW AFF 03/06",
                            "Paragraph": "50-59",
                        },
                        "name": "ICAEW AFF 03/06",
                        "paragraph": "50-59",
                    }
                ],
            }
        },
    )
    _write_json(
        taxonomy_base_dir / "2099" / "trees" / "Entrypoint B" / "concepts.json",
        {
            "core:Revenue": {
                "concept": {"qname": "core:Revenue"},
                "hypercubes": ["core:HypercubeForB"],
            }
        },
    )

    load_cached_concepts_json_for_entrypoint.cache_clear()
    app = Flask(__name__)
    register_api_routes(app, str(taxonomy_base_dir))
    return app.test_client()


def test_hypercube_lookup_is_entrypoint_scoped_after_another_entrypoint_lookup(tmp_path):
    client = _make_client(tmp_path)

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
    client = _make_client(tmp_path)

    response = client.post(
        "/api/hypercubes-for-concept",
        json={"year": "2099", "href": "entry-a.xsd"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"error": "Missing year, href, or qname"}


def test_concept_details_normalizes_reference_source_for_existing_payload(tmp_path):
    client = _make_client(tmp_path)

    response = client.get(
        "/api/concept-details",
        query_string={
            "year": "2099",
            "href": "entry-a.xsd",
            "qname": "core:Revenue",
        },
    )

    assert response.status_code == 200
    reference = response.get_json()["references"][0]
    assert reference["source"] == "ICAEW AFF 03/06"
    assert reference["paragraph"] == "50-59"
