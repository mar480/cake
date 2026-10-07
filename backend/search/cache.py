"""Bounded per-worker search cache; concurrent misses share one construction."""
from collections import OrderedDict
from concurrent.futures import Future
import os
from threading import RLock
from .types import SearchIndex

_search_index_cache = OrderedDict()
_in_flight = {}
_lock = RLock()
MAX_INDEXES = max(1, int(os.environ.get("TAXONOMY_SEARCH_CACHE_SIZE", "8")))


def get_search_index(cache_key: str) -> SearchIndex | None:
    with _lock:
        value = _search_index_cache.get(cache_key)
        if value is not None:
            _search_index_cache.move_to_end(cache_key)
        return value


def set_search_index(cache_key: str, index: SearchIndex) -> None:
    with _lock:
        _search_index_cache[cache_key] = index
        _search_index_cache.move_to_end(cache_key)
        while len(_search_index_cache) > MAX_INDEXES:
            _search_index_cache.popitem(last=False)


def get_or_build_search_index(cache_key, build):
    with _lock:
        index = get_search_index(cache_key)
        if index is not None:
            return index
        future = _in_flight.get(cache_key)
        owner = future is None
        if owner:
            future = _in_flight[cache_key] = Future()
    if not owner:
        return future.result()
    try:
        index = build()
        set_search_index(cache_key, index)
        future.set_result(index)
        return index
    except BaseException as exc:
        future.set_exception(exc)
        raise
    finally:
        with _lock:
            _in_flight.pop(cache_key, None)


def clear_search_index(cache_key: str) -> None:
    with _lock:
        _search_index_cache.pop(cache_key, None)
