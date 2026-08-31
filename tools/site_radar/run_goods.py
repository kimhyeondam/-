#!/usr/bin/env python3
"""물품 레이더 — 우리가 만드는 품목의 관급 물품 공고를 모아 CSV로 떨어뜨린다.

    py tools\\site_radar\\run_goods.py

공사 레이더(run.py)와 짝이다. 공사 쪽은 '이 현장에 관급자재가 잡혔다'는
선행 신호를, 이쪽은 '실제 입찰 기회'를 잡는다.
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
import goods  # noqa: E402
import pipeline  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="관급자재 물품 공고 수집")
    p.add_argument("--config", default=os.path.join(HERE, "goods_config.yaml"))
    p.add_argument("--spec", default=os.path.join(HERE, "api_spec.yaml"))
    p.add_argument("--data-dir", default=os.path.join(REPO, "data"))
    p.add_argument("--lookback-days", type=int, help="config 값을 덮어쓴다")
    p.add_argument(
        "--list-items",
        action="store_true",
        help="품목 필터를 끄고, 대상 지역 물품 공고의 세부품명을 세어서 보여준다",
    )
    p.add_argument("--fixture", help="네트워크 없이 저장된 응답으로 돌린다 (자체 점검용)")
    return p.parse_args(argv)


def fetch(client: api.Client, spec: dict, days: int) -> list[dict]:
    cfg = spec["thng"]
    fmt = cfg["date_format"]
    end = datetime.now()
    start = end - timedelta(days=days)
    query = {
        cfg["params"]["date_from"]: start.strftime(fmt),
        cfg["params"]["date_to"]: end.strftime(fmt),
    }
    # 물품 공고는 공사보다 훨씬 많다. 페이지 상한을 넉넉히 둔다.
    return list(client.paged("thng", query, page_size=500, max_pages=200))


def main(argv=None) -> int:
    args = parse_args(argv)
    with open(args.config, encoding="utf-8") as fh:
        config = yaml.safe_load(fh)
    spec = api.load_spec(args.spec)

    config["_targets"] = pipeline.normalize_targets(config.get("target_regions"))
    days = args.lookback_days or config.get("lookback_days") or 7
    os.makedirs(args.data_dir, exist_ok=True)
    print(f"✅ 설정 로드 — 품목 {len(config['item_keywords'])}종, "
          f"지역 {len(config['_targets'])}곳, 최근 {days}일")

    client = None
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as fh:
            raw = json.load(fh).get("bids", [])
        print(f"✅ 픽스처 로드 — 원본 {len(raw)}건 (네트워크 호출 없음)")
    else:
        try:
            api.require_complete(spec, ["envelope", "thng"])
            api.service_key()
        except (api.SpecIncomplete, api.MissingCredential) as exc:
            print(f"\n중단: {exc}\n", file=sys.stderr)
            return 2
        client = api.Client(spec)
        print(f"   물품 공고는 건수가 많습니다. {days}일이면 1~2분 걸립니다. 기다려 주세요.")
        raw = fetch(client, spec, days)
        print(f"✅ 물품 공고 수집 — 원본 {len(raw)}건")

    fields = spec["thng"]["fields"]

    if args.list_items:
        # 품목 키워드를 빼고, 지역·발주처만 통과한 공고의 품명을 전부 센다.
        # 우리 키워드가 실제 품명과 어긋나 있는지 여기서 드러난다.
        loose = dict(config)
        loose["item_keywords"] = None
        counts, total = collections.Counter(), 0
        for record in raw:
            probe_row = goods.to_row(record, fields, loose, require_items=False)
            if probe_row is None:
                continue
            total += 1
            name = goods.pick(record, fields, "item_name") or "(세부품명 없음)"
            spec_txt = goods.pick(record, fields, "item_spec")
            counts[f"{name}  |  {spec_txt[:30]}" if spec_txt else name] += 1
        print(f"\n── 대상 지역 물품 공고 {total}건의 세부품명 ──")
        print("   (우리 품목이 보이면 goods_config.yaml 의 item_keywords 에 그 단어를 넣으세요)\n")
        for name, n in counts.most_common(80):
            print(f"  {n:4d}건  {name}")
        print(f"\n서로 다른 품명 {len(counts)}종")
        return 0

    seen = pipeline.load_seen(args.data_dir, goods.CSV_PATTERN, goods.SEEN_INDEX)

    candidates, skipped = [], 0
    for record in raw:
        row = goods.to_row(record, fields, config)
        if row is None:
            continue
        key = pipeline.bid_key(record, fields)
        name = "goods:" + goods.name_key({
            "지역(시군)": row["지역"], "발주처": row["수요기관"], "현장명": row["품목·공고명"],
        })
        if key in seen or name in seen:
            skipped += 1
            continue
        row["_key"], row["_name"] = key, name
        candidates.append(row)

    # 같은 공고가 재공고로 다시 올라온 것을 접는다
    best: dict[str, dict] = {}
    for row in candidates:
        prev = best.get(row["_name"])
        if prev is None or row["공고일"] > prev["공고일"]:
            best[row["_name"]] = row
    rows = list(best.values())
    collapsed = len(candidates) - len(rows)

    new_keys = {r["_key"] for r in rows if r["_key"]} | {r["_name"] for r in rows}
    for row in rows:
        row.pop("_key", None)
        row.pop("_name", None)

    rows.sort(key=goods.amount_value, reverse=True)
    note = f", 같은 공고 {collapsed}건 병합" if collapsed else ""
    print(f"✅ 필터·중복 제거 — 신규 {len(rows)}건 (기존 중복 {skipped}건 제외{note})")

    out = os.path.join(args.data_dir, f"goods_{datetime.now():%Y-%m-%d}.csv")
    if rows:
        pipeline.write_csv(out, rows, goods.COLUMNS)
        pipeline.save_seen(args.data_dir, seen | new_keys, goods.SEEN_INDEX)
        print(f"✅ 시트 기록 — {out}")
    else:
        print("✅ 시트 기록 — 신규 건 없음, 파일 변경 없음")

    print("\n── 요약 ──")
    print(f"총 수집(원본)   : {len(raw)}건")
    print(f"신규 등록       : {len(rows)}건")
    print(f"추정가격 합계   : {sum(goods.amount_value(r) for r in rows):,}원")
    print(f"기존 중복 제외  : {skipped}건")
    print(f"API 실패        : {client.failures if client else 0}건")
    by_item = collections.Counter(w for r in rows for w in r["해당품목"].split(", ") if w)
    for word, n in by_item.most_common():
        print(f"  {word}: {n}건")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n  중단했습니다.")
        raise SystemExit(130)
