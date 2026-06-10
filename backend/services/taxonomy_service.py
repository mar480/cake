import os
import re
from urllib.parse import unquote, urlparse

from lxml import etree

from xbrl.loader import TaxonomyContext

TAXONOMY_PACKAGE_NS = {"tp": "http://xbrl.org/2016/taxonomy-package"}
ENTRYPOINT_GROUP_ORDER = {
    "UK Accounting Standards": 0,
    "ROI Accounting Standards": 1,
    "HMRC only": 2,
    "Companies House forms": 3,
    "Charities SORP": 4,
    "UKSEF dual filing approach": 5,
    "Taxonomy views": 6,
}
ENTRYPOINT_ITEM_ORDER = {
    "FRS 102": 0,
    "FRS 101": 1,
    "IFRS": 2,
    "EU IFRS": 2,
    "DPL": 0,
    "CIC 34": 0,
    "DSEP AA06": 1,
    "DSEP Agreement": 2,
    "Charities": 0,
    "FRS 102 UKSEF": 0,
    "IFRS UKSEF": 1,
    "Core Full": 0,
    "Core": 1,
}


def is_lloyds_year_key(year: str) -> bool:
    return isinstance(year, str) and year.lower().startswith("lloyds")


def is_http_href(href: str) -> bool:
    return isinstance(href, str) and href.startswith(("http://", "https://"))


def iter_taxonomy_package_paths(taxonomy_base_dir: str, year: str) -> list[tuple[str, str]]:
    year_root = os.path.join(taxonomy_base_dir, year)
    if not os.path.isdir(year_root):
        raise FileNotFoundError(f"Year root not found: {year_root}")

    package_paths: list[tuple[str, str]] = []
    candidates = [
        ("uk", os.path.join(year_root, "META-INF", "taxonomyPackage.xml")),
        ("charities", os.path.join(year_root, "charities", "META-INF", "taxonomyPackage.xml")),
        ("irish", os.path.join(year_root, "irish", "META-INF", "taxonomyPackage.xml")),
    ]
    for package_type, package_path in candidates:
        if os.path.exists(package_path):
            package_paths.append((package_type, package_path))

    if not package_paths:
        raise FileNotFoundError(f"taxonomyPackage.xml not found for year {year}")

    return package_paths


def normalize_entrypoint_label(name: str, package_type: str) -> str:
    normalized = (name or "").strip()
    replacements = {
        "FRS-102": "FRS 102",
        "FRS-101": "FRS 101",
        "FRS-102-UKSEF": "FRS 102 UKSEF",
        "IFRS-UKSEF": "IFRS UKSEF",
        "CIC-34": "CIC 34",
        "DSEP-AA06": "DSEP AA06",
        "DSEP-Agreement": "DSEP Agreement",
    }
    normalized = replacements.get(normalized, normalized)

    if package_type == "charities":
        return "Charities extension"

    if package_type == "irish":
        normalized = re.sub(r"\s+\(Irish Extension \d{4}\)$", "", normalized)
        return f"{normalized} - Irish"

    return normalized


def classify_entrypoint_group(package_type: str, label: str) -> str | None:
    if package_type == "charities":
        return "Charities SORP"
    if package_type == "irish":
        return "ROI Accounting Standards"
    if label in {"FRS 102", "FRS 101", "IFRS"}:
        return "UK Accounting Standards"
    if label == "DPL":
        return "HMRC only"
    if label in {"CIC 34", "DSEP AA06", "DSEP Agreement"}:
        return "Companies House forms"
    if label in {"FRS 102 UKSEF", "IFRS UKSEF"}:
        return "UKSEF dual filing approach"
    if label in {"Core Full", "Core"}:
        return "Taxonomy views"
    return None


