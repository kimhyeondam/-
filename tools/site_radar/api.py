"""나라장터 OpenAPI 클라이언트.

엔드포인트·파라미터명·응답 항목명을 이 모듈에 하드코딩하지 않는다.
전부 api_spec.yaml 에서 읽는다. 스펙이 채워지지 않으면 SpecIncomplete 로 멈춘다.
"""

from __future__ import annotations

import os
import time
from typing import Any

import requests
import yaml

TODO = "TODO"
RATE_LIMIT_SECONDS = 1.0
RETRY_BACKOFF = (2, 4, 8)


class SpecIncomplete(RuntimeError):
    """api_spec.yaml 에 TODO 가 남아 있다."""


class MissingCredential(RuntimeError):
    """G2B_SERVICE_KEY 환경변수가 없다."""


def load_spec(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def find_todos(node: Any, trail: str = "") -> list[str]:
    """스펙 트리에서 TODO 로 남은 경로를 전부 모은다."""
    if isinstance(node, dict):
        found = []
        for key, value in node.items():
            found += find_todos(value, f"{trail}.{key}" if trail else key)
        return found
    if isinstance(node, list):
        found = []
        for i, value in enumerate(node):
            found += find_todos(value, f"{trail}[{i}]")
        return found
    return [trail] if node == TODO else []


def require_complete(spec: dict, sections: list[str]) -> None:
    todos = []
    for section in sections:
        todos += [f"{section}.{t}" if t else section for t in find_todos(spec.get(section), "")]
    if todos:
        raise SpecIncomplete(
            "api_spec.yaml 이 아직 비어 있습니다. 아래 항목을 공식 문서에서 옮겨 적으세요:\n"
            + "\n".join(f"  - {t}" for t in sorted(todos))
            + "\n\n  입찰공고정보서비스: https://www.data.go.kr/data/15129394/openapi.do"
            + "\n  낙찰정보서비스:     https://www.data.go.kr/data/15129397/openapi.do"
        )


def service_key() -> str:
    key = os.environ.get("G2B_SERVICE_KEY", "").strip()
    if not key:
        raise MissingCredential(
            "환경변수 G2B_SERVICE_KEY 가 비어 있습니다. "
            "공공데이터포털에서 발급받은 인증키를 export 하고 다시 실행하세요."
        )
    return key


def dig(payload: Any, path: str) -> Any:
    """'response.body.items' 같은 점 경로로 값을 꺼낸다. 없으면 None."""
    node = payload
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


class Client:
    def __init__(self, spec: dict, session: requests.Session | None = None):
        self.spec = spec
        self.session = session or requests.Session()
        self._last_call = 0.0
        self.failures = 0

    def _throttle(self) -> None:
        wait = RATE_LIMIT_SECONDS - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait)
        self._last_call = time.monotonic()

    def _get(self, url: str, params: dict) -> dict | None:
        """단건 GET. 429/5xx 는 지수 백오프로 최대 3회 재시도."""
        for attempt in range(len(RETRY_BACKOFF) + 1):
            self._throttle()
            try:
                res = self.session.get(url, params=params, timeout=30)
            except requests.RequestException as exc:
                last_error = str(exc)
            else:
                if res.status_code == 200:
                    try:
                        return res.json()
                    except ValueError:
                        # 인증키 오류 등은 XML 로 돌아온다. 본문을 그대로 남긴다.
                        last_error = f"JSON 아님: {res.text[:200]}"
                elif res.status_code == 429 or res.status_code >= 500:
                    last_error = f"HTTP {res.status_code}"
                else:
                    self.failures += 1
                    print(f"  ⚠ 요청 실패 (재시도 안 함) HTTP {res.status_code}: {res.text[:200]}")
                    return None
            if attempt < len(RETRY_BACKOFF):
                time.sleep(RETRY_BACKOFF[attempt])
        self.failures += 1
        print(f"  ⚠ 요청 실패 (재시도 소진): {last_error}")
        return None

    def _unwrap(self, payload: dict) -> tuple[list[dict], int]:
        env = self.spec["envelope"]
        code = dig(payload, env["result_code_path"])
        if code is not None and str(code) != str(env["result_ok_value"]):
            self.failures += 1
            print(f"  ⚠ API 오류 응답 resultCode={code}")
            return [], 0
        items = dig(payload, env["items_path"])
        if items is None:
            return [], 0
        # 포털에 따라 items 가 {"item": [...]} 로 한 겹 더 감싸 오는 경우가 있다.
        if isinstance(items, dict):
            items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
        total = dig(payload, env["total_count_path"])
        return list(items), int(total or 0)

    def paged(self, section: str, query: dict, page_size: int = 100, max_pages: int = 50):
        """한 오퍼레이션을 끝까지 페이징하며 원본 레코드를 내보낸다."""
        cfg = self.spec[section]
        names = cfg["params"]
        url = f"{cfg['base_url'].rstrip('/')}/{cfg['operation'].lstrip('/')}"
        seen = 0
        for page in range(1, max_pages + 1):
            params = dict(cfg.get("extra_params") or {})
            params[names["service_key"]] = service_key()
            params[names["page_no"]] = page
            params[names["num_of_rows"]] = page_size
            if names.get("response_type"):
                params[names["response_type"]] = "json"
            params.update(query)
            payload = self._get(url, params)
            if payload is None:
                return
            items, total = self._unwrap(payload)
            if not items:
                return
            yield from items
            seen += len(items)
            if total and seen >= total:
                return
