#!/usr/bin/env python3
"""현장 레이더 — 하나의 입구.

    py tools\\site_radar\\radar.py          메뉴에서 고르기
    py tools\\site_radar\\radar.py 공사      관급자재가 잡힌 공사 공고
    py tools\\site_radar\\radar.py 물품      우리 품목의 물품 공고
    py tools\\site_radar\\radar.py 전체      둘 다
    py tools\\site_radar\\radar.py 물품 30   최근 30일치

인증키가 없으면 여기서 물어보고, 원하면 영구 등록까지 해준다.
끝나면 결과 시트를 바로 띄운다.
"""

from __future__ import annotations

import glob
import os
import subprocess
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(REPO, "data")
sys.path.insert(0, HERE)

WORKS = {"공사", "1", "work", "works", "c"}
GOODS = {"물품", "2", "goods", "item", "g"}
BOTH = {"전체", "둘다", "3", "all", "both", "a"}
ITEMS = {"4", "품명", "품명목록", "items"}
REGIONS = {"5", "지역", "지역목록", "regions"}


def ask_kind() -> str:
    print()
    print("  무엇을 찾을까요?")
    print()
    print("    1. 공사   — 관급자재가 잡힌 공사 공고 (착공 전 예고)")
    print("    2. 물품   — 우리 품목의 물품 공고 (입찰 기회)")
    print("    3. 전체   — 둘 다")
    print()
    print("    4. 품명 목록  — 전남·광주에 실제로 나온 물품 품명 세어보기")
    print("    5. 지역 목록  — 공고에 실제로 찍힌 지역명 세어보기")
    print()
    while True:
        try:
            answer = input("  번호 또는 공사/물품/전체 입력 > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n  취소했습니다.")
            raise SystemExit(1)
        if answer in WORKS | GOODS | BOTH | ITEMS | REGIONS:
            return answer
        print("  1~5 중에 고르시거나 공사 / 물품 / 전체 라고 적어주세요.")


def ensure_key() -> bool:
    """인증키를 확보한다. 없으면 물어보고, 원하면 영구 등록한다."""
    if os.environ.get("G2B_SERVICE_KEY", "").strip():
        return True
    if not sys.stdin.isatty():
        return False

    print()
    print("  공공데이터포털 인증키가 필요합니다.")
    print("  마이페이지 → 개인 API 인증키 → '인증키 복사(Decoding)' 로 복사해서 붙여넣으세요.")
    print()
    try:
        key = input("  인증키 > ").strip().strip("'\"")
    except (EOFError, KeyboardInterrupt):
        return False
    if not key:
        return False
    os.environ["G2B_SERVICE_KEY"] = key

    if os.name == "nt":
        print()
        try:
            keep = input("  이 컴퓨터에 저장해서 다음부터 안 묻게 할까요? (y/n) > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            keep = "n"
        if keep.startswith("y"):
            # setx 는 사용자 환경변수에 영구 기록한다. 이 창에는 적용되지 않으므로
            # 위에서 os.environ 에도 넣어 이번 실행은 그대로 진행한다.
            subprocess.run(["setx", "G2B_SERVICE_KEY", key],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print("  저장했습니다. 다음부터는 묻지 않습니다.")
    return True


def latest_sheet(prefix: str) -> str | None:
    files = sorted(glob.glob(os.path.join(DATA, f"{prefix}_*.csv")))
    return files[-1] if files else None


def open_sheet(path: str | None) -> None:
    if not path or not os.path.exists(path):
        return
    print(f"\n  시트를 엽니다 — {path}")
    try:
        if os.name == "nt":
            os.startfile(path)  # noqa: S606
        elif sys.platform == "darwin":
            subprocess.run(["open", path])
        else:
            subprocess.run(["xdg-open", path])
    except Exception:
        print("  (자동으로 열지 못했습니다. 위 경로를 직접 여세요.)")


def run_one(label: str, module_name: str, prefix: str, days: str | None) -> int:
    import importlib
    module = importlib.import_module(module_name)
    argv = ["--lookback-days", days] if days else []
    print(f"\n{'='*62}\n  {label} 검색\n{'='*62}")
    code = module.main(argv)
    if code == 0:
        open_sheet(latest_sheet(prefix))
    return code


def main() -> int:
    args = [a for a in sys.argv[1:] if a.strip()]
    kind = args[0] if args else None
    days = next((a for a in args[1:] if a.isdigit()), None)
    if kind is None:
        kind = ask_kind()
    kind = kind.strip().lower()

    if kind not in WORKS | GOODS | BOTH | ITEMS | REGIONS:
        print(f"  알 수 없는 값입니다: {kind}")
        print("  공사 / 물품 / 전체 / 품명 / 지역 중에 하나를 쓰세요.")
        return 2

    if not ensure_key():
        print("\n  인증키가 없어 중단합니다.")
        return 2

    print(f"\n  {datetime.now():%Y-%m-%d %H:%M} 검색 시작"
          + (f" (최근 {days}일)" if days else " (최근 7일)"))

    if kind in ITEMS:
        import run_goods
        return run_goods.main(["--list-items", "--lookback-days", days or "30"])
    if kind in REGIONS:
        import run
        return run.main(["--list-regions", "--lookback-days", days or "30"])

    code = 0
    if kind in WORKS or kind in BOTH:
        code |= run_one("공사 공고", "run", "radar", days)
    if kind in GOODS or kind in BOTH:
        code |= run_one("물품 공고", "run_goods", "goods", days)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
