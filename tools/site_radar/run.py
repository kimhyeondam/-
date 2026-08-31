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
        "--list-regions",
        action="store_true",
        help="필터 없이, 최근 공고에 실제로 찍힌 공사현장 지역명을 세어서 보여준다",
    )
    p.add_argument(
        "--find-agency",
        metavar="키워드",
        help="최근 공고의 수요기관명 중 키워드가 들어간 것을 세어서 보여준다 (예: 개발공사)",
    )
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


def main(argv=None) -> int:
    args = parse_args(argv)
    config = load_yaml(args.config)
    spec = api.load_spec(args.spec)

    if args.regions:
        config["target_regions"] = args.regions
    days = args.lookback_days or config.get("lookback_days") or 7

    os.makedirs(args.data_dir, exist_ok=True)
    # 지역 표기 패턴은 한 번만 컴파일해서 재사용한다.
    config["_targets"] = pipeline.normalize_targets(config.get("target_regions"))
    regions = [name for name, _ in config["_targets"]]
    preview = ", ".join(regions[:4]) + (f" 외 {len(regions)-4}곳" if len(regions) > 4 else "")
    print(f"✅ 설정 로드 — 대상 지역 {len(regions)}곳 ({preview}), 최근 {days}일")

    client = None
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as fh:
            payload = json.load(fh)
        raw_bids = payload.get("bids", [])
        print(f"✅ 픽스처 로드 — 원본 {len(raw_bids)}건 (네트워크 호출 없음)")
    else:
        try:
            api.require_complete(spec, ["envelope", "bid"])
            api.service_key()
        except (api.SpecIncomplete, api.MissingCredential) as exc:
            print(f"\n중단: {exc}\n", file=sys.stderr)
            return 2
        client = api.Client(spec)
        raw_bids = fetch_bids(client, spec, days)
        print(f"✅ 입찰공고 수집 — 원본 {len(raw_bids)}건")

        if args.find_agency:
            name_field = spec["bid"]["fields"]["agency"]
            counts = collections.Counter(
                (r.get(name_field) or "").strip() for r in raw_bids
                if args.find_agency in (r.get(name_field) or "")
            )
            print(f"\n── 최근 {days}일 공고 중 수요기관명에 '{args.find_agency}' 가 들어간 곳 ──")
            print("   (config.yaml 의 include_agencies 에 아래 이름을 그대로 쓰세요)\n")
            for name, n in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f"  {n:5d}건  {name}")
            print(f"\n{len(counts)}곳 발견" if counts else "\n해당 기관 없음")
            return 0

        if args.list_regions:
            counts = collections.Counter(
                (r.get(spec["bid"]["fields"]["region"]) or "(공란)").strip() for r in raw_bids
            )
            print(f"\n── 최근 {days}일 공사 공고에 실제로 찍힌 공사현장 지역명 ──")
            print("   (config.yaml 의 target_regions 에 아래 표기를 그대로 쓰세요)\n")
            for name, n in sorted(counts.items(), key=lambda kv: -kv[1]):
                print(f"  {n:5d}건  {name}")
            print(f"\n서로 다른 지역명 {len(counts)}종")
            return 0

    fields = spec["bid"]["fields"]
    seen = pipeline.load_seen(args.data_dir)

    # 1) 필터를 통과한 행을 모은다
    candidates, skipped = [], 0
    for record in raw_bids:
        row = pipeline.to_row(record, fields, config)
        if row is None:
            continue
        key = pipeline.bid_key(record, fields)
        if (key in seen or pipeline.row_fingerprint(row) in seen
                or pipeline.name_key(row) in seen):
            skipped += 1
            continue
        row["_bid_no"] = pipeline.pick(record, fields, "bid_no")
        row["_key"] = key
        candidates.append(row)

    # 2) 같은 현장이 재공고로 여러 번 올라온 것을 한 줄로 접는다
    rows, collapsed = pipeline.collapse_by_name(candidates)

    new_keys = {r["_key"] for r in rows if r["_key"]}
    new_keys |= {pipeline.name_key(r) for r in rows}
    new_keys |= {pipeline.row_fingerprint(r) for r in rows}
    for row in rows:
        row.pop("_bid_no", None)
        row.pop("_key", None)

    # 관급자재금액이 큰 순으로 정렬한다. 접촉 우선순위가 곧 이 순서다.
    rows.sort(key=pipeline.govsply_value, reverse=True)
    note = f", 같은 현장 {collapsed}건 병합" if collapsed else ""
    print(f"✅ 필터·중복 제거 — 신규 {len(rows)}건 (기존 중복 {skipped}건 제외{note})")

    out = os.path.join(args.data_dir, f"radar_{datetime.now():%Y-%m-%d}.csv")
    if rows:
        pipeline.write_csv(out, rows)
        pipeline.save_seen(args.data_dir, seen | new_keys)
        print(f"✅ 시트 기록 — {out}")
    else:
        print("✅ 시트 기록 — 신규 건 없음, 파일 변경 없음")

    by_region = collections.Counter(r["지역(시군)"] for r in rows)
    govsply_total = sum(pipeline.govsply_value(r) for r in rows)
    print("\n── 요약 ──")
    print(f"총 수집(원본)   : {len(raw_bids)}건")
    print(f"신규 등록       : {len(rows)}건")
    print(f"관급자재 합계   : {govsply_total:,}원")
    print(f"기존 중복 제외  : {skipped}건")
    print(f"같은 현장 병합  : {collapsed}건")
    print(f"API 실패        : {client.failures if client else 0}건")
    hits = [(r, by_region[r]) for r in regions if by_region.get(r)]
    for region, n in sorted(hits, key=lambda kv: -kv[1]):
        print(f"  {region}: {n}건")
    quiet = len(regions) - len(hits)
    if quiet:
        print(f"  (나머지 {quiet}곳 0건)")
    unknown = by_region.get("(지역확인)", 0)
    if unknown:
        print(f"  (지역확인) {unknown}건 — 지정 발주처 건이라 담았으나 현장 지역명이 비어 있음")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
