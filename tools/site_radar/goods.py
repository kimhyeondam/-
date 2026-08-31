"""물품 공고를 시트 한 장으로 정리하는 로직.

공사 레이더와 판정 기준이 다르다.
  공사 = 관급자재금액이 얼마나 잡혔나 (선행 신호)
  물품 = 우리가 만드는 품목이 실제로 발주됐나 (입찰 기회)

물품 공고에는 공사현장 지역명이 없으므로 수요기관명으로만 지역을 가른다.
"""

from __future__ import annotations

from pipeline import (  # noqa: F401
    format_amount, match_agency, match_region, normalize_date,
    normalize_targets, parse_amount, pick, squash,
)

COLUMNS = [
    "공고일", "지역", "품목·공고명", "세부품명", "규격", "수량",
    "추정가격", "수요기관", "입찰마감", "해당품목", "공고URL", "접촉상태",
]

SEEN_INDEX = "_seen_goods.json"
CSV_PATTERN = "물품_*.csv"


def match_items(text: str, keywords) -> str:
    """공고명·품명에서 우리 품목을 찾는다. 없으면 빈 문자열."""
    flat = squash(text)
    hits = []
    for word in keywords or []:
        if word and squash(word) in flat and word not in hits:
            hits.append(word)
    return ", ".join(hits)


def to_row(record: dict, field_map: dict, config: dict, require_items: bool = True) -> dict | None:
    """물품 공고 1건 → 시트 1행. 걸리는 게 없으면 None."""
    title = pick(record, field_map, "title")
    item_name = pick(record, field_map, "item_name")
    item_spec = pick(record, field_map, "item_spec")
    item_list = pick(record, field_map, "item_list")
    agency = pick(record, field_map, "agency")
    # 공고명만 보면 "2026년 관급자재 구매"처럼 뭉뚱그린 제목에서 품목을 놓친다.
    # 세부품명·규격·구매대상목록까지 같이 훑는다.
    haystack = " ".join((title, item_name, item_spec, item_list))

    # 제외어는 공고명만이 아니라 세부품명·규격까지 본다.
    # '플라스틱계맨홀'처럼 제목이 아니라 품명에 재질이 적히는 경우가 있다.
    for banned in config.get("exclude_keywords") or []:
        if squash(banned) in squash(haystack):
            return None

    # 우리가 만드는 품목이 아니면 볼 이유가 없다. 이게 1차 관문이다.
    items = match_items(haystack, config.get("item_keywords"))
    if require_items and not items:
        return None

    targets = config.get("_targets") or normalize_targets(config.get("target_regions"))
    region = match_region(agency, targets)
    agency_hit = match_agency(agency, config.get("include_agencies"))
    if not region and not agency_hit:
        return None

    amount_raw = pick(record, field_map, "amount")
    amount = parse_amount(amount_raw)
    floor = config.get("min_amount")
    if floor and amount is not None and amount < floor:
        return None

    return {
        "공고일": normalize_date(pick(record, field_map, "posted_at")),
        "지역": region or "(지역확인)",
        "품목·공고명": title,
        "세부품명": item_name,
        "규격": item_spec,
        "수량": quantity(record, field_map),
        "추정가격": format_amount(amount_raw),
        "수요기관": agency,
        "입찰마감": normalize_date(pick(record, field_map, "close_at")),
        "해당품목": items,
        "공고URL": pick(record, field_map, "url"),
        "접촉상태": "",
    }


def quantity(record: dict, field_map: dict) -> str:
    """수량과 단위를 한 칸에 붙인다. 예) 320 EA"""
    qty = pick(record, field_map, "qty")
    unit = pick(record, field_map, "unit")
    if not qty:
        return ""
    value = parse_amount(qty)
    shown = f"{value:,}" if value is not None else qty
    return f"{shown} {unit}".strip()


def amount_value(row: dict) -> int:
    return parse_amount(row.get("추정가격", "")) or 0
