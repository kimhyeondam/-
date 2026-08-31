"""수집 결과를 시트 한 장으로 정리하는 로직 (네트워크와 무관한 순수 함수들)."""

from __future__ import annotations

import csv
import glob
import json
import os
import re

COLUMNS = [
    "공고일", "지역(시군)", "현장명", "발주처", "공사종류", "추정금액",
    "개찰(예정)일", "낙찰시공사", "시공사연락처", "예상소요품목", "공고URL", "접촉상태",
]

# 공고번호는 시트 열에 넣지 않으므로, 중복 판정용 색인을 별도 파일로 둔다.
SEEN_INDEX = "_seen_bids.json"


def pick(record: dict, field_map: dict, key: str) -> str:
    """스펙에 매핑된 항목명으로 원본 레코드에서 값을 꺼낸다. 매핑이 없으면 공란."""
    name = field_map.get(key)
    if not name:
        return ""
    value = record.get(name)
    return "" if value is None else str(value).strip()


def normalize_date(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if len(digits) >= 8:
        return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}"
    return raw


def parse_amount(raw: str) -> int | None:
    digits = re.sub(r"\D", "", raw)
    return int(digits) if digits else None


def format_amount(raw: str) -> str:
    value = parse_amount(raw)
    return f"{value:,}" if value is not None else ""


def bid_key(record: dict, field_map: dict) -> str:
    no = pick(record, field_map, "bid_no")
    ord_ = pick(record, field_map, "bid_ord")
    return f"{no}-{ord_}" if ord_ else no


# 공기업 공고는 "김해시"가 아니라 "김해 진례지구"처럼 접미사를 떼고 쓴다.
# 그래서 축약형도 잡되, "고성군"의 축약형 "고성"이 "고성능"에 걸리지 않도록
# 뒤에 한글이 바로 붙는 경우는 제외하고 지명 접미사만 허용한다.
REGION_SUFFIXES = "시군구읍면리동"


def region_patterns(region: str) -> list[re.Pattern]:
    patterns = [re.compile(re.escape(region))]
    stem = region[:-1] if region[-1] in REGION_SUFFIXES else region
    if stem and stem != region:
        patterns.append(re.compile(re.escape(stem) + r"(?![가-힣])"))
        patterns.append(re.compile(re.escape(stem) + r"(?=지구|일원|권역)"))
    return patterns


def match_region(haystack: str, regions: list[str]) -> str:
    """발주처·공고명에서 대상 시·군을 찾는다. 없으면 빈 문자열."""
    for region in regions:
        if not region:
            continue
        if any(p.search(haystack) for p in region_patterns(region)):
            return region
    return ""


def match_items(title: str, rules: list[dict]) -> str:
    """공고명 키워드로 예상 품목을 붙인다. 규칙에 안 걸리면 공란(추정 금지)."""
    flat = title.replace(" ", "")
    hits = []
    for rule in rules or []:
        for keyword in rule.get("keywords", []):
            if keyword.replace(" ", "") in flat:
                if rule["items"] not in hits:
                    hits.append(rule["items"])
                break
    return ", ".join(hits)


def to_row(record: dict, field_map: dict, config: dict) -> dict | None:
    """원본 공고 1건 → 시트 1행. 필터에 걸리면 None."""
    title = pick(record, field_map, "title")
    agency = pick(record, field_map, "agency")
    region_field = pick(record, field_map, "region")

    for banned in config.get("exclude_keywords") or []:
        if banned in title:
            return None

    keywords = config.get("agency_keywords") or []
    if keywords and not any(k in agency for k in keywords):
        return None

    # 공사현장 지역명(cnstrtsiteRgnNm)이 있으면 그것만 본다. 이게 곧 물류 반경 판정 기준이다.
    # 비어 있는 공고만 발주처명·공고명으로 되짚는다.
    targets = config.get("target_regions") or []
    region = match_region(region_field, targets) if region_field else ""
    if not region:
        region = match_region(f"{agency} {title}", targets)
    if not region:
        return None

    amount_raw = pick(record, field_map, "amount")
    amount = parse_amount(amount_raw)
    floor = config.get("min_amount")
    # 금액 항목이 응답에 없으면(공란) 금액 필터는 적용하지 않는다.
    if floor and amount is not None and amount < floor:
        return None

    return {
        "공고일": normalize_date(pick(record, field_map, "posted_at")),
        "지역(시군)": region,
        "현장명": title,
        "발주처": agency,
        "공사종류": pick(record, field_map, "work_type"),
        "추정금액": format_amount(amount_raw),
        "개찰(예정)일": normalize_date(pick(record, field_map, "open_at")),
        "낙찰시공사": "",
        "시공사연락처": "",
        "예상소요품목": match_items(title, config.get("item_rules")),
        "공고URL": pick(record, field_map, "url"),
        "접촉상태": "",
    }


def load_seen(data_dir: str) -> set[str]:
    """이전 실행에서 이미 시트에 넣은 공고번호."""
    path = os.path.join(data_dir, SEEN_INDEX)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return set(json.load(fh))
    # 색인이 없어졌으면 기존 CSV의 (현장명, 발주처, 공고일)로 대체 판정한다.
    fallback = set()
    for csv_path in sorted(glob.glob(os.path.join(data_dir, "radar_*.csv"))):
        with open(csv_path, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                fallback.add(row_fingerprint(row))
    return fallback


def row_fingerprint(row: dict) -> str:
    return "|".join((row.get("현장명", ""), row.get("발주처", ""), row.get("공고일", "")))


def save_seen(data_dir: str, seen: set[str]) -> None:
    with open(os.path.join(data_dir, SEEN_INDEX), "w", encoding="utf-8") as fh:
        json.dump(sorted(seen), fh, ensure_ascii=False, indent=0)


def write_csv(path: str, rows: list[dict]) -> None:
    """엑셀에서 바로 열리도록 UTF-8 BOM으로 쓴다. 기존 파일이 있으면 이어 붙인다."""
    exists = os.path.exists(path)
    mode = "a" if exists else "w"
    with open(path, mode, encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        if not exists:
            writer.writeheader()
        writer.writerows(rows)
