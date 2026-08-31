#!/usr/bin/env python3
"""현장 레이더 — 시·군별 신규 관급 공사 발주 공고를 모아 CSV 한 장으로 떨어뜨린다.

    python tools/site_radar/run.py

API 엔드포인트·파라미터명·응답 항목명은 api_spec.yaml 에서만 읽는다.
스펙이 비어 있으면 아무것도 추측하지 않고 멈춘다.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import sys
from datetime import datetime, timedelta

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import api  # noqa: E402
import pipeline  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="시·군별 신규 발주 공고 수집")
    p.add_argument("--config", default=os.path.join(HERE, "config.yaml"))
    p.add_argument("--spec", default=os.path.join(HERE, "api_spec.yaml"))
    p.add_argument("--data-dir", default=os.path.join(REPO, "data"))
    p.add_argument("--lookback-days", type=int, help="config 값을 덮어쓴다")
    p.add_argument("--regions", nargs="+", help="config 의 target_regions 를 덮어쓴다")
    p.add_argument(
        "--fixture",
        help="네트워크 없이 저장된 응답으로 파이프라인만 돌린다 (자체 점검용)",
    )
    return p.parse_args(argv)


def load_yaml(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def fetch_bids(client: api.Client, spec: dict, days: int) -> list[dict]:
    cfg = spec["bid"]
    fmt = cfg["date_format"]
    end = datetime.now()
    start = end - timedelta(days=days)
    query = {
        cfg["params"]["date_from"]: start.strftime(fmt),
        cfg["params"]["date_to"]: end.strftime(fmt),
    }
    return list(client.paged("bid", query))


def fetch_contractor(client: api.Client, spec: dict, bid_no: str) -> tuple[str, str]:
    """개찰결과에서 낙찰 시공사를 찾는다. 아직 개찰 전이면 ('개찰전', '')."""
    cfg = spec["scsbid"]
    fields = cfg["fields"]
    records = list(client.paged("scsbid", {cfg["params"]["bid_no"]: bid_no}, page_size=10, max_pages=1))
    for record in records:
        name = pipeline.pick(record, fields, "contractor")
        if name:
            return name, pipeline.pick(record, fields, "contractor_tel")
    return "개찰전", ""


def main(argv=None) -> int:
    args = parse_args(argv)
    config = load_yaml(args.config)
    spec = api.load_spec(args.spec)

    if args.regions:
        config["target_regions"] = args.regions
    days = args.lookback_days or config.get("lookback_days") or 7

    os.makedirs(args.data_dir, exist_ok=True)
    print(f"✅ 설정 로드 — 대상 지역 {config['target_regions']}, 최근 {days}일")

    client = None
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as fh:
            payload = json.load(fh)
        raw_bids = payload.get("bids", [])
        scsbid_map = payload.get("scsbid", {})
        print(f"✅ 픽스처 로드 — 원본 {len(raw_bids)}건 (네트워크 호출 없음)")
    else:
        try:
            api.require_complete(spec, ["envelope", "bid", "scsbid"])
            api.service_key()
        except (api.SpecIncomplete, api.MissingCredential) as exc:
            print(f"\n중단: {exc}\n", file=sys.stderr)
            return 2
        client = api.Client(spec)
        raw_bids = fetch_bids(client, spec, days)
        scsbid_map = None
        print(f"✅ 입찰공고 수집 — 원본 {len(raw_bids)}건")

    fields = spec["bid"]["fields"]
    seen = pipeline.load_seen(args.data_dir)
    rows, new_keys, skipped = [], [], 0

    for record in raw_bids:
        row = pipeline.to_row(record, fields, config)
        if row is None:
            continue
        key = pipeline.bid_key(record, fields)
        if key in seen or pipeline.row_fingerprint(row) in seen:
            skipped += 1
            continue
        if scsbid_map is not None:
            hit = scsbid_map.get(key, {})
            row["낙찰시공사"] = hit.get("contractor", "개찰전")
            row["시공사연락처"] = hit.get("contractor_tel", "")
        else:
            name, tel = fetch_contractor(client, spec, pipeline.pick(record, fields, "bid_no"))
            row["낙찰시공사"], row["시공사연락처"] = name, tel
        rows.append(row)
        new_keys.append(key or pipeline.row_fingerprint(row))

    print(f"✅ 필터·중복 제거 — 신규 {len(rows)}건 (기존 중복 {skipped}건 제외)")

    out = os.path.join(args.data_dir, f"radar_{datetime.now():%Y-%m-%d}.csv")
    if rows:
        pipeline.write_csv(out, rows)
        pipeline.save_seen(args.data_dir, seen | set(new_keys) | {pipeline.row_fingerprint(r) for r in rows})
        print(f"✅ 시트 기록 — {out}")
    else:
        print("✅ 시트 기록 — 신규 건 없음, 파일 변경 없음")

    by_region = collections.Counter(r["지역(시군)"] for r in rows)
    print("\n── 요약 ──")
    print(f"총 수집(원본)   : {len(raw_bids)}건")
    print(f"신규 등록       : {len(rows)}건")
    print(f"기존 중복 제외  : {skipped}건")
    print(f"API 실패        : {client.failures if client else 0}건")
    for region in config["target_regions"]:
        print(f"  {region}: {by_region.get(region, 0)}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