def find_local_entrypoint_from_href(taxonomy_base_dir: str, year: str, href: str) -> str:
    """
    Resolve a remote entrypoint URL to a local file inside backend/taxonomies/<year>.
    Strategy:
      1) filename exact match
      2) URL path suffix match
    """
    year_root = os.path.join(taxonomy_base_dir, year)
    if not os.path.isdir(year_root):
        raise FileNotFoundError(f"Year root not found: {year_root}")

    parsed = urlparse(href)
    remote_path = unquote(parsed.path).lstrip(
        "/"
    )  # e.g. lloyds/2025-.../lloyds-2025-...xsd
    base_name = os.path.basename(remote_path)

    file_paths = []
    for root, _, files in os.walk(year_root):
        for f in files:
            file_paths.append(os.path.join(root, f))

    # 1) Exact filename matches
    name_matches = [p for p in file_paths if os.path.basename(p) == base_name]
    if len(name_matches) == 1:
        return name_matches[0]
    if len(name_matches) > 1:
        name_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return name_matches[0]

    # 2) Path suffix match
    remote_suffix = remote_path.replace("\\", "/")
    suffix_matches = [
        p for p in file_paths if p.replace("\\", "/").endswith(remote_suffix)
    ]
    if len(suffix_matches) == 1:
        return suffix_matches[0]
    if len(suffix_matches) > 1:
        suffix_matches.sort(key=lambda p: (len(p.split(os.sep)), len(p)))
        return suffix_matches[0]

    raise FileNotFoundError(
        f"Could not map href to local file for year='{year}': {href}"
    )


def safe_close_taxonomy(taxonomy_obj):
    if taxonomy_obj is None:
        return
    try:
        taxonomy_obj.controller.close()
    except Exception:
        pass


def load_taxonomy_with_lloyds_fallback(taxonomy_base_dir: str, year: str, href: str):
    """
    Primary: load href as-is.
    Fallback (Lloyds only): if remote load appears empty/forbidden, resolve local file and reload.
    """
    print(f"[taxonomy-load] Attempt primary load: {href}")
    primary = TaxonomyContext(href)
    primary_count = len(getattr(primary.model, "qnameConcepts", {}))
    print(f"[taxonomy-load] Primary qnameConcepts count={primary_count}")

    # Apply fallback only for Lloyds-style keys and only for remote hrefs with empty model
    if is_lloyds_year_key(year) and is_http_href(href) and primary_count == 0:
        print(
            "[taxonomy-load] Lloyds fallback triggered (empty model after remote load)"
        )
        safe_close_taxonomy(primary)

        local_entrypoint = find_local_entrypoint_from_href(taxonomy_base_dir, year, href)
        print(f"[taxonomy-load] Local fallback entrypoint: {local_entrypoint}")

        fallback = TaxonomyContext(local_entrypoint)
        fallback_count = len(getattr(fallback.model, "qnameConcepts", {}))
        print(f"[taxonomy-load] Fallback qnameConcepts count={fallback_count}")

        if fallback_count == 0:
            safe_close_taxonomy(fallback)
            raise RuntimeError(
                f"Local fallback loaded but model still empty for {local_entrypoint}"
            )

        return fallback

    # Not fallback case, or primary load succeeded
    if primary_count == 0:
        print(
            "[taxonomy-load] Warning: model empty after primary load (fallback not applied)"
        )
    return primary


def get_entrypoints_for_year(taxonomy_base_dir: str, year: str):
    result = []
    for package_type, package_path in iter_taxonomy_package_paths(taxonomy_base_dir, year):
        tree = etree.parse(package_path)
        entrypoints = tree.xpath("//tp:entryPoint", namespaces=TAXONOMY_PACKAGE_NS)
        for ep in entrypoints:
            name = ep.findtext("tp:name", namespaces=TAXONOMY_PACKAGE_NS)
            ep_doc = ep.find("tp:entryPointDocument", namespaces=TAXONOMY_PACKAGE_NS)
            href = ep_doc.get("href") if ep_doc is not None else ""
            if not (name and href):
                continue

            label = normalize_entrypoint_label(name, package_type)
            group = classify_entrypoint_group(package_type, label)
            result.append(
                {
                    "name": name,
                    "label": label,
                    "href": href,
                    "group": group,
                    "package": package_type,
                }
            )

    result.sort(
        key=lambda entry: (
            ENTRYPOINT_GROUP_ORDER.get(entry.get("group") or "", 999),
            ENTRYPOINT_ITEM_ORDER.get(entry.get("label") or "", 999),
            entry.get("label") or entry.get("name") or "",
        )
    )
    return result
