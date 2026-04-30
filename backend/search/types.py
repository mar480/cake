from dataclasses import dataclass
from typing import List, TypedDict


class SearchFilters(TypedDict, total=False):
    namespace: List[str]
    balance: List[str]
    periodType: List[str]
    xbrlType: List[str]
    isDimension: List[bool]
    fullType: List[str]
    abstract: List[bool]
    nillable: List[bool]
    substitutionGroup: List[str]
    referenceSource: str | None
    referenceParagraph: str | List[str] | None


class SearchRequest(TypedDict):
    year: str
    href: str
    q: str
    limit: int
    offset: int
    filters: SearchFilters


class SearchResult(TypedDict):
    qname: str
    label: str
    local_name: str
    balance: str
    period_type: str
    xbrl_type: str
    substitution_group: str
    is_dimension: bool
    reference_displays: List[str]
    score: int
    matched_fields: List[str]
    score_breakdown: dict[str, int]


class SearchResponse(TypedDict):
    results: List[SearchResult]
    total: int
    limit: int
    offset: int


@dataclass(frozen=True)
class IndexedConcept:
    qname: str
    local_name: str
    label: str
    all_labels: List[str]
    normalized_qname: str
    normalized_local_name: str
    normalized_label: str
    normalized_all_labels: str
    namespace: str
    xbrl_type: str
    full_type: str
    substitution_group: str
    balance: str
    period_type: str
    abstract: bool | None
    nillable: bool | None
    reference_sources: set[str]
    reference_paragraphs_by_source: dict[str, set[str]]
    reference_displays: List[str]
    is_commentary: bool


@dataclass(frozen=True)
class SearchIndex:
    concepts_by_qname: dict[str, IndexedConcept]
    token_index: dict[str, set[str]]
