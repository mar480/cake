"""Shared in-memory app state."""

from threading import RLock


taxonomy_cache = {
    "active": None,
    "is_loading": False,
    "active_search_filter_options_key": None,
}
taxonomy_lock = RLock()
search_filter_options_cache = {}  # key: "<year>::<entrypoint_name>" -> options payload
