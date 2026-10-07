"""Build and install immutable taxonomy releases."""
from __future__ import annotations

import gzip
import importlib.metadata
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from . import VERSION
from .artifacts import (
    NETWORKS, REQUIRED_FILES, canonical_json, contained_path, digest, file_digest,
    identifier, read_json, validate_payloads, validate_release, write_json,
)


def tools_version():
    backend = Path(__file__).parent.parent
    files = [*Path(__file__).parent.glob("*.py"), backend / "services/search_filters.py",
             backend / "services/taxonomy_service.py", backend / "reference_utils.py"]
    return {"extractor": VERSION, "arelle": importlib.metadata.version("arelle-release"),
            "extractor_sha256": digest(canonical_json({p.relative_to(backend).as_posix(): file_digest(p) for p in sorted(files)}))}


def _publish_staging(stage: Path, output: Path) -> Path:
    manifest = validate_release(stage)
    destination = output / manifest["revision"]
    if destination.exists():
        validate_release(destination)
        shutil.rmtree(stage)
    else:
        stage.rename(destination)
    return destination


def package_payloads(suite, label, entries, output, provenance):
    """entries is an iterable of (metadata, payloads) to bound peak memory."""
    identifier(suite)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".staging-", dir=output))
    try:
        manifest = {"format": 1, "suite": suite, "label": label, "tools": tools_version(),
                    "provenance": provenance, "entrypoints": [], "files": []}
        for metadata, payloads in entries:
            validate_payloads(payloads)
            from services.search_filters import build_search_filter_options_from_concepts
            ep = dict(metadata)
            ep["id"] = digest(ep["href"].encode())[:24]
            ep["data_path"] = f"data/{ep['id']}"
            for name in REQUIRED_FILES:
                write_json(stage / ep["data_path"] / f"{name}.json.gz", payloads[name], compressed=True)
            filters = build_search_filter_options_from_concepts(payloads["concepts"])
            ep["filters"] = f"data/{ep['id']}/filters.json"
            write_json(stage / ep["filters"], filters)
            bundle = canonical_json({"status": "loaded", "trees": {
                name + "_tree": payloads[name + "_tree"] for name in NETWORKS
            }, "filterOptions": filters})
            ep["bundle_hash"] = digest(bundle)
            ep["bundle"] = f"browser/{ep['id']}/{ep['bundle_hash']}.json"
            bundle_path = stage / ep["bundle"]
            bundle_path.parent.mkdir(parents=True)
            bundle_path.write_bytes(bundle)
            Path(str(bundle_path) + ".gz").write_bytes(gzip.compress(bundle, compresslevel=6, mtime=0))
            manifest["entrypoints"].append(ep)
        manifest["entrypoints"].sort(key=lambda ep: ep["href"])
        for path in sorted(stage.rglob("*")):
            if path.is_file():
                manifest["files"].append({"path": path.relative_to(stage).as_posix(),
                    "sha256": file_digest(path), "size": path.stat().st_size})
        manifest["revision"] = digest(canonical_json(manifest))
        write_json(stage / "manifest.json", manifest)
        return _publish_staging(stage, output)
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def package_existing(base, suite, label, output, skip_invalid=False):
    from services.taxonomy_service import get_entrypoints_for_year, iter_taxonomy_package_paths
    from services.search_filters import resolve_legacy_tree_dir
    base = Path(base)
    metadata = get_entrypoints_for_year(str(base), suite, legacy=True)
    source_release_path = base / suite / "source-release.json"
    provenance = {"mode": "package-existing", "source_release": read_json(source_release_path) if source_release_path.exists() else None,
                  "unavailable_entrypoints": [], "metadata": [
        {"package": kind, "sha256": file_digest(Path(path))}
        for kind, path in iter_taxonomy_package_paths(str(base), suite)
    ]}
    source_inputs = []
    for ep in metadata:
        try:
            directory = Path(resolve_legacy_tree_dir(str(base), suite, ep["href"]))
            files = [{"name": name, "sha256": file_digest(directory / f"{name}.json")}
                     for name in REQUIRED_FILES]
            source_inputs.append({"href": ep["href"], "files": files})
        except FileNotFoundError as exc:
            source_inputs.append({"href": ep["href"], "missing": str(exc)})
    provenance["fingerprint"] = digest(canonical_json({"suite": suite, "label": label,
        "tools": tools_version(), "metadata": provenance["metadata"], "source_release": provenance["source_release"], "inputs": source_inputs,
        "skip_invalid": skip_invalid}))
    for path in Path(output).glob("*/manifest.json"):
        m = read_json(path)
        if m.get("provenance", {}).get("fingerprint") == provenance["fingerprint"]:
            validate_release(path.parent)
            for unavailable in m["provenance"].get("unavailable_entrypoints", []):
                print(f"Unavailable {suite} / {unavailable['name']}: {unavailable['reason']}", flush=True)
            return path.parent
    def entries():
        for ep in metadata:
            try:
                tree_dir = Path(resolve_legacy_tree_dir(str(base), suite, ep["href"]))
                payloads = {name: read_json(tree_dir / f"{name}.json") for name in REQUIRED_FILES}
                validate_payloads(payloads)
            except (ValueError, FileNotFoundError) as exc:
                if not skip_invalid:
                    raise ValueError(f"{suite} / {ep['name']}: {exc}") from exc
                provenance["unavailable_entrypoints"].append({"href": ep["href"], "name": ep["name"], "reason": str(exc)})
                print(f"Unavailable {suite} / {ep['name']}: {exc}", flush=True)
                continue
            yield ep, payloads
    return package_payloads(suite, label, entries(), output, provenance)


