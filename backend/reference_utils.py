"""Helpers for normalizing taxonomy reference payloads."""

REFERENCE_DETAIL_KEYS = (
    "name",
    "number",
    "year",
    "schedule",
    "part",
    "section",
    "paragraph",
    "report",
)


def _clean_string(value) -> str:
    return str(value).strip() if value is not None else ""


def build_reference_source(reference: dict) -> str | None:
    """Return the canonical display source for a reference object."""

    explicit_source = _clean_string(reference.get("source"))
    if explicit_source:
        return explicit_source

    name = _clean_string(reference.get("name"))
    number = _clean_string(reference.get("number"))

    key_values = reference.get("reference_key_values")
    if isinstance(key_values, dict):
        name = name or _clean_string(key_values.get("Name") or key_values.get("name"))
        number = number or _clean_string(
            key_values.get("Number") or key_values.get("number")
        )

    source = f"{name} {number}".strip()
    if source:
        return source

    reference_role = _clean_string(reference.get("reference_role"))
    if reference_role and reference_role.lower() != "standard":
        return reference_role

    return None


def normalize_reference(reference: dict) -> dict:
    """Return a copy of a reference containing canonical display fields."""

    if not isinstance(reference, dict):
        return reference

    normalized = dict(reference)
    key_values = normalized.get("reference_key_values")

    if isinstance(key_values, dict):
        for key in REFERENCE_DETAIL_KEYS:
            if normalized.get(key) not in (None, ""):
                continue
            for candidate in (key, key.capitalize()):
                if candidate in key_values:
                    normalized[key] = key_values[candidate]
                    break

    source = build_reference_source(normalized)
    if source:
        normalized["source"] = source

    return normalized


def normalize_concept_references(concept_data: dict) -> dict:
    """Return a copy of concept data with normalized reference objects."""

    if not isinstance(concept_data, dict):
        return concept_data

    references = concept_data.get("references")
    if not isinstance(references, list):
        return concept_data

    normalized = dict(concept_data)
    normalized["references"] = [
        normalize_reference(reference) if isinstance(reference, dict) else reference
        for reference in references
    ]
    return normalized


def normalize_concepts_payload(concepts: dict) -> dict:
    """Return concepts.json payload with each concept's references normalized."""

    if not isinstance(concepts, dict):
        return concepts

    return {
        qname: normalize_concept_references(entry) if isinstance(entry, dict) else entry
        for qname, entry in concepts.items()
    }
