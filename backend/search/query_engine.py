import re

from .types import SearchFilters, SearchIndex, SearchResponse, SearchResult

# TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
CAMEL_BOUNDARY_PATTERN = re.compile(r"(?<=[a-z])(?=[A-Z])")


def _tokenize(value: str) -> list[str]:
    split_value = CAMEL_BOUNDARY_PATTERN.sub(" ", (value or "").strip())
    return TOKEN_PATTERN.findall(split_value.lower())


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


def _matches_list_filter(field_value: str, allowed: list[str]) -> bool:
    if not allowed:
        return True
    return field_value in allowed


def _matches_filters(concept, filters: SearchFilters | None) -> bool:
    if not filters:
        return True

    if not _matches_list_filter(concept.namespace, filters.get("namespace", [])):
        return False
    if not _matches_list_filter(concept.balance, filters.get("balance", [])):
        return False
    if not _matches_list_filter(concept.period_type, filters.get("periodType", [])):
        return False
    if not _matches_list_filter(concept.xbrl_type, filters.get("xbrlType", [])):
        return False
    is_dimension_allowed = [_normalize_bool(v) for v in filters.get("isDimension", [])]
    is_dimension_allowed = [v for v in is_dimension_allowed if v is not None]
    concept_is_dimension = concept.substitution_group == "xbrldt:dimensionItem"
    if is_dimension_allowed and concept_is_dimension not in is_dimension_allowed:
        return False
    if not _matches_list_filter(concept.full_type, filters.get("fullType", [])):
        return False
    if not _matches_list_filter(
        concept.substitution_group, filters.get("substitutionGroup", [])
    ):
        return False

    abstract_allowed = [_normalize_bool(v) for v in filters.get("abstract", [])]
    abstract_allowed = [v for v in abstract_allowed if v is not None]
    if abstract_allowed and concept.abstract not in abstract_allowed:
        return False

    nillable_allowed = [_normalize_bool(v) for v in filters.get("nillable", [])]
    nillable_allowed = [v for v in nillable_allowed if v is not None]
    if nillable_allowed and concept.nillable not in nillable_allowed:
        return False

    source = (filters.get("referenceSource") or "").strip()
    paragraph_filter = filters.get("referenceParagraph")
    paragraphs: list[str] = []
    if isinstance(paragraph_filter, str):
        p = paragraph_filter.strip()
        if p:
            paragraphs = [p]
    elif isinstance(paragraph_filter, list):
        paragraphs = [str(p).strip() for p in paragraph_filter if str(p).strip()]

    if source:
        if source not in concept.reference_sources:
            return False
        if paragraphs:
            source_paragraphs = concept.reference_paragraphs_by_source.get(
                source, set()
            )
            if not any(paragraph in source_paragraphs for paragraph in paragraphs):
                return False

    return True


def _score_match(
    normalized_query: str, q_tokens: list[str], concept
) -> tuple[int, list[str], dict[str, int]]:
    score = 0
    matched_fields: list[str] = []
    score_breakdown: dict[str, int] = {}

    field_values = [
        ("qname", concept.normalized_qname),
        ("local_name", concept.normalized_local_name),
        ("label", concept.normalized_label),
    ]

    for field_name, field_value in field_values:
        if not field_value:
            continue

        field_score = 0
        if normalized_query and normalized_query == field_value:
            field_score += 10
            score_breakdown[f"{field_name}_exact"] = 10
        elif normalized_query and field_value.startswith(normalized_query):
            field_score += 7
            score_breakdown[f"{field_name}_prefix"] = 7
        elif normalized_query and normalized_query in field_value:
            field_score += 4
            score_breakdown[f"{field_name}_substring"] = 4

        token_source = field_value
        if field_name == "label":
            token_source = concept.normalized_all_labels or concept.normalized_label

        matched_tokens = [
            token for token in q_tokens if token and token in token_source
        ]
        if matched_tokens:
            token_score = len(set(matched_tokens))
            field_score += token_score
            score_breakdown[f"{field_name}_tokens"] = token_score

        if field_score > 0:
            score += field_score
            matched_fields.append(field_name)

    if concept.is_commentary and score > 0:
        score -= 2
        score_breakdown["commentary_penalty"] = -2

    return score, matched_fields, score_breakdown


def search_index(
    index: SearchIndex,
    query: str,
    limit: int,
    offset: int,
    filters: SearchFilters | None = None,
) -> SearchResponse:
    normalized_query = (query or "").strip().lower()
    q_tokens = _tokenize(normalized_query)

    if normalized_query:
        candidate_qnames = set()
        for token in q_tokens:
            candidate_qnames.update(index.token_index.get(token, set()))
        if normalized_query and len(normalized_query) > 2:
            for qname, concept in index.concepts_by_qname.items():
                if (
                    normalized_query in concept.normalized_qname
                    or normalized_query in concept.normalized_local_name
                ):
                    candidate_qnames.add(qname)
        if not candidate_qnames:
            candidate_qnames = set(index.concepts_by_qname.keys())
    else:
        candidate_qnames = set(index.concepts_by_qname.keys())

    scored: list[tuple[int, str, SearchResult]] = []

    for qname in candidate_qnames:
        concept = index.concepts_by_qname.get(qname)
        if concept is None:
            continue

        if not _matches_filters(concept, filters):
            continue

        score, matched_fields, score_breakdown = _score_match(
            normalized_query, q_tokens, concept
        )

        if normalized_query and score <= 0:
            continue

        result: SearchResult = {
            "qname": concept.qname,
            "label": concept.label,
            "local_name": concept.local_name,
            "balance": concept.balance,
            "period_type": concept.period_type,
            "xbrl_type": concept.xbrl_type,
            "substitution_group": concept.substitution_group,
            "is_dimension": concept.substitution_group == "xbrldt:dimensionItem",
            "score": score,
            "matched_fields": matched_fields,
            "score_breakdown": score_breakdown,
        }
        scored.append((score, concept.qname, result))

    scored.sort(key=lambda item: (-item[0], item[1]))

    total = len(scored)
    paged = [item[2] for item in scored[offset : offset + limit]]

    return {
        "results": paged,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