def install(release, target):
    manifest = validate_release(release)
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    # Serialize installers, including catalog read/modify/write, across processes.
    with (target / ".install.lock").open("a+b") as lock:
        if os.name == "nt":
            import msvcrt
            if lock.seek(0, os.SEEK_END) == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX)
        parent = target / "releases" / manifest["suite"]
        parent.mkdir(parents=True, exist_ok=True)
        destination = parent / manifest["revision"]
        if destination.exists():
            validate_release(destination)
        else:
            stage = Path(tempfile.mkdtemp(prefix=".install-", dir=parent))
            try:
                shutil.copytree(release, stage, dirs_exist_ok=True)
                validate_release(stage)
                stage.rename(destination)
            finally:
                if stage.exists():
                    shutil.rmtree(stage)
        catalog_path = target / "catalog.json"
        catalog = read_json(catalog_path) if catalog_path.exists() else {"format": 1, "suites": []}
        suites = [s for s in catalog["suites"] if s["value"] != manifest["suite"]]
        suites.append({"value": manifest["suite"], "label": manifest["label"], "revision": manifest["revision"]})
        catalog["suites"] = sorted(suites, key=lambda s: (not s["value"].startswith("lloyds"),
                                  -int(s["value"]) if s["value"].isdigit() else 0, s["value"]))
        fd, temporary = tempfile.mkstemp(prefix=".catalog-", dir=target)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(canonical_json(catalog))
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, catalog_path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return destination


def extract_zip(source: Path, destination: Path):
    with zipfile.ZipFile(source) as archive:
        size = 0
        for info in archive.infolist():
            contained_path(destination, info.filename)
            size += info.file_size
            if info.file_size > 1024 ** 3 or size > 4 * 1024 ** 3:
                raise ValueError("Taxonomy ZIP exceeds extraction size limit")
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError("Taxonomy ZIP contains a symbolic link")
        archive.extractall(destination)


