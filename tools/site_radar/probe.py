#!/usr/bin/env python3
"""api_spec.yaml 을 채우기 위한 엔드포인트 탐색기.

후보 조합을 실제로 호출해서 되는 것을 찾고, 성공한 응답의 '실제' 항목명을
그대로 출력한다. 추측이 들어갈 자리가 없다. 인증키는 화면에 출력하지 않는다.

    py tools\\site_radar\\probe.py mas        # 나라장터쇼핑몰 (납품요구)
    py tools\\site_radar\\probe.py thng       # 물품 입찰공고
    py tools\\site_radar\\probe.py scsbid     # 낙찰정보서비스
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import api  # noqa: E402

# bid 는 /ad/BidPublicInfoService 에서 확정됐다. scsbid 도 /ad/ 아래일 가능성이 높으니
# 그것부터 두드리고, 안 되면 버전 숫자와 /ad/ 없는 형태까지 넓힌다.
def bases(service: str) -> list[str]:
    # 조달청 서비스는 /ad/ 와 /at/ 두 갈래가 있고 버전 숫자도 붙는다.
    out = []
    for root in ("https://apis.data.go.kr/1230000", "http://apis.data.go.kr/1230000"):
        for mid in ("at/", "ad/", ""):
            out.append(f"{root}/{mid}{service}")
            out += [f"{root}/{mid}{service}{n:02d}" for n in range(1, 8)]
    return out


SERVICES = {
    "bid": {
        "label": "입찰공고정보서비스 (공사)",
        "service": "BidPublicInfoService",
        "operations": ["getBidPblancListInfoCnstwk"],
    },
    "thng": {
        "label": "입찰공고정보서비스 (물품)",
        "service": "BidPublicInfoService",
        "operations": [
            "getBidPblancListInfoThng",
            "getBidPblancListInfoThngPPSSrch",
        ],
    },
    "mas": {
        # 조달청_나라장터쇼핑몰 품목정보 서비스. 문서의 End Point 를 그대로 쓴다.
        # 파라미터를 안 주면 하루분이 돌아온다고 문서에 적혀 있어 날짜를 붙이지 않는다.
        "label": "나라장터쇼핑몰 품목정보 (납품요구·다수공급자계약)",
        "explicit_bases": ["https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService"],
        "operations": [
            "getDlvrReqDtlInfoList",        # 납품요구 상세 — 세부품명·수량
            "getDlvrReqInfoList",           # 납품요구 현황 — 수요기관·계약업체
            "getMASCntrctPrdctInfoList",    # 다수공급자계약 품목
        ],
        "no_date": True,
    },
    "mas_dlvr": {
        # 납품요구는 날짜 파라미터가 필수로 보인다. 이름과 형식을 모르니
        # 후보를 훑는다. 문서상 검색조건은 '납품요구접수일자'다.
        "label": "나라장터쇼핑몰 납품요구 (날짜 파라미터 탐색)",
        "explicit_bases": ["https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService"],
        "operations": ["getDlvrReqInfoList", "getDlvrReqDtlInfoList"],
        "date_variants": [
            ("inqryBgnDate", "inqryEndDate", "%Y%m%d"),
            ("inqryBgnDt", "inqryEndDt", "%Y%m%d"),
            ("inqryBgnDt", "inqryEndDt", "%Y%m%d%H%M"),
            ("dlvrReqRcptDate", "dlvrReqRcptEndDate", "%Y%m%d"),
            ("bgnDate", "endDate", "%Y%m%d"),
            # 입찰공고 쪽처럼 inqryDiv 를 함께 요구할 수도 있다
            ("inqryBgnDate", "inqryEndDate", "%Y%m%d", {"inqryDiv": 1}),
            ("inqryBgnDt", "inqryEndDt", "%Y%m%d", {"inqryDiv": 1}),
            ("inqryBgnDt", "inqryEndDt", "%Y%m%d%H%M", {"inqryDiv": 1}),
        ],
        "lookback_days": 3,
    },
    "scsbid": {
        "label": "낙찰정보서비스 (공사 개찰결과)",
        "service": "ScsbidInfoService",
        "operations": [
            "getOpengResultListInfoCnstwk",
            "getOpengResultListInfoCnstwkPPSSrch",
            "getScsbidListSttusCnstwk",
            "getScsbidListSttusCnstwkPPSSrch",
            "getOpengResultListInfoOpengCompt",
            "getScsbidListSttusCnstwkPreparPcDetail",
            "getOpengResultListInfoCnstwkBsisAmount",
        ],
    },
}

INQRY_DIVS = [1, 2, 3]

# 마지막 탐색에서 나온 실패 사유들. 복사해 붙이는 블록에 같이 싣는다.
FAILURES: list[str] = []

CUSTOM_HELP = """
아직 손대지 않은 서비스를 두드릴 때:

    py tools\\site_radar\\probe.py --service ShoppingMallPrdctInfoService \\
        --ops getShoppingMallPrdctInfoList,getPrdctInfoList

  --base     문서의 End Point 를 통째로 (이걸 주면 변형을 훑지 않는다)
  --service  공공데이터포털 문서의 서비스 URL 마지막 조각
  --ops      쉼표로 구분한 오퍼레이션 후보 (모르면 문서에서 그대로 옮긴다)
  --no-date  조회기간 파라미터를 쓰지 않는 서비스일 때
