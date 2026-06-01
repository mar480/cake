from .types import SearchIndex

# Search indexes are intentionally keyed by entrypoint_cache_key(year, href).
# Never store user-facing search indexes under a process-global active key: multiple
# users can search different entrypoints in the same backend process.
_search_index_cache: dict[str, SearchIndex] = {}


def get_search_index(cache_key: str) -> SearchIndex | None:
    return _search_index_cache.get(cache_key)


def set_search_index(cache_key: str, index: SearchIndex) -> None:
    _search_index_cache[cache_key] = index


def clear_search_index(cache_key: str) -> None:
    _search_index_cache.pop(cache_key, None)
