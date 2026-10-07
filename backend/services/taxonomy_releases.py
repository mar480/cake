"""Resolve immutable releases and negotiate precompressed browser bundles."""
from functools import lru_cache
from pathlib import Path
import re

from flask import g, has_request_context, jsonify, request, send_file
from taxonomy_pipeline.artifacts import canonical_json, contained_path, digest, identifier, read_json


@lru_cache(maxsize=128)
def _cached_json(path, mtime, size):
    return read_json(path)


def metadata(path):
    path = Path(path)
    stat = path.stat()
    return _cached_json(str(path), stat.st_mtime_ns, stat.st_size)


def catalog(base):
    path = Path(base) / "catalog.json"
    if not path.exists():
        raise FileNotFoundError("Taxonomy releases are not prepared. Run python -m taxonomy_pipeline prepare-all from backend.")
    return metadata(path)


def requested_revision():
    return getattr(g, "taxonomy_revision", None) if has_request_context() else None


def release(base, suite, revision=None):
    identifier(suite)
    revision = revision or requested_revision()
    if revision is None:
        path = Path(base) / "catalog.json"
        if not path.exists():
            return None
        revision = next((s["revision"] for s in catalog(base)["suites"] if s["value"] == suite), None)
        if revision is None:
            return None
    if not isinstance(revision, str) or not re.fullmatch(r"[a-f0-9]{64}", revision):
        raise ValueError("Invalid taxonomy revision")
    root = Path(base) / "releases" / suite / revision
    manifest = metadata(root / "manifest.json")
    if manifest["suite"] != suite or manifest["revision"] != revision:
        raise ValueError("Taxonomy release identity mismatch")
    return root, manifest


def entrypoint(base, suite, href, revision=None):
    resolved = release(base, suite, revision)
    if resolved is None:
        return None
    root, manifest = resolved
    ep = next((ep for ep in manifest["entrypoints"] if ep["href"] == href), None)
    if ep is None:
        raise FileNotFoundError("Entry point is not part of this taxonomy release")
    return root, manifest, ep


def register_release_routes(app, base):
    @app.before_request
    def pin_taxonomy_revision():
        if not request.path.startswith("/api/"):
            return None
        payload = request.get_json(silent=True) if request.is_json else None
        revision = request.args.get("revision")
        if isinstance(payload, dict):
            revision = payload.get("revision", revision)
        if revision is not None and (not isinstance(revision, str) or not re.fullmatch(r"[a-f0-9]{64}", revision)):
            return jsonify({"error": "Invalid taxonomy revision"}), 400
        g.taxonomy_revision = revision
        g.taxonomy_base_id = str(Path(base).resolve())
        year = payload.get("year", request.args.get("year")) if isinstance(payload, dict) else request.args.get("year")
        if year:
            try:
                resolved = release(base, year, revision)
                if revision and resolved is None:
                    raise FileNotFoundError("Taxonomy release is unavailable")
                if resolved:
                    g.taxonomy_revision = resolved[1]["revision"]
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400
            except FileNotFoundError:
                return jsonify({"error": "Taxonomy release is unavailable. Reload the entry point to use the current release."}), 404

    def revalidated(payload):
        response = jsonify(payload)
        response.set_etag(digest(canonical_json(payload)))
        response.cache_control.no_cache = True
        return response.make_conditional(request)

    @app.get("/api/taxonomies")
    def list_taxonomy_releases():
        try:
            return revalidated(catalog(base))
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 503

    @app.get("/api/entrypoint-manifest")
    def entrypoint_manifest():
        year, href = request.args.get("year"), request.args.get("href")
        if not year or not href:
            return jsonify({"error": "Missing year or href"}), 400
        try:
            resolved = entrypoint(base, year, href)
            if resolved is None:
                return jsonify({"error": "Taxonomy release is not prepared"}), 503
            _, manifest, ep = resolved
            from urllib.parse import urlencode
            url = "/api/taxonomy-bundles?" + urlencode({"year": year, "revision": manifest["revision"], "entrypoint": ep["id"], "hash": ep["bundle_hash"]})
            return revalidated({"revision": manifest["revision"], "bundleUrl": url})
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 404

    @app.get("/api/taxonomy-bundles")
    def taxonomy_bundle():
        year, revision = request.args.get("year"), request.args.get("revision")
        if not year or not revision:
            return jsonify({"error": "Missing year or revision"}), 400
        try:
            root, manifest = release(base, year, revision)
            ep = next((ep for ep in manifest["entrypoints"] if ep["id"] == request.args.get("entrypoint") and ep["bundle_hash"] == request.args.get("hash")), None)
            if ep is None:
                return jsonify({"error": "Bundle is not part of this release"}), 404
            encodings = request.accept_encodings
            gzip_quality = encodings.quality("gzip") or 0
            identity_quality = encodings.quality("identity") if "identity" in encodings else (0 if "*" in encodings and encodings.quality("*") == 0 else 1)
            compressed = gzip_quality > 0 and gzip_quality >= identity_quality
            if not compressed and identity_quality == 0:
                return jsonify({"error": "No acceptable content encoding"}), 406
            path = contained_path(root, ep["bundle"] + (".gz" if compressed else ""))
            response = send_file(path, mimetype="application/json", conditional=True,
                etag=ep["bundle_hash"] + ("-gzip" if compressed else "-identity"), max_age=31536000)
            response.cache_control.public = True
            response.cache_control.immutable = True
            response.vary.add("Accept-Encoding")
            if compressed:
                response.headers["Content-Encoding"] = "gzip"
            return response
        except FileNotFoundError:
            return jsonify({"error": "Taxonomy release is unavailable. Reload the entry point."}), 404
