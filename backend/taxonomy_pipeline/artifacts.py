"""Release format shared by the CLI and application (no Arelle dependency)."""
from __future__ import annotations

import gzip
import hashlib
import json
import re
from pathlib import Path

NETWORKS = (
    "presentation", "definition_hydim", "definition_dimdom", "definition_dimdef",
    "definition_dommem", "definition_all", "definition_crossref", "definition_inflow",
    "definition_outflow",
)
SERVER_FILES = ("concepts", "hypercubes", "dimensions", "primary_items")
REQUIRED_FILES = (*SERVER_FILES, *(network + "_tree" for network in NETWORKS))


def identifier(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", value):
        raise ValueError(f"Invalid suite/package identifier: {value!r}")
    return value


def canonical_json(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def contained_path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if Path(relative).is_absolute() or not path.is_relative_to(root.resolve()):
        raise ValueError(f"Artifact path escapes release: {relative}")
    return path


def json_exists(path: str | Path) -> bool:
    p = Path(path)
    return p.is_file() or Path(str(p) + ".gz").is_file()


def read_json(path: str | Path):
    p = Path(path)
    if not p.exists():
        p = Path(str(p) + ".gz")
    opener = gzip.open if p.suffix == ".gz" else open
    with opener(p, "rt", encoding="utf-8") as stream:
        return json.load(stream, parse_constant=lambda value: invalid_constant(value))


def invalid_constant(value):
    raise ValueError(f"Non-finite JSON value: {value}")


def write_json(path: Path, value, compressed=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = canonical_json(value)
    path.write_bytes(gzip.compress(data, compresslevel=6, mtime=0) if compressed else data)


def validate_payloads(payloads):
    missing = set(REQUIRED_FILES) - payloads.keys()
    if missing:
        raise ValueError(f"Missing generated artifacts: {', '.join(sorted(missing))}")
    if not isinstance(payloads["concepts"], dict) or not payloads["concepts"]:
        raise ValueError("concepts.json must contain a nonempty concept map")
    for name in REQUIRED_FILES[1:]:
        if not isinstance(payloads[name], list):
            raise ValueError(f"{name}.json must contain an array")
    for network in NETWORKS:
        for group in payloads[network + "_tree"]:
            if not isinstance(group, dict) or not group.get("elr") or not isinstance(group.get("root_tree"), list):
                raise ValueError(f"Invalid ELR group in {network}")


def validate_release(root: str | Path) -> dict:
    root = Path(root)
    manifest = read_json(root / "manifest.json")
    if manifest.get("format") != 1:
        raise ValueError("Unsupported taxonomy release format")
    identifier(manifest["suite"])
    revision = manifest.get("revision")
    unsigned = {key: value for key, value in manifest.items() if key != "revision"}
    if revision != digest(canonical_json(unsigned)):
        raise ValueError("Release manifest revision does not match its content")
    records = {record["path"]: record for record in manifest["files"]}
    if len(records) != len(manifest["files"]):
        raise ValueError("Duplicate artifact paths")
    for relative, record in records.items():
        path = contained_path(root, relative)
        if path.stat().st_size != record["size"] or file_digest(path) != record["sha256"]:
            raise ValueError(f"Artifact checksum mismatch: {relative}")
    hrefs = set()
    if not manifest["entrypoints"]:
        raise ValueError("Release has no entry points")
    for ep in manifest["entrypoints"]:
        if ep["href"] in hrefs:
            raise ValueError(f"Duplicate entry-point href: {ep['href']}")
        hrefs.add(ep["href"])
        identifier(ep["id"])
        paths = [f"{ep['data_path']}/{name}.json.gz" for name in REQUIRED_FILES]
        paths.extend([ep["bundle"], ep["bundle"] + ".gz", ep["filters"]])
        if any(path not in records for path in paths):
            raise ValueError(f"Incomplete entry-point artifacts: {ep['href']}")
        payloads = {name: read_json(contained_path(root, f"{ep['data_path']}/{name}.json.gz"))
                    for name in REQUIRED_FILES}
        validate_payloads(payloads)
        bundle_path = contained_path(root, ep["bundle"])
        if file_digest(bundle_path) != ep["bundle_hash"]:
            raise ValueError("Browser bundle hash mismatch")
        if gzip.decompress(contained_path(root, ep["bundle"] + ".gz").read_bytes()) != bundle_path.read_bytes():
            raise ValueError("Gzip bundle differs from identity representation")
        bundle = read_json(bundle_path)
        expected_trees = {name + "_tree": payloads[name + "_tree"] for name in NETWORKS}
        if bundle.get("status") != "loaded" or bundle.get("trees") != expected_trees:
            raise ValueError("Browser bundle differs from server tree artifacts")
        from services.search_filters import build_search_filter_options_from_concepts
        expected_filters = build_search_filter_options_from_concepts(payloads["concepts"])
        if bundle.get("filterOptions") != expected_filters or read_json(root / ep["filters"]) != expected_filters:
            raise ValueError("Search filters differ from concept artifacts")
    return manifest
