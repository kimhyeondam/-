"""납품요구(MAS·단가계약) 실적을 시트 한 장으로 정리한다.

공사·물품 레이더가 '앞으로 나올 것'을 본다면 이쪽은 '이미 나간 것'을 본다.
누가 어디에 얼마나 납품했는지가 그대로 남아 있어, 수요처 지도이자
경쟁사 지도가 된다.
"""

from __future__ import annotations

from pipeline import (  # noqa: F401
    format_amount, match_agency, match_region, normalize_date,
    normalize_targets, parse_amount, pick, squash,
)

COLUMNS = [
    "접수일", "지역", "납품요구명", "세부품명", "수량", "금액",
    "수요기관", "납품업체", "계약형태", "해당품목", "차수", "접촉상태",
]

SEEN_INDEX = "_seen_mas.json"
CSV_PATTERN = "mas_*.csv"


def match_items(text: str, keywords) -> str:
    flat = squash(text)
    hits = []
    for word in keywords or []:
        if word and squash(word) in flat and word not in hits:
            hits.append(word)
    return ", ".join(hits)


def to_row(record: dict, field_map: dict, config: dict, require_items: bool = True) -> dict | None:
    title = pick(record, field_map, "title")
    item_name = pick(record, field_map, "item_name")
    item_class = pick(record, field_map, "item_class")
    agency = pick(record, field_map, "agency")
    region_field = pick(record, field_map, "region")
    haystack = " ".join((title, item_name, item_class))

    for banned in config.get("exclude_keywords") or []:
        if squash(banned) in squash(haystack):
            return None

    items = match_items(haystack, config.get("item_keywords"))
    if require_items and not items:
        return None

    targets = config.get("_targets") or normalize_targets(config.get("target_regions"))
    region = match_region(region_field, targets) if region_field else ""
    if not region:
        region = match_region(agency, targets)
    if not region and not match_agency(agency, config.get("include_agencies")):
        return None

    amount_raw = pick(record, field_map, "amount")
    amount = parse_amount(amount_raw)
    floor = config.get("min_amount")
    if floor and amount is not None and amount < floor:
        return None

    qty = pick(record, field_map, "qty")
    qty_value = parse_amount(qty)

    return {
        "접수일": normalize_date(pick(record, field_map, "posted_at")),
        "지역": region or "(지역확인)",
        "납품요구명": title,
        "세부품명": item_name or item_class,
        "수량": f"{qty_value:,}" if qty_value is not None else qty,
        "금액": format_amount(amount_raw),
        "수요기관": agency,
        "납품업체": pick(record, field_map, "corp"),
        "계약형태": pick(record, field_map, "cntrct_type"),
        "해당품목": items,
        "차수": pick(record, field_map, "bid_ord"),
        "접촉상태": "",
    }


def amount_value(row: dict) -> int:
    return parse_amount(row.get("금액", "")) or 0


def req_no(record: dict, field_map: dict) -> str:
    return pick(record, field_map, "bid_no")


def collapse_by_req(rows: list[dict]) -> tuple[list[dict], int]:
    """같은 납품요구번호는 최종 차수만 남긴다.

    변경이 생기면 같은 번호가 차수만 올려 여러 건으로 온다. 감액 변경까지
    한 줄씩 쌓이면 시트가 실제보다 부풀어 보인다.
    """
    best: dict[str, dict] = {}
    for row in rows:
        key = row["_req"]
        prev = best.get(key)
        if prev is None or row["차수"] > prev["차수"]:
            best[key] = row
    return list(best.values()), len(rows) - len(best)
