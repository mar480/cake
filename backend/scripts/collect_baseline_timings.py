#!/usr/bin/env python3
import argparse
import datetime as dt
from pathlib import Path
import re
import sys
import time

import pandas as pd
import requests

LOAD_ARELLE_RE = re.compile(r"\[load-entrypoint\] arelle_load_ms=(\d+(?:\.\d+)?)")
LOAD_TOTAL_RE = re.compile(r"\[load-entrypoint\] total_request_ms=(\d+(?:\.\d+)?)")
RESOLVE_RE = re.compile(
    r"\[taxonomy-load\] local resolution method=([a-zA-Z0-9_\- ]+) elapsed_ms=(\d+(?:\.\d+)?)"
)
CONCEPT_LOOKUP_RE = re.compile(r"\[concept-details\] concept_lookup_ms=(\d+(?:\.\d+)?)")
CONCEPT_TOTAL_RE = re.compile(r"\[concept-details\] total_request_ms=(\d+(?:\.\d+)?)")
DIMENSIONAL_TOTAL_RE = re.compile(r"\[dimensional-load\] total_request_ms=(\d+(?:\.\d+)?)")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://localhost:5000")
    p.add_argument("--year", required=True)
    p.add_argument("--href", action="append", required=True)
    p.add_argument("--iterations", type=int, default=10)
    p.add_argument("--sleep-ms", type=int, default=100)
    p.add_argument("--out-csv", default="baseline_timings.csv")
    p.add_argument("--include-concept-details", action="store_true")
    p.add_argument("--qname", action="append", default=[])
    p.add_argument(
        "--log-file",
        default=None,
        help="Backend log file path. If omitted, defaults to <out-csv>.log",
    )
    return p.parse_args()


