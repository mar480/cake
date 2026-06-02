import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from reference_utils import (
    build_reference_source,
    normalize_concepts_payload,
    normalize_reference,
)


def test_normalize_reference_adds_source_from_name_when_number_absent():
    reference = normalize_reference(
        {
            "name": "ICAEW AFF 03/06",
            "paragraph": "50-59",
            "reference_key_values": {
                "Name": "ICAEW AFF 03/06",
                "Paragraph": "50-59",
            },
        }
    )

    assert reference["source"] == "ICAEW AFF 03/06"
    assert reference["name"] == "ICAEW AFF 03/06"
    assert reference["paragraph"] == "50-59"


def test_normalize_reference_adds_source_from_name_and_number():
    reference = normalize_reference(
        {
            "reference_key_values": {
                "Name": "SI",
                "Number": "489",
                "Paragraph": "5.4",
            }
        }
    )

    assert reference["source"] == "SI 489"
    assert reference["name"] == "SI"
    assert reference["number"] == "489"
    assert reference["paragraph"] == "5.4"


def test_build_reference_source_falls_back_to_legacy_reference_role():
    assert build_reference_source({"reference_role": "ICAEW AFF 03/06"}) == "ICAEW AFF 03/06"


def test_normalize_concepts_payload_updates_existing_generated_references():
    payload = {
        "test:Concept": {
            "references": [
                {
                    "reference_key_values": {
                        "Name": "FRS",
                        "Number": "102",
                    },
                    "name": "FRS",
                    "number": "102",
                }
            ]
        }
    }

    normalized = normalize_concepts_payload(payload)

    assert normalized["test:Concept"]["references"][0]["source"] == "FRS 102"


if __name__ == "__main__":
    test_normalize_reference_adds_source_from_name_when_number_absent()
    test_normalize_reference_adds_source_from_name_and_number()
    test_build_reference_source_falls_back_to_legacy_reference_role()
    test_normalize_concepts_payload_updates_existing_generated_references()
