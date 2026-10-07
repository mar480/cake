"""Run from backend: python -m taxonomy_pipeline --help."""
import argparse
import json
from pathlib import Path
import sys
import zipfile

from .artifacts import validate_release
from .pipeline import build, export_source, install, package_existing, prepare_all


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build, validate and install immutable taxonomy releases")
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("build", "package-existing"):
        p = commands.add_parser(command)
        p.add_argument("--suite", required=True)
        p.add_argument("--label")
        p.add_argument("--output", type=Path, default=Path(".cache/taxonomy-releases"))
        if command == "build":
            p.add_argument("--package", action="append", required=True, metavar="KIND=ZIP")
            p.add_argument("--dependency", action="append", default=[], metavar="ZIP")
            p.add_argument("--cache", type=Path, help="Read-only, pre-populated Arelle dependency cache")
        else:
            p.add_argument("--base", type=Path, default=Path("taxonomies"))
            p.add_argument("--skip-invalid", action="store_true", help="Report and exclude incomplete legacy entry points")
    p = commands.add_parser("validate")
    p.add_argument("release", type=Path)
    p = commands.add_parser("install")
    p.add_argument("release", type=Path)
    p.add_argument("--target", type=Path, default=Path("taxonomies"))
    p = commands.add_parser("export")
    p.add_argument("release", type=Path)
    p.add_argument("--target", type=Path, default=Path("taxonomies"))
    p.add_argument("--replace", action="store_true", help="Back up and replace existing source inputs")
    p = commands.add_parser("compare")
    p.add_argument("release", type=Path)
    p.add_argument("--base", type=Path, default=Path("taxonomies"))
    p.add_argument("--suite", required=True)
    p = commands.add_parser("prepare-all")
    p.add_argument("--base", type=Path, default=Path("taxonomies"))
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            packages = []
            for value in args.package:
                kind, separator, path = value.partition("=")
                if not separator or kind not in {"uk", "charities", "irish", "lloyds"}:
                    raise ValueError("--package must be uk=ZIP, charities=ZIP, irish=ZIP, or lloyds=ZIP")
                packages.append((kind, path))
            print(build(args.suite, args.label or args.suite, packages, args.dependency, args.output, args.cache))
        elif args.command == "package-existing":
            print(package_existing(args.base, args.suite, args.label or args.suite, args.output, args.skip_invalid))
        elif args.command == "validate":
            print(validate_release(args.release)["revision"])
        elif args.command == "compare":
            from .parity import compare
            report = compare(args.release, args.base, args.suite)
            print(json.dumps(report, indent=2))
            return 0 if report["matches"] else 2
        elif args.command == "install":
            print(install(args.release, args.target))
        elif args.command == "export":
            print(export_source(args.release, args.target, args.replace))
        else:
            prepare_all(args.base)
    except (ValueError, OSError, KeyError, EOFError, zipfile.BadZipFile) as exc:
        print(f"Taxonomy pipeline failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