def export_source(release, target, replace=False):
    """Export reviewable Git inputs so ignored local releases need not be committed."""
    from lxml import etree
    manifest = validate_release(release)
    release, target = Path(release), Path(target)
    target.mkdir(parents=True, exist_ok=True)
    destination = target / manifest["suite"]
    if destination.exists() and not replace:
        raise ValueError(f"{destination} already exists. Use --replace to preserve it in backup/ and replace it.")
    stage = Path(tempfile.mkdtemp(prefix=".export-", dir=target))
    backup = None
    try:
        packages = {}
        for ep in manifest["entrypoints"]:
            # Explicit stable IDs avoid display-name/path ambiguity in exported trees.
            directory = stage / "trees" / ep["id"]
            for name in REQUIRED_FILES:
                write_json(directory / f"{name}.json", read_json(release / ep["data_path"] / f"{name}.json.gz"))
            packages.setdefault(ep["package"], []).append(ep)
        ns = "http://xbrl.org/2016/taxonomy-package"
        mapping = {}
        for kind, eps in packages.items():
            root = etree.Element(f"{{{ns}}}taxonomyPackage", nsmap={None: ns})
            etree.SubElement(root, f"{{{ns}}}name").text = manifest["label"]
            entries = etree.SubElement(root, f"{{{ns}}}entryPoints")
            for ep in eps:
                node = etree.SubElement(entries, f"{{{ns}}}entryPoint")
                etree.SubElement(node, f"{{{ns}}}name").text = ep["name"]
                etree.SubElement(node, f"{{{ns}}}entryPointDocument", href=ep["href"])
                mapping[ep["href"]] = ep["id"]
            package_dir = stage if kind in {"uk", "lloyds"} else stage / kind
            metadata = package_dir / "META-INF" / "taxonomyPackage.xml"
            metadata.parent.mkdir(parents=True, exist_ok=True)
            metadata.write_bytes(etree.tostring(root, xml_declaration=True, encoding="UTF-8"))
        write_json(stage / "tree-mapping.json", mapping)
        write_json(stage / "source-release.json", {"revision": manifest["revision"], "tools": manifest["tools"],
            "provenance": manifest["provenance"], "label": manifest["label"]})
        if destination.exists():
            backup_root = target / "backup"
            backup_root.mkdir(exist_ok=True)
            backup = Path(tempfile.mkdtemp(prefix=manifest["suite"] + "-", dir=backup_root)) / manifest["suite"]
            destination.rename(backup)
        try:
            stage.rename(destination)
        except BaseException:
            if backup:
                backup.rename(destination)
            raise
        return destination
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def source_record(path):
    path = Path(path)
    if path.is_dir():
        return {"name": path.name, "files": [{"path": p.relative_to(path).as_posix(), "sha256": file_digest(p)}
                for p in sorted(path.rglob("*")) if p.is_file()]}
    return {"name": path.name, "sha256": file_digest(path)}


