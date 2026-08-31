"""수집 결과를 시트 한 장으로 정리하는 로직 (네트워크와 무관한 순수 함수들)."""

from __future__ import annotations

import csv
import glob
import json
import os
import re

# 관급자재금액을 앞쪽에 둔다. 이 시트를 여는 목적이 그 숫자이기 때문이다.
COLUMNS = [
    "공고일", "지역(시군)", "현장명", "관급자재금액", "추정금액",
    "발주처", "공사종류", "예상소요품목", "공고URL", "접촉상태",
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


def squash(text: str) -> str:
    """띄어쓰기를 지운 형태로 비교한다. 기관명은 표기마다 공백이 들쭉날쭉하다."""
    return re.sub(r"\s+", "", text or "")


def match_agency(agency: str, wanted) -> str:
    """수요기관명이 지정한 발주처 중 하나인지 본다. 맞으면 그 이름, 아니면 빈 문자열."""
    flat = squash(agency)
    for name in wanted or []:
        if name and squash(name) in flat:
            return name
    return ""


def normalize_targets(regions) -> list[tuple[str, list[re.Pattern]]]:
    """설정의 target_regions 를 (표시이름, 매칭패턴들) 목록으로 편다.

    한 지역이 여러 표기로 올 수 있다. 행정구역 통합처럼 이름이 바뀌면
    한동안 옛 표기와 새 표기가 섞여 오므로, 둘 다 등록해 두고 하나로 묶는다.

        - 광양시                          # 표기가 하나뿐인 경우
        - name: 광주 북구                  # 여러 표기를 한 이름으로 묶는 경우
          match: [전남광주통합특별시 북구, 광주광역시 북구]
    """
    out = []
    for entry in regions or []:
        if isinstance(entry, dict):
            name = entry.get("name")
            forms = entry.get("match") or ([name] if name else [])
        else:
            name, forms = entry, [entry]
        if not name:
            continue
        patterns = [p for form in forms if form for p in region_patterns(form)]
        out.append((name, patterns))
    return out


def target_names(regions) -> list[str]:
    return [name for name, _ in normalize_targets(regions)]


def match_region(haystack: str, targets) -> str:
    """발주처·공고명에서 대상 시·군을 찾는다. 없으면 빈 문자열."""
    if targets and isinstance(targets[0], str):
        targets = normalize_targets(targets)
    for name, patterns in targets:
        if any(p.search(haystack) for p in patterns):
            return name
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

    # 이 발주처들은 지역 판정과 무관하게 무조건 담는다.
    # 공사현장 지역명이 비어 오는 경우가 있어 지역으로만 거르면 통째로 놓친다.
    agency_hit = match_agency(agency, config.get("include_agencies"))

    # 공사현장 지역명(cnstrtsiteRgnNm)이 있으면 그것만 본다. 이게 곧 물류 반경 판정 기준이다.
    # 비어 있는 공고만 발주처명·공고명으로 되짚는다.
    targets = config.get("_targets") or normalize_targets(config.get("target_regions"))
    region = match_region(region_field, targets) if region_field else ""
    if not region:
        region = match_region(f"{agency} {title}", targets)
    if not region and not agency_hit:
        return None

    amount_raw = pick(record, field_map, "amount")
    amount = parse_amount(amount_raw)
    floor = config.get("min_amount")
    # 금액 항목이 응답에 없으면(공란) 금액 필터는 적용하지 않는다.
    if floor and amount is not None and amount < floor:
        return None

    # 관급자재 금액 = 도급자설치 관급자재 + 관급공사 관급자재
    govsply = sum(
        parse_amount(pick(record, field_map, key)) or 0
        for key in ("govsply_contractor", "govsply_gov")
    )
    govsply_floor = config.get("min_govsply_amt")
    if govsply_floor and govsply < govsply_floor:
        return None

    return {
        "공고일": normalize_date(pick(record, field_map, "posted_at")),
        "지역(시군)": region or "(지역확인)",
        "현장명": title,
        "관급자재금액": f"{govsply:,}" if govsply else "",
        "추정금액": format_amount(amount_raw),
        "발주처": agency,
        "공사종류": pick(record, field_map, "work_type"),
        "예상소요품목": match_items(title, config.get("item_rules")),
        "공고URL": pick(record, field_map, "url"),
        "접촉상태": "",
    }


def govsply_value(row: dict) -> int:
    """정렬용 — 시트에는 콤마가 찍힌 문자열로 들어 있다."""
    return parse_amount(row.get("관급자재금액", "")) or 0


def load_seen(data_dir: str, pattern: str = "radar_*.csv", index: str = SEEN_INDEX) -> set[str]:
    """이전 실행에서 이미 시트에 넣은 공고번호."""
    path = os.path.join(data_dir, index)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return set(json.load(fh))
    # 색인이 없어졌으면 기존 CSV의 (현장명, 발주처, 공고일)로 대체 판정한다.
    fallback = set()
    for csv_path in sorted(glob.glob(os.path.join(data_dir, pattern))):
        with open(csv_path, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                fallback.add(row_fingerprint(row))
    return fallback


def row_fingerprint(row: dict) -> str:
    return "|".join((row.get("현장명", ""), row.get("발주처", ""), row.get("공고일", "")))


def name_key(row: dict) -> str:
    """같은 현장인지 판정하는 열쇠.

    한 현장이 재공고·정정공고로 여러 번 올라오면 공고번호가 매번 달라진다.
    현장명만으로 묶으면 "마을안길 포장공사"처럼 흔한 이름이 다른 시군의
    다른 공사까지 삼키므로, 지역과 발주처까지 함께 본다.
    """
    return "name:" + "|".join((
        row.get("지역(시군)", ""), row.get("발주처", ""), row.get("현장명", ""),
    ))


def newest_first(row: dict) -> tuple:
    """같은 현장이 여러 건이면 최근 공고를, 같은 날이면 관급자재가 큰 쪽을 남긴다."""
    return (row.get("공고일", ""), govsply_value(row))


def collapse_by_name(rows: list[dict]) -> tuple[list[dict], int]:
    """같은 현장을 한 줄로 접는다. (남은 행, 접힌 건수)"""
    best: dict[str, dict] = {}
    for row in rows:
        key = name_key(row)
        if key not in best or newest_first(row) > newest_first(best[key]):
            best[key] = row
    return list(best.values()), len(rows) - len(best)


def save_seen(data_dir: str, seen: set[str], index: str = SEEN_INDEX) -> None:
    with open(os.path.join(data_dir, index), "w", encoding="utf-8") as fh:
        json.dump(sorted(seen), fh, ensure_ascii=False, indent=0)


def write_csv(path: str, rows: list[dict], columns: list[str] | None = None) -> None:
    """엑셀에서 바로 열리도록 UTF-8 BOM으로 쓴다. 기존 파일이 있으면 이어 붙인다."""
    exists = os.path.exists(path)
    mode = "a" if exists else "w"
    with open(path, mode, encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns or COLUMNS)
        if not exists:
            writer.writeheader()
        writer.writerows(rows)
