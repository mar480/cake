"""Shared in-memory app state."""

taxonomy_cache = {}
search_filter_options_cache = {}  # key: "<year>::<entrypoint_name>" -> options payload
