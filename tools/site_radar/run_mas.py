#!/usr/bin/env python3
"""납품요구 레이더 — 종합쇼핑몰(MAS·단가계약)로 실제 나간 물량을 모은다.

    py tools\\site_radar\\run_mas.py
    py tools\\site_radar\\run_mas.py --list-items    실제 품명 표기 확인
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
import mas  # noqa: E402
import pipeline  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="납품요구(MAS) 실적 수집")
    p.add_argument("--config", default=os.path.join(HERE, "mas_config.yaml"))
    p.add_argument("--spec", default=os.path.join(HERE, "api_spec.yaml"))
    p.add_argument("--data-dir", default=os.path.join(REPO, "data"))
    p.add_argument("--lookback-days", type=int)
    p.add_argument("--list-items", action="store_true",
                   help="품목 필터를 끄고, 대상 지역 납품요구의 세부품명을 세어서 보여준다")
    p.add_argument("--fixture")
    return p.parse_args(argv)


def fetch(client: api.Client, spec: dict, days: int) -> list[dict]:
    cfg = spec["dlvrreq"]
    fmt = cfg["date_format"]
    end = datetime.now()
    start = end - timedelta(days=days)
    query = {
        cfg["params"]["date_from"]: start.strftime(fmt),
        cfg["params"]["date_to"]: end.strftime(fmt),
    }
    return list(client.paged("dlvrreq", query, page_size=500, max_pages=200))


def main(argv=None) -> int:
    args = parse_args(argv)
    with open(args.config, encoding="utf-8") as fh:
        config = yaml.safe_load(fh)
    spec = api.load_spec(args.spec)

    config["_targets"] = pipeline.normalize_targets(config.get("target_regions"))
    days = args.lookback_days or config.get("lookback_days") or 14
    os.makedirs(args.data_dir, exist_ok=True)
    print(f"✅ 설정 로드 — 품목 {len(config['item_keywords'])}종, "
          f"지역 {len(config['_targets'])}곳, 최근 {days}일")

    client = None
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as fh:
            raw = json.load(fh).get("rows", [])
        print(f"✅ 픽스처 로드 — 원본 {len(raw)}건 (네트워크 호출 없음)")
    else:
        try:
            api.require_complete(spec, ["envelope", "dlvrreq"])
            api.service_key()
        except (api.SpecIncomplete, api.MissingCredential) as exc:
            print(f"\n중단: {exc}\n", file=sys.stderr)
            return 2
        client = api.Client(spec)
        print(f"   납품요구는 건수가 많습니다. {days}일이면 1~2분 걸립니다.")
        raw = fetch(client, spec, days)
        print(f"✅ 납품요구 수집 — 원본 {len(raw)}건")

    fields = spec["dlvrreq"]["fields"]

    if args.list_items:
        loose = dict(config)
        loose["item_keywords"] = None
        counts, total = collections.Counter(), 0
        for record in raw:
            if mas.to_row(record, fields, loose, require_items=False) is None:
                continue
            total += 1
            name = mas.pick(record, fields, "item_name") or "(세부품명 없음)"
            counts[name] += 1
        print(f"\n── 대상 지역 납품요구 {total}건의 세부품명 ──")
        print("   (우리 품목이 보이면 mas_config.yaml 의 item_keywords 에 넣으세요)\n")
        for name, n in counts.most_common(100):
            print(f"  {n:5d}건  {name}")
        print(f"\n서로 다른 품명 {len(counts)}종")
        return 0

    seen = pipeline.load_seen(args.data_dir, mas.CSV_PATTERN, mas.SEEN_INDEX,
                              pipeline.MAS_KEYS)
    candidates, skipped = [], 0
    for record in raw:
        row = mas.to_row(record, fields, config)
        if row is None:
            continue
        no = mas.req_no(record, fields)
        key = f"{no}-{row['차수']}"
        mark = pipeline.fingerprint(row, pipeline.MAS_KEYS)
        if key in seen or mark in seen:
            skipped += 1
            continue
        row["_req"], row["_key"], row["_mark"] = no, key, mark
        candidates.append(row)

    rows, collapsed = mas.collapse_by_req(candidates)
    new_keys = {r["_key"] for r in rows if r["_key"]} | {r["_mark"] for r in rows}
    for row in rows:
        row.pop("_req", None)
        row.pop("_key", None)
        row.pop("_mark", None)

    rows.sort(key=mas.amount_value, reverse=True)
    note = f", 변경차수 {collapsed}건 병합" if collapsed else ""
    print(f"✅ 필터·중복 제거 — 신규 {len(rows)}건 (기존 중복 {skipped}건 제외{note})")

    out = os.path.join(args.data_dir, f"납품요구_{datetime.now():%Y-%m-%d}.csv")
    if rows:
        pipeline.write_csv(out, rows, mas.COLUMNS)
        pipeline.save_seen(args.data_dir, seen | new_keys, mas.SEEN_INDEX)
        print(f"✅ 시트 기록 — {out}")
    else:
        print("✅ 시트 기록 — 신규 건 없음, 파일 변경 없음")

    print("\n── 요약 ──")
    print(f"총 수집(원본)   : {len(raw)}건")
    print(f"신규 등록       : {len(rows)}건")
    print(f"납품 금액 합계  : {sum(mas.amount_value(r) for r in rows):,}원")
    print(f"기존 중복 제외  : {skipped}건")
    print(f"API 실패        : {client.failures if client else 0}건")

    corps = collections.Counter(r["납품업체"] for r in rows if r["납품업체"])
    if corps:
        print("\n납품업체 (건수 순) — 우리 시장을 가져가고 있는 곳")
        for name, n in corps.most_common(15):
            total = sum(mas.amount_value(r) for r in rows if r["납품업체"] == name)
            print(f"  {n:3d}건  {total:>14,}원  {name}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n  중단했습니다.")
        raise SystemExit(130)
