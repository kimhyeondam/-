#!/usr/bin/env python3
"""api_spec.yaml 을 채우기 위한 엔드포인트 탐색기.

문서를 눈으로 옮겨 적는 대신, 후보 조합을 실제로 호출해서 되는 것을 찾는다.
성공한 응답의 '실제' 항목명을 그대로 출력하므로 추측이 들어갈 자리가 없다.
인증키는 화면에 출력하지 않는다.

    py tools\\site_radar\\probe.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api  # noqa: E402

# 나라장터 API는 서비스명 뒤 버전 숫자가 개편 때마다 바뀐다.
# 어느 것이 살아 있는지 모르므로 전부 두드려 보고 되는 것을 찾는다.
SUFFIXES = ["", "01", "02", "03", "04", "05", "06", "07"]
PREFIXES = ["http://apis.data.go.kr/1230000", "https://apis.data.go.kr/1230000"]

SERVICES = {
    "bid": {
        "label": "입찰공고정보서비스 (공사)",
        "service": "BidPublicInfoService",
        "operations": [
            "getBidPblancListInfoCnstwk",
            "getBidPblancListInfoCnstwkPPSSrch",
        ],
        "date_params": True,
    },
    "scsbid": {
        "label": "낙찰정보서비스 (공사 개찰결과)",
        "service": "ScsbidInfoService",
        "operations": [
            "getOpengResultListInfoCnstwk",
            "getScsbidListSttusCnstwk",
            "getOpengResultListInfoCnstwkPPSSrch",
        ],
        "date_params": True,
    },
}


def candidates(service: str):
    for prefix in PREFIXES:
        for suffix in SUFFIXES:
            yield f"{prefix}/{service}{suffix}"
            yield f"{prefix}/ad/{service}{suffix}"


def describe(payload) -> str:
    """응답에서 resultCode / resultMsg 를 최대한 뽑아 짧게 설명한다."""
    if isinstance(payload, dict):
        header = payload.get("response", {}).get("header", {}) if "response" in payload else {}
        code = header.get("resultCode")
        msg = header.get("resultMsg")
        if code is not None:
            return f"resultCode={code} resultMsg={msg}"
    return ""


def first_item(payload):
    body = payload.get("response", {}).get("body", {}) if isinstance(payload, dict) else {}
    items = body.get("items")
    if isinstance(items, dict):
        items = items.get("item")
    if isinstance(items, dict):
        items = [items]
    if isinstance(items, list) and items:
        return items[0], body.get("totalCount")
    return None, body.get("totalCount")


def probe(key: str, name: str, cfg: dict) -> dict | None:
    end = datetime.now()
    start = end - timedelta(days=7)
    base_params = {
        "serviceKey": key,
        "pageNo": 1,
        "numOfRows": 1,
        "type": "json",
    }
    if cfg["date_params"]:
        base_params.update({
            "inqryDiv": 1,
            "inqryBgnDt": start.strftime("%Y%m%d%H%M"),
            "inqryEndDt": end.strftime("%Y%m%d%H%M"),
        })

    print(f"\n{'='*70}\n{cfg['label']} 탐색\n{'='*70}")
    tried = 0
    for base in candidates(cfg["service"]):
        for op in cfg["operations"]:
            tried += 1
            url = f"{base}/{op}"
            shown = url.replace("http://apis.data.go.kr/1230000", "…")
            try:
                res = requests.get(url, params=base_params, timeout=20)
            except requests.RequestException as exc:
                print(f"  x {shown}  ({type(exc).__name__})")
                continue
            if res.status_code != 200:
                print(f"  x {shown}  HTTP {res.status_code}")
                continue
            try:
                payload = res.json()
            except ValueError:
                snippet = res.text[:120].replace("\n", " ")
                print(f"  x {shown}  JSON 아님: {snippet}")
                continue
            note = describe(payload)
            item, total = first_item(payload)
            if item:
                print(f"  ✅ {shown}  {note} totalCount={total}")
                return {"base_url": base, "operation": op, "item": item, "total": total}
            print(f"  · {shown}  {note} (레코드 0건)")
    print(f"  → {tried}개 조합 시도, 데이터를 받은 조합 없음")
    return None


def main() -> int:
    try:
        key = api.service_key()
    except api.MissingCredential as exc:
        print(f"중단: {exc}", file=sys.stderr)
        return 2

    results = {}
    for name, cfg in SERVICES.items():
        results[name] = probe(key, name, cfg)

    print(f"\n\n{'#'*70}\n# 아래 내용을 통째로 복사해서 붙여넣어 주세요\n{'#'*70}")
    for name, found in results.items():
        print(f"\n--- {name} ---")
        if not found:
            print("성공한 조합 없음")
            continue
        print(f"base_url : {found['base_url']}")
        print(f"operation: {found['operation']}")
        print(f"totalCount: {found['total']}")
        print("응답 항목 (실제 필드명 = 값):")
        for k, v in found["item"].items():
            text = str(v)
            if len(text) > 60:
                text = text[:60] + "…"
            print(f"  {k} = {text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