def build(suite, label, packages, dependencies, output, cache=None):
    """Explicit package registration, isolated cache, offline extraction."""
    from arelle import Cntlr, PackageManager
    from .extraction import ConceptDetailsExtractor, extract_hypercubes, extract_dimensions, extract_hypercube_primary_items, export_linkbase_tree
    from .helpers import get_entrypoints_from_package
    from services.taxonomy_service import normalize_entrypoint_label, classify_entrypoint_group
    identifier(suite)
    if not packages or len({kind for kind, _ in packages}) != len(packages):
        raise ValueError("Supply unique named packages (uk, charities, irish, or lloyds)")
    provenance = {"mode": "build", "packages": [{"package": kind, **source_record(path)} for kind, path in packages], "dependencies": [
        source_record(path) for path in dependencies],
        "cache": [{"path": p.relative_to(Path(cache)).as_posix(), "sha256": file_digest(p)}
                  for p in sorted(Path(cache).rglob("*")) if p.is_file()] if cache else [],
        "namespace_policy": "lloyds" if any(kind == "lloyds" for kind, _ in packages) else "standard"}
    fingerprint = digest(canonical_json({"suite": suite, "label": label, "tools": tools_version(), "provenance": provenance}))
    output = Path(output)
    # Reuse only a completely validated build with an identical fingerprint.
    for path in output.glob("*/manifest.json"):
        m = read_json(path)
        if m.get("provenance", {}).get("fingerprint") == fingerprint:
            validate_release(path.parent)
            return path.parent
    provenance["fingerprint"] = fingerprint
    arcroles = (
        "http://www.xbrl.org/2003/arcrole/parent-child",
        "http://xbrl.org/int/dim/arcrole/hypercube-dimension",
        "http://xbrl.org/int/dim/arcrole/dimension-domain",
        "http://xbrl.org/int/dim/arcrole/dimension-default",
        "http://xbrl.org/int/dim/arcrole/domain-member",
        "http://xbrl.org/int/dim/arcrole/all",
        "http://xbrl.frc.org.uk/general/types/arcroles/crossref",
        "http://xbrl.frc.org.uk/general/types/arcroles/inflow",
        "http://xbrl.frc.org.uk/general/types/arcroles/outflow",
    )
    with tempfile.TemporaryDirectory(prefix="taxonomy-build-") as scratch:
        scratch = Path(scratch)
        def as_zip(path):
            path = Path(path).resolve()
            if not path.is_dir():
                return str(path)
            destination = scratch / (digest(str(path).encode())[:12] + ".zip")
            with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                for file in sorted(path.rglob("*")):
                    if file.is_file():
                        archive.write(file, (Path(path.name) / file.relative_to(path)).as_posix())
            return str(destination)
        packages = [(kind, as_zip(path)) for kind, path in packages]
        dependencies = [as_zip(path) for path in dependencies]
        controller = Cntlr.Cntlr(logFileName="logToBuffer", disable_persistent_config=True)
        try:
            controller.webCache.workOffline = True
            controller.webCache.cacheDir = str(scratch / "cache")
            if cache:
                shutil.copytree(cache, scratch / "cache")
            PackageManager.init(controller, loadPackagesConfig=False)
            for package in [*dependencies, *(path for _, path in packages)]:
                # Validate extraction paths even though Arelle reads ZIPs directly.
                extract_zip(Path(package), scratch / "check" / digest(str(package).encode())[:12])
                if not PackageManager.addPackage(controller, str(Path(package).resolve())):
                    raise ValueError(f"Arelle could not register package: {package}")
            PackageManager.rebuildRemappings(controller)
            def entries():
                for kind, source in packages:
                    identifier(kind)
                    extracted = scratch / kind
                    extract_zip(Path(source), extracted)
                    package_xmls = list(extracted.rglob("taxonomyPackage.xml"))
                    if len(package_xmls) != 1:
                        raise ValueError(f"Expected exactly one taxonomyPackage.xml in {source}")
                    for name, href in get_entrypoints_from_package(str(package_xmls[0]), resolve_relative=False):
                        load_href = href
                        if not href.startswith(("http://", "https://")):
                            load_path = (package_xmls[0].parent / href).resolve()
                            if not load_path.is_relative_to(extracted.resolve()):
                                raise ValueError(f"Entry point escapes package: {href}")
                            load_href = str(load_path)
                        model = controller.modelManager.load(load_href)
                        try:
                            if model is None or not model.qnameConcepts or model.errors:
                                errors = getattr(model, "errors", [])
                                raise ValueError(f"Offline load failed for {href}: {errors}. Supply missing dependency ZIPs or --cache.")
                            hints = ("lloyds", "lloyd's") if kind == "lloyds" else ("frc", "xbrl.frc.org.uk", "ifrs", "esma", "xbrl.org/2024/iso3166")
                            payloads = {"concepts": ConceptDetailsExtractor(model, hints).get_all_concept_details(),
                                "hypercubes": extract_hypercubes(model), "dimensions": extract_dimensions(model),
                                "primary_items": extract_hypercube_primary_items(model)}
                            for network, arcrole in zip(NETWORKS, arcroles):
                                path = scratch / f"{network}_tree.json"
                                export_linkbase_tree(model, arcrole, str(path), network)
                                payloads[network + "_tree"] = read_json(path)
                            ep_label = normalize_entrypoint_label(name, kind)
                            yield {"name": name, "label": ep_label, "href": href, "package": kind,
                                   "group": classify_entrypoint_group(kind, ep_label)}, payloads
                        finally:
                            if model is not None:
                                model.close()
            return package_payloads(suite, label, entries(), output, provenance)
        finally:
            controller.close(saveConfig=False)


def prepare_all(base, output=None):
    """Build helper used by both local publishing and the Docker build."""
    from services.taxonomy_service import iter_taxonomy_package_paths
    base = Path(base)
    labels_path = base.parent / "taxonomy-suites.json"
    labels = read_json(labels_path) if labels_path.exists() else {}
    output = Path(output) if output else base.parent / ".cache" / "taxonomy-releases"
    for suite_dir in sorted(base.iterdir()):
        if not suite_dir.is_dir() or not (suite_dir / "trees").is_dir():
            continue
        try:
            iter_taxonomy_package_paths(str(base), suite_dir.name)
        except FileNotFoundError:
            continue
        source_release = suite_dir / "source-release.json"
        exported_label = read_json(source_release).get("label") if source_release.exists() else None
        label = labels.get(suite_dir.name, exported_label or suite_dir.name)
        release = package_existing(base, suite_dir.name, label, output / suite_dir.name, skip_invalid=True)
        install(release, base)
        print(f"Installed {suite_dir.name}: {release.name}", flush=True)
