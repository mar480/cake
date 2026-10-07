"""Pure helpers shared by extraction and package metadata readers."""
from pathlib import Path
import re
from typing import Any

TAXONOMY_PACKAGE_NS = {"tp": "http://xbrl.org/2016/taxonomy-package"}
STANDARD_HINTS = ("frc", "xbrl.frc.org.uk", "ifrs", "esma", "xbrl.org/2024/iso3166")
LLOYDS_HINTS = ("lloyds", "lloyd's")


def concept_namespace_allowed(namespace_uri: str, is_lloyds_taxonomy: bool) -> bool:
    hints = LLOYDS_HINTS if is_lloyds_taxonomy else STANDARD_HINTS
    return any(hint in namespace_uri.lower() for hint in hints)


def extract_elr_numeric_part(definition: str | None) -> int | None:
    """Return the first number in an ELR definition, if it has one."""

    match = re.search(r"(\d+)", definition or "")
    return int(match.group(1)) if match else None


def elr_sort_key(elr_data: dict[str, Any]) -> tuple[bool, int, str, str]:
    """Sort numbered ELRs first, followed by unnumbered ELRs alphabetically."""

    numeric_part = elr_data.get("numeric_part")
    if numeric_part is None:
        numeric_part = elr_data.get("elr_id")
    return (
        numeric_part is None,
        numeric_part if numeric_part is not None else 0,
        str(elr_data.get("definition") or "").casefold(),
        str(elr_data.get("elr") or "").casefold(),
    )


def get_entrypoints_from_package(package_xml_path: str, resolve_relative: bool = True) -> list[tuple[str, str]]:
    from lxml import etree

    tree = etree.parse(package_xml_path, etree.XMLParser(resolve_entities=False, no_network=True))
    package_dir = Path(package_xml_path).parent
    entrypoints = tree.xpath("//tp:entryPoint", namespaces=TAXONOMY_PACKAGE_NS)

    resolved: list[tuple[str, str]] = []
    for ep in entrypoints:
        name = ep.findtext("tp:name", namespaces=TAXONOMY_PACKAGE_NS) or "unnamed_entrypoint"
        documents = ep.findall("tp:entryPointDocument", namespaces=TAXONOMY_PACKAGE_NS)
        if len(documents) != 1:
            raise ValueError(f"Entry point {name} must declare exactly one entryPointDocument")
        ep_doc = documents[0]
        href = ep_doc.get("href") if ep_doc is not None else ""
        if not href:
            continue

        if not resolve_relative or href.startswith(("http://", "https://")):
            resolved_href = href
        else:
            resolved_href = str((package_dir / href).resolve())

        resolved.append((name, resolved_href))

    return resolved



