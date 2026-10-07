"""Compare a candidate extraction with legacy outputs without installing it."""
from pathlib import Path
from .artifacts import REQUIRED_FILES, read_json, validate_release


def semantic(value):
    if isinstance(value, dict):
        return {key: semantic(item) for key, item in value.items() if key not in {'uuid', 'tree_id'}}
    if isinstance(value, list):
        return [semantic(item) for item in value]
    return value


def compare(release, base, suite):
    from services.search_filters import resolve_legacy_tree_dir
    release = Path(release)
    manifest = validate_release(release)
    report = []
    for ep in manifest['entrypoints']:
        folder = Path(resolve_legacy_tree_dir(str(base), suite, ep['href']))
        differences = []
        for name in REQUIRED_FILES:
            existing = read_json(folder / f'{name}.json')
            candidate = read_json(release / ep['data_path'] / f'{name}.json.gz')
            if semantic(existing) != semantic(candidate):
                differences.append(name)
        report.append({'name': ep['name'], 'href': ep['href'], 'differences': differences})
    return {'revision': manifest['revision'], 'suite': suite, 'entrypoints': report,
            'matches': all(not ep['differences'] for ep in report)}
