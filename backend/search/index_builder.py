import re
from collections import defaultdict

from .types import IndexedConcept, SearchIndex

# TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
CAMEL_BOUNDARY_PATTERN = re.compile(r"(?<=[a-z])(?=[A-Z])")


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _tokenize(value: str) -> set[str]:
    split_value = CAMEL_BOUNDARY_PATTERN.sub(" ", value or "")
    return set(TOKEN_PATTERN.findall(split_value.lower()))


def _normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
    return None


def _extract_label_texts(entry: dict) -> tuple[str, list[str]]:
    labels = entry.get("labels") or []
    preferred_en = ""
    preferred_fallback = ""
    all_labels: list[str] = []

    for label in labels:
        if not isinstance(label, dict):
            continue

        text = (label.get("label_text") or "").strip()
        if not text:
            continue

        all_labels.append(text)
        label_type = (label.get("type") or "").strip().lower()
        label_lang = (label.get("lang") or "").strip().lower()

        if label_type == "standard label":
            if label_lang == "en" and not preferred_en:
                preferred_en = text
            elif not preferred_fallback:
                preferred_fallback = text

    if preferred_en:
        return preferred_en, all_labels
    if preferred_fallback:
        return preferred_fallback, all_labels
    return (all_labels[0] if all_labels else ""), all_labels


def _build_reference_display(ref: dict) -> str | None:
    source_name = (ref.get("name") or "").strip()
    source_number = (ref.get("number") or "").strip()
    source = f"{source_name} {source_number}".strip()
    paragraph = (ref.get("paragraph") or "").strip()

    if source and paragraph:
        return f"{source}, {paragraph}"
    if source:
        return source
    return None


def build_search_index(concepts: dict) -> SearchIndex:
    concepts_by_qname: dict[str, IndexedConcept] = {}
    token_index: dict[str, set[str]] = defaultdict(set)

    for qname, entry in (concepts or {}).items():
        if not isinstance(entry, dict):
            continue

        concept = entry.get("concept") or {}
        local_name = str(concept.get("local_name") or "")
        label, all_labels = _extract_label_texts(entry)

        reference_sources: set[str] = set()
        reference_paragraphs_by_source: dict[str, set[str]] = {}
        reference_displays: list[str] = []
        for ref in entry.get("references") or []:
            if not isinstance(ref, dict):
                continue
            source_name = (ref.get("name") or "").strip()
            source_number = (ref.get("number") or "").strip()
            source = f"{source_name} {source_number}".strip()
            paragraph = (ref.get("paragraph") or "").strip()

            if not source:
                continue
            reference_sources.add(source)
            reference_paragraphs_by_source.setdefault(source, set())
            if paragraph:
                reference_paragraphs_by_source[source].add(paragraph)
            display = _build_reference_display(ref)
            if display and display not in reference_displays:
                reference_displays.append(display)

        normalized_all_labels = _normalize(" ".join(all_labels))
        local_name_lower = local_name.lower()
        is_commentary = (
            "free-textcomment" in local_name_lower
            or local_name_lower.endswith("textblock")
            or "commentary" in local_name_lower
        )

        indexed = IndexedConcept(
            qname=qname,
            local_name=local_name,
            label=label,
            all_labels=all_labels,
            normalized_qname=_normalize(qname),
            normalized_local_name=_normalize(local_name),
            normalized_label=_normalize(label),
            normalized_all_labels=normalized_all_labels,
            namespace=str(concept.get("namespace") or ""),
            xbrl_type=str(concept.get("xbrl_type") or ""),
            full_type=str(concept.get("full_type") or ""),
            substitution_group=str(concept.get("substitution_group") or ""),
            balance=str(concept.get("balance") or ""),
            period_type=str(concept.get("period_type") or ""),
            abstract=_normalize_bool(concept.get("abstract")),
            nillable=_normalize_bool(concept.get("nillable")),
            reference_sources=reference_sources,
            reference_paragraphs_by_source=reference_paragraphs_by_source,
            reference_displays=reference_displays,
            is_commentary=is_commentary,
        )
        concepts_by_qname[qname] = indexed

        tokens = (
            _tokenize(indexed.normalized_qname)
            | _tokenize(indexed.normalized_local_name)
            | _tokenize(indexed.normalized_label)
            | _tokenize(indexed.normalized_all_labels)
        )

        for token in tokens:
            token_index[token].add(qname)

    return SearchIndex(
        concepts_by_qname=concepts_by_qname, token_index=dict(token_index)
    )