"""


def header_of(payload):
    if isinstance(payload, dict):
        if "response" in payload and isinstance(payload["response"], dict):
            return payload["response"].get("header", {}) or {}
        return payload.get("header", {}) or {}
    return {}


def items_of(payload):
    body = {}
    if isinstance(payload, dict) and isinstance(payload.get("response"), dict):
        body = payload["response"].get("body", {}) or {}
    items = body.get("items")
    if isinstance(items, dict):
        items = items.get("item")
    if isinstance(items, dict):
        items = [items]
    return (items or []), body.get("totalCount")


def attempt(url: str, params: dict) -> tuple[str, list, object]:
    """한 조합을 호출하고 (짧은 설명, 레코드들, totalCount) 를 돌려준다."""
    try:
        res = requests.get(url, params=params, timeout=20)
    except requests.RequestException as exc:
        return f"{type(exc).__name__}", [], None
    if res.status_code != 200:
        return f"HTTP {res.status_code}", [], None
    try:
        payload = res.json()
    except ValueError:
        return "JSON아님: " + res.text[:100].replace("\n", " "), [], None
    head = header_of(payload)
    code, msg = head.get("resultCode"), head.get("resultMsg")
    items, total = items_of(payload)
    if code is None:
        # 표준 응답이 아니다. 본문을 그대로 보여줘야 이유를 안다.
        raw = res.text.replace("\n", " ")[:220]
        return f"(표준 응답 아님) {raw}", items, total
    return f"resultCode={code} {msg}", items, total


def probe(key: str, cfg: dict) -> dict | None:
    FAILURES.clear()
    end = datetime.now()
    start = end - timedelta(days=cfg.get("lookback_days", 7))
    print(f"\n{'='*72}\n{cfg['label']} 탐색\n{'='*72}")

    def param_sets():
        """이 서비스에서 시도할 조회 파라미터 조합들. (설명, 파라미터) 목록."""
        if cfg.get("no_date"):
            return [("파라미터 없음", {})]
        if cfg.get("date_variants"):
            out = []
            for variant in cfg["date_variants"]:
                bgn, endn, fmt = variant[0], variant[1], variant[2]
                extra = dict(variant[3]) if len(variant) > 3 else {}
                params = {bgn: start.strftime(fmt), endn: end.strftime(fmt)}
                params.update(extra)
                tail = f" +{extra}" if extra else ""
                out.append((f"{bgn}/{endn} {fmt}{tail}", params))
            return out
        return [(f"inqryDiv={d}", {
            "inqryDiv": d,
            "inqryBgnDt": start.strftime("%Y%m%d%H%M"),
            "inqryEndDt": end.strftime("%Y%m%d%H%M"),
        }) for d in INQRY_DIVS]

    sets = param_sets()
    if cfg.get("explicit_bases"):
        all_bases = cfg["explicit_bases"]
    else:
        names = cfg.get("services") or [cfg["service"]]
        all_bases = [b for name in names for b in bases(name)]
    for base in all_bases:
        shown_base = base.replace("https://apis.data.go.kr/1230000", "…").replace(
            "http://apis.data.go.kr/1230000", "…")
        for op in cfg["operations"]:
            url = f"{base}/{op}"
            for label, extra in sets:
                params = {"serviceKey": key, "pageNo": 1, "numOfRows": 1, "type": "json"}
                params.update(extra)
                note, items, total = attempt(url, params)
                tag = f"{shown_base}/{op} [{label}]"
                if items:
                    print(f"  ✅ {tag}\n     {note} totalCount={total}")
                    return {"base_url": base, "operation": op, "inqry_div": label,
                            "params": extra, "item": items[0], "total": total}
                print(f"  x  {tag}  {note}")
                FAILURES.append(f"{op} [{label}] → {note}")
            # 같은 오퍼레이션에서 세 번 다 같은 사유로 죽으면 다음 오퍼레이션으로
    return None


def parse_custom(argv: list[str]) -> dict | None:
    """--service / --ops 로 임의의 서비스를 두드리게 한다."""
    if "--service" not in argv and "--base" not in argv:
        return None
    def value(flag, default=None):
        return argv[argv.index(flag) + 1] if flag in argv and argv.index(flag) + 1 < len(argv) else default
    services = [x.strip() for x in (value("--service") or "").split(",") if x.strip()]
    ops = [o.strip() for o in (value("--ops") or "").split(",") if o.strip()]
    explicit = value("--base")
    if explicit and ops:
        # 문서에서 End Point 를 그대로 옮겨온 경우. 변형을 훑지 않고 이것만 쓴다.
        return {"label": f"직접 지정: {explicit}", "explicit_bases": [explicit.rstrip("/")],
                "operations": ops, "no_date": "--no-date" in argv}
    if not services or not ops:
        print("  --service 와 --ops 를 함께 주세요." + CUSTOM_HELP, file=sys.stderr)
        return None
    return {
        "label": f"직접 지정: {', '.join(services)}",
        "services": services,
        "operations": ops,
        "no_date": "--no-date" in argv,
    }


def main() -> int:
    argv = sys.argv[1:]
    if "--help" in argv or "-h" in argv:
        print(__doc__ + CUSTOM_HELP)
        return 0
    try:
        key = api.service_key()
    except api.MissingCredential as exc:
        print(f"중단: {exc}", file=sys.stderr)
        return 2

    custom = parse_custom(argv)
    if custom is not None:
        found = probe(key, custom)
        print(f"\n\n{'#'*72}\n# 아래 내용을 통째로 복사해서 붙여넣어 주세요\n{'#'*72}\n")
        if not found:
            print("성공한 조합 없음. 시도한 조합과 실패 사유:\n")
            for line in dict.fromkeys(FAILURES):
                print(f"  {line}")
            return 1
        print(f"base_url : {found['base_url']}")
        print(f"operation: {found['operation']}")
        print(f"조회조건 : {found['inqry_div']}  {found.get('params', {})}")
        print(f"totalCount: {found['total']}")
        print("응답 항목 (실제 필드명 = 값):")
        for k, v in found["item"].items():
            text = str(v)
            print(f"  {k} = {text[:60] + '…' if len(text) > 60 else text}")
        return 0

    wanted = [a for a in argv if not a.startswith("-")] or ["thng"]
    results = {}
    for name in wanted:
        if name not in SERVICES:
            print(f"알 수 없는 서비스: {name} (가능: {', '.join(SERVICES)})", file=sys.stderr)
            return 2
        results[name] = probe(key, SERVICES[name])

    print(f"\n\n{'#'*72}\n# 아래 내용을 통째로 복사해서 붙여넣어 주세요\n{'#'*72}")
    for name, found in results.items():
        print(f"\n--- {name} ---")
        if not found:
            print("성공한 조합 없음. 시도한 조합과 실패 사유:\n")
            for line in dict.fromkeys(FAILURES):
                print(f"  {line}")
            continue
        print(f"base_url : {found['base_url']}")
        print(f"operation: {found['operation']}")
        print(f"inqryDiv : {found['inqry_div']}")
        print(f"totalCount: {found['total']}")
        print("응답 항목 (실제 필드명 = 값):")
        for k, v in found["item"].items():
            text = str(v)
            print(f"  {k} = {text[:60] + '…' if len(text) > 60 else text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
