import os
from urllib.parse import unquote, urlparse

from lxml import etree

from xbrl.loader import TaxonomyContext


def is_lloyds_year_key(year: str) -> bool:
    return isinstance(year, str) and year.lower().startswith("lloyds")


def is_http_href(href: str) -> bool:
    return isinstance(href, str) and href.startswith(("http://", "https://"))


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
    package_path = os.path.join(
        taxonomy_base_dir, year, "META-INF", "taxonomyPackage.xml"
    )
    if not os.path.exists(package_path):
        raise FileNotFoundError(f"taxonomyPackage.xml not found for year {year}")

    ns = {"tp": "http://xbrl.org/2016/taxonomy-package"}
    tree = etree.parse(package_path)
    entrypoints = tree.xpath("//tp:entryPoint", namespaces=ns)
    result = []
    for ep in entrypoints:
        name = ep.findtext("tp:name", namespaces=ns)
        ep_doc = ep.find("tp:entryPointDocument", namespaces=ns)
        href = ep_doc.get("href") if ep_doc is not None else ""
        if name and href:
            result.append({"name": name, "href": href})
    return result