def ensure_log_file(args) -> Path:
    if not args.log_file:
        args.log_file = str(Path(args.out_csv).with_suffix(".log"))

    log_path = Path(args.log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.write_text("", encoding="utf-8")
        print(f"[collect-baseline] created empty log file: {log_path}")
    return log_path


def read_new_log_lines(log_file: Path, offset: int):
    with log_file.open("r", encoding="utf-8", errors="replace") as fh:
        fh.seek(offset)
        chunk = fh.read()
        new_offset = fh.tell()
    return chunk.splitlines(), new_offset


def extract_metrics(lines):
    metrics = {
        "arelle_load_ms": None,
        "total_request_ms": None,
        "local_resolution_elapsed_ms": None,
        "local_resolution_method": None,
        "concept_lookup_ms": None,
        "dimensional_total_ms": None,
        "raw_log_line": None,
    }

    for line in lines:
        m = LOAD_ARELLE_RE.search(line)
        if m:
            metrics["arelle_load_ms"] = float(m.group(1))
            metrics["raw_log_line"] = line

        m = LOAD_TOTAL_RE.search(line)
        if m:
            metrics["total_request_ms"] = float(m.group(1))
            metrics["raw_log_line"] = line

        m = RESOLVE_RE.search(line)
        if m:
            metrics["local_resolution_method"] = m.group(1)
            metrics["local_resolution_elapsed_ms"] = float(m.group(2))
            metrics["raw_log_line"] = line

        m = CONCEPT_LOOKUP_RE.search(line)
        if m:
            metrics["concept_lookup_ms"] = float(m.group(1))
            metrics["raw_log_line"] = line

        m = CONCEPT_TOTAL_RE.search(line)
        if m:
            metrics["total_request_ms"] = float(m.group(1))
            metrics["raw_log_line"] = line

        m = DIMENSIONAL_TOTAL_RE.search(line)
        if m:
            metrics["dimensional_total_ms"] = float(m.group(1))
            metrics["raw_log_line"] = line

    return metrics


def merge_metrics_from_response(metrics, payload, endpoint):
    if not isinstance(payload, dict):
        return metrics
    timings = payload.get("timings_ms")
    if not isinstance(timings, dict):
        return metrics

    if endpoint == "load-entrypoint":
        metrics["arelle_load_ms"] = timings.get(
            "arelle_load_ms", metrics["arelle_load_ms"]
        )
    if endpoint == "concept-details":
        metrics["concept_lookup_ms"] = timings.get(
            "concept_lookup_ms", metrics["concept_lookup_ms"]
        )
    metrics["total_request_ms"] = timings.get(
        "total_request_ms", metrics["total_request_ms"]
    )
    return metrics


def main():
    args = parse_args()
    if args.include_concept_details and not args.qname:
        print("--include-concept-details requires at least one --qname", file=sys.stderr)
        sys.exit(2)

    log_path = ensure_log_file(args)
    log_offset = log_path.stat().st_size

    session = requests.Session()
    records = []

    for iteration in range(1, args.iterations + 1):
        for href in args.href:
            before = log_offset
            resp = session.post(
                f"{args.base_url}/api/load-entrypoint",
                json={"year": args.year, "href": href},
                timeout=60,
            )
            lines, log_offset = read_new_log_lines(log_path, before)
            metrics = extract_metrics(lines)
            try:
                metrics = merge_metrics_from_response(
                    metrics, resp.json(), "load-entrypoint"
                )
            except ValueError:
                pass
            records.append(
                {
                    "captured_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "iteration": iteration,
                    "endpoint": "load-entrypoint",
                    "year": args.year,
                    "href": href,
                    "qname": None,
                    "status_code": resp.status_code,
                    **metrics,
                }
            )
            time.sleep(args.sleep_ms / 1000)

            if args.include_concept_details:
                for qname in args.qname:
                    before = log_offset
                    cresp = session.get(
                        f"{args.base_url}/api/concept-details",
                        params={"qname": qname},
                        timeout=60,
                    )
                    lines, log_offset = read_new_log_lines(log_path, before)
                    metrics = extract_metrics(lines)
                    try:
                        metrics = merge_metrics_from_response(
                            metrics, cresp.json(), "concept-details"
                        )
                    except ValueError:
                        pass
                    records.append(
                        {
                            "captured_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
                            "iteration": iteration,
                            "endpoint": "concept-details",
                            "year": args.year,
                            "href": href,
                            "qname": qname,
                            "status_code": cresp.status_code,
                            **metrics,
                        }
                    )
                    time.sleep(args.sleep_ms / 1000)

    df = pd.DataFrame(records).reindex(
        columns=[
            "captured_at_utc",
            "iteration",
            "endpoint",
            "year",
            "href",
            "qname",
            "status_code",
            "arelle_load_ms",
            "total_request_ms",
            "local_resolution_elapsed_ms",
            "local_resolution_method",
            "concept_lookup_ms",
            "dimensional_total_ms",
            "raw_log_line",
        ]
    )
    df.to_csv(args.out_csv, index=False)
    print(f"Saved {len(df)} rows to {args.out_csv}")
    print(f"Parsed logs from: {log_path}")

    print("\nSummary by endpoint")
    print(
        df.groupby(["endpoint"], dropna=False)
        .agg(
            count=("status_code", "count"),
            mean=("total_request_ms", "mean"),
            p50=("total_request_ms", "median"),
            p95=("total_request_ms", lambda s: s.quantile(0.95)),
        )
        .reset_index()
        .to_string(index=False)
    )

    print("\nSummary by endpoint + href")
    print(
        df.groupby(["endpoint", "href"], dropna=False)
        .agg(
            count=("status_code", "count"),
            mean=("total_request_ms", "mean"),
            p50=("total_request_ms", "median"),
            p95=("total_request_ms", lambda s: s.quantile(0.95)),
        )
        .reset_index()
        .to_string(index=False)
    )

    print("\nMissing metric rates by endpoint")
    for endpoint, g in df.groupby("endpoint", dropna=False):
        print(
            f"- {endpoint}: arelle_load_ms={g['arelle_load_ms'].isna().mean()*100:.1f}%, "
            f"total_request_ms={g['total_request_ms'].isna().mean()*100:.1f}%, "
            f"local_resolution_elapsed_ms={g['local_resolution_elapsed_ms'].isna().mean()*100:.1f}%, "
            f"concept_lookup_ms={g['concept_lookup_ms'].isna().mean()*100:.1f}%, "
            f"dimensional_total_ms={g['dimensional_total_ms'].isna().mean()*100:.1f}%"
        )


if __name__ == "__main__":
    main()
