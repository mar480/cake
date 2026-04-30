"""Unified taxonomy tree generator helpers.

This module consolidates the shared workflow that was split between:
- backend/taxonomies/tree_generator.ipynb
- backend/taxonomies/lloyds-2025/lloyds_tree_generator.ipynb

It adds one place to decide whether the uploaded taxonomy should be treated as
Lloyd's or standard FRC, based on the source being processed.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import tempfile
import zipfile
from typing import Iterable

from lxml import etree

TAXONOMY_PACKAGE_NS = {"tp": "http://xbrl.org/2016/taxonomy-package"}
LLOYDS_HINTS = ("lloyds", "lloyd's")
STANDARD_HINTS = ("frc", "xbrl.frc.org.uk")


@dataclass(frozen=True)
class GeneratorSource:
    """Represents the taxonomy input source for tree generation."""

    source_path: str
    is_uploaded_package: bool
    is_lloyds_taxonomy: bool
    package_xml_path: str



def extract_taxonomy_zip(zip_path: str, extract_root: str | None = None) -> str:
    zip_file = Path(zip_path)
    root = Path(extract_root) if extract_root else Path(tempfile.mkdtemp(prefix="taxonomy_pkg_"))
    extract_dir = root / zip_file.stem
    extract_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_file, "r") as zf:
        zf.extractall(extract_dir)

    return str(extract_dir)



def find_taxonomy_package_xml(root_dir: str) -> str:
    root = Path(root_dir)
    candidates = list(root.rglob("taxonomyPackage.xml"))
    if not candidates:
        raise FileNotFoundError(f"No taxonomyPackage.xml found under: {root_dir}")

    meta_inf_candidates = [
        c for c in candidates if any(part.upper() == "META-INF" for part in c.parts)
    ]
    chosen = meta_inf_candidates[0] if meta_inf_candidates else candidates[0]
    return str(chosen.resolve())



def get_entrypoints_from_package(package_xml_path: str) -> list[tuple[str, str]]:
    tree = etree.parse(package_xml_path)
    package_dir = Path(package_xml_path).parent
    entrypoints = tree.xpath("//tp:entryPoint", namespaces=TAXONOMY_PACKAGE_NS)

    resolved: list[tuple[str, str]] = []
    for ep in entrypoints:
        name = ep.findtext("tp:name", namespaces=TAXONOMY_PACKAGE_NS) or "unnamed_entrypoint"
        ep_doc = ep.find("tp:entryPointDocument", namespaces=TAXONOMY_PACKAGE_NS)
        href = ep_doc.get("href") if ep_doc is not None else ""
        if not href:
            continue

        if href.startswith(("http://", "https://")):
            resolved_href = href
        else:
            resolved_href = str((package_dir / href).resolve())

        resolved.append((name, resolved_href))

    return resolved



def _contains_any(value: str, needles: Iterable[str]) -> bool:
    lowered = value.lower()
    return any(needle in lowered for needle in needles)



def detect_lloyds_taxonomy(package_xml_path: str, entrypoints: list[tuple[str, str]]) -> bool:
    searchable = [package_xml_path, *(name for name, _ in entrypoints), *(href for _, href in entrypoints)]
    return any(_contains_any(value, LLOYDS_HINTS) for value in searchable)



def resolve_source(path: str) -> GeneratorSource:
    """Build source metadata for either a folder taxonomy or uploaded ZIP package."""

    path_obj = Path(path)
    if path_obj.is_file() and path_obj.suffix.lower() == ".zip":
        extracted = extract_taxonomy_zip(str(path_obj))
        package_xml = find_taxonomy_package_xml(extracted)
        entrypoints = get_entrypoints_from_package(package_xml)
        is_lloyds = detect_lloyds_taxonomy(package_xml, entrypoints)
        return GeneratorSource(
            source_path=extracted,
            is_uploaded_package=True,
            is_lloyds_taxonomy=is_lloyds,
            package_xml_path=package_xml,
        )

    package_xml = find_taxonomy_package_xml(str(path_obj))
    entrypoints = get_entrypoints_from_package(package_xml)
    is_lloyds = detect_lloyds_taxonomy(package_xml, entrypoints)
    return GeneratorSource(
        source_path=str(path_obj),
        is_uploaded_package=False,
        is_lloyds_taxonomy=is_lloyds,
        package_xml_path=package_xml,
    )



def concept_namespace_allowed(namespace_uri: str, is_lloyds_taxonomy: bool) -> bool:
    """Shared namespace gate from both tree generator variants."""

    if is_lloyds_taxonomy:
        return _contains_any(namespace_uri, LLOYDS_HINTS)
    return _contains_any(namespace_uri, STANDARD_HINTS)



def default_output_root(source: GeneratorSource) -> str:
    source_name = Path(source.source_path).name
    label = "lloyds" if source.is_lloyds_taxonomy else "standard"
    return os.path.join(Path(source.source_path).parent, f"trees_{source_name}_{label}")
