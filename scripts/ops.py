#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""현담토목 운영 OS — 영업·재고·견적·응대를 한 곳에서 굴리는 CLI.

데이터는 전부 data/*.csv 이고 엑셀로 그냥 열립니다.
사람이 손으로 고쳐도 되고, 이 스크립트가 고쳐도 됩니다.

    python3 scripts/ops.py 브리핑
    python3 scripts/ops.py 재고
    python3 scripts/ops.py 출고 --코드 HP600 --수량 12 --상대처 대창건자재
"""

import argparse
import csv
import datetime as dt
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
견적서_DIR = os.path.join(ROOT, "견적서")

# ─────────────────────────────── 공용 유틸 ───────────────────────────────

def path(name):
    return os.path.join(DATA, name + ".csv")


def read(name):
    p = path(name)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8-sig", newline="") as f:
        return [dict(r) for r in csv.DictReader(f)]


def fields(name):
    p = path(name)
    with open(p, encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f))


def write(name, rows, cols=None):
    cols = cols or fields(name)
    with open(path(name), "w", encoding="utf-8-sig", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=cols)
        wr.writeheader()
        for r in rows:
            wr.writerow({c: r.get(c, "") for c in cols})


def append(name, row):
    cols = fields(name)
    with open(path(name), "a", encoding="utf-8-sig", newline="") as f:
        csv.DictWriter(f, fieldnames=cols).writerow({c: row.get(c, "") for c in cols})


def num(v, default=0):
    """'1,200원' 같은 것도 숫자로 읽는다."""
    if v is None:
        return default
    s = re.sub(r"[^\d.\-]", "", str(v))
    if s in ("", "-", "."):
        return default
    try:
        return int(float(s))
    except ValueError:
        return default


def fnum(v, default=0.0):
    try:
        return float(re.sub(r"[^\d.\-]", "", str(v)) or default)
    except ValueError:
        return default


def date(v):
    if not v:
        return None
    s = str(v).strip().replace(".", "-").replace("/", "-")
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if not m:
        return None
    try:
        return dt.date(*(int(x) for x in m.groups()))
    except ValueError:
        return None


def today(args=None):
    if args is not None and getattr(args, "기준일", None):
        d = date(args.기준일)
        if d:
            return d
    return dt.date.today()


def won(n):
    return f"{int(n):,}원"


def 실데이터(rows):
    """'예시' 표시가 붙은 시드 행은 집계에서 뺀다."""
    return [r for r in rows if "예시" not in (r.get("비고") or "")
            and not (r.get("상호") or r.get("현장명") or "").startswith("(예시)")]


def w_len(s):
    """한글·한자는 두 칸 차지한다."""
    import unicodedata
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in str(s))


def pad(s, n, right=False):
    s = str(s)
    while w_len(s) > n:
        s = s[:-1]
    공백 = " " * max(0, n - w_len(s))
    return 공백 + s if right else s + 공백


def title(s):
    print()
    print(s)
    print("─" * 58)


def 품목맵():
    return {r["코드"]: r for r in read("품목")}

# ─────────────────────────────── 브리핑 ───────────────────────────────

def 소진예측(코드, 재고수, 이력, 오늘):
    """최근 60일 출고 속도로 며칠 남았는지 추정."""
    최근 = [num(r["수량"]) for r in 이력
            if r["코드"] == 코드 and r["구분"] == "출고"
            and (date(r["일자"]) or dt.date(1900, 1, 1)) >= 오늘 - dt.timedelta(days=60)]
    if not 최근:
        return None
    일평균 = sum(최근) / 60.0
    if 일평균 <= 0:
        return None
    return int(재고수 / 일평균)


def 설정미완():
    """판매단가가 하나도 없으면 견적을 낼 수 없다. 그 상태에서 다른 경보를 울려봐야 소음이다."""
    품목 = read("품목")
    if not 품목 or any(num(r.get("판매단가")) > 0 for r in 품목):
        return []
    할일 = ["판매단가 — 원가는 들어와 있습니다. 마진을 정하면 한 번에 채웁니다:",
            "     python3 scripts/ops.py 판매가설정 --마진 25"]
    if not read("재고"):
        할일.append("data/재고.csv — 상시 보유하는 품목만 넣으십시오 (전 품목 아님)")
    return 할일


def cmd_브리핑(args):
    오늘 = today(args)
    print(f"\n■ 현담토목 오늘의 판 — {오늘:%Y년 %m월 %d일} ({'월화수목금토일'[오늘.weekday()]})")

    남은설정 = 설정미완()
    if 남은설정:
        title("먼저 채워야 할 것 — 이게 없으면 나머지가 다 헛돕니다")
        for t in 남은설정:
            print(f"  □ {t}")
        print("\n  다 채우고 나면: python3 scripts/ops.py 예시삭제")
        print()
        return

    할일 = []

    # ① 기한이 온 후속조치
    for r in read("활동"):
        if (r.get("완료") or "").strip() in ("O", "o", "완료", "Y", "y"):
            continue
        d = date(r.get("다음액션일"))
        if d and d <= 오늘 and (r.get("다음액션") or "").strip():
            지연 = (오늘 - d).days
            꼬리 = f" ⚠ {지연}일 지남" if 지연 > 0 else ""
            할일.append(("후속조치", f"{r['상대']} — {r['다음액션']}{꼬리}"))

    for r in 실데이터(read("현장")):
        d = date(r.get("다음액션일"))
        if d and d <= 오늘 and (r.get("다음액션") or "").strip():
            할일.append(("현장", f"{r['현장명']} — {r['다음액션']}"))

    # ② 착공 임박한데 아직 접촉 못 한 현장
    임박 = []
    for r in 실데이터(read("현장")):
        d = date(r.get("착공예정일"))
        if not d:
            continue
        남은 = (d - 오늘).days
        if -14 <= 남은 <= 45 and (r.get("접촉상태") or "미접촉") in ("미접촉", "접촉중"):
            임박.append((남은, r))
    임박.sort(key=lambda x: x[0])

    # ③ 재고 경보
    이력 = read("입출고")
    품목 = 품목맵()
    부족, 임박소진 = [], []
    for r in read("재고"):
        코드 = r["코드"]
        현재고, 안전 = num(r["현재고"]), num(r["안전재고"])
        리드 = num(r.get("생산리드타임일"), 7)
        이름 = 품목.get(코드, {}).get("품목명", 코드)
        규격 = 품목.get(코드, {}).get("규격", "")
        if 현재고 < 안전:
            부족.append(f"{이름} {규격} [{코드}] — 재고 {현재고} / 안전 {안전} (생산 {리드}일)")
        else:
            남은일 = 소진예측(코드, 현재고 - 안전, 이력, 오늘)
            if 남은일 is not None and 남은일 <= 리드:
                임박소진.append(f"{이름} {규격} [{코드}] — 약 {남은일}일 후 안전재고 밑으로 (생산 {리드}일) → 지금 생산 걸어야 함")

    # ④ 회신 없는 견적
    미회신 = []
    for r in read("견적"):
        if (r.get("상태") or "") != "발송":
            continue
        d = date(r.get("회신예정일")) or ((date(r.get("일자")) or 오늘) + dt.timedelta(days=3))
        if d <= 오늘:
            미회신.append(f"{r['번호']} {r['거래처']} / {r.get('현장','')} {won(num(r.get('합계')))} — 발송 {(오늘-(date(r['일자']) or 오늘)).days}일째 무응답")

    # ⑤ 조용해진 거래처
    휴면위험 = []
    for r in 실데이터(read("거래처")):
        if (r.get("상태") or "") != "거래":
            continue
        d = date(r.get("최근거래일"))
        if d and (오늘 - d).days >= 90:
            휴면위험.append(f"{r['상호']} ({r.get('담당자','')}) — 마지막 거래 {(오늘-d).days}일 전")

    # ── 출력
    if 할일:
        title("① 오늘 반드시 처리 (기한 도래)")
        for 구분, t in 할일:
            print(f"  □ [{구분}] {t}")

    if 임박:
        title("② 착공 임박 현장 — 지금 안 붙으면 못 넣습니다")
        for 남은, r in 임박:
            표시 = f"D{남은:+d}" if 남은 else "D-DAY"
            print(f"  □ {표시:>6}  {r['현장명']} / {r.get('시공사','시공사 미상')} / {r.get('거리km','?')}km")
            if r.get("예상품목"):
                print(f"           예상품목 {r['예상품목']}  ·  상태 {r.get('접촉상태','미접촉')}")

    if 부족 or 임박소진:
        title("③ 재고 경보")
        for t in 부족:
            print(f"  ▲ 부족  {t}")
        for t in 임박소진:
            print(f"  △ 임박  {t}")

    if 미회신:
        title("④ 회신 없는 견적 — 한 통이면 되는 일")
        for t in 미회신:
            print(f"  □ {t}")

    if 휴면위험:
        title("⑤ 조용해진 거래처 — 휴면 되기 전에")
        for t in 휴면위험:
            print(f"  □ {t}")

    if not any([할일, 임박, 부족, 임박소진, 미회신, 휴면위험]):
        print("\n  급한 불은 없습니다.")
        print("  → marketing/02-60일-실행표.html 에서 오늘 과제 하나를 하십시오.")
        print("  → 또는 `python3 scripts/ops.py 현장 --미접촉` 으로 놓친 현장을 확인하십시오.")

    print()

# ─────────────────────────────── 재고 ───────────────────────────────

def cmd_재고(args):
    품목 = 품목맵()
    이력 = read("입출고")
    오늘 = today(args)
    title(f"재고 현황 — {오늘:%Y-%m-%d}")
    print(f"  {pad('코드',8)} {pad('품목',26)} {pad('현재고',7,True)} {pad('안전',6,True)} {pad('상태',6)} 비고")
    총액 = 0
    for r in read("재고"):
        코드 = r["코드"]
        p = 품목.get(코드, {})
        이름 = (p.get("품목명", 코드) + " " + p.get("규격", "")).strip()
        현재고, 안전 = num(r["현재고"]), num(r["안전재고"])
        총액 += 현재고 * num(p.get("판매단가"))
        if 현재고 < 안전:
            상태, 비고 = "부족", f"{안전-현재고}{p.get('단위','개')} 생산 필요"
        else:
            남은 = 소진예측(코드, 현재고 - 안전, 이력, 오늘)
            리드 = num(r.get("생산리드타임일"), 7)
            if 남은 is not None and 남은 <= 리드:
                상태, 비고 = "임박", f"약 {남은}일분"
            else:
                상태, 비고 = "정상", (f"약 {남은}일분" if 남은 is not None else "")
        print(f"  {pad(코드,8)} {pad(이름,26)} {pad(f'{현재고:,}',7,True)} {pad(f'{안전:,}',6,True)} {pad(상태,6)} {비고}")
    print(f"\n  야적장 재고 판매가 환산 {won(총액)}")
    print()


def _재고행(코드):
    rows = read("재고")
    for r in rows:
        if r["코드"] == 코드:
            return rows, r
    return rows, None


def _이동(args, 구분, 부호):
    코드, 수량 = args.코드, args.수량
    rows, target = _재고행(코드)
    if target is None:
        if 코드 not in 품목맵():
            sys.exit(f"품목 코드 '{코드}' 가 data/품목.csv 에 없습니다.")
        target = {"코드": 코드, "현재고": "0", "안전재고": "0", "생산리드타임일": "7"}
        rows.append(target)
    이전 = num(target["현재고"])
    이후 = 이전 + 부호 * 수량 if 구분 != "조정" else 수량
    if 이후 < 0:
        print(f"  ⚠ 재고보다 많이 나갑니다. 현재고 {이전} → {이후}. 그대로 기록합니다(마이너스 = 미생산 출고 약속).")
    target["현재고"] = str(이후)
    target["갱신일"] = f"{today(args):%Y-%m-%d}"
    write("재고", rows)
    append("입출고", {
        "일자": f"{today(args):%Y-%m-%d}", "코드": 코드, "구분": 구분,
        "수량": str(수량), "상대처": args.상대처 or "", "현장": args.현장 or "",
        "메모": args.메모 or "",
    })
    이름 = 품목맵().get(코드, {}).get("품목명", 코드)
    print(f"  {구분} 기록 완료 — {이름}[{코드}] {수량} / 재고 {이전} → {이후}")
    안전 = num(target["안전재고"])
    if 이후 < 안전:
        print(f"  ▲ 안전재고({안전}) 미달입니다. 생산 지시가 필요합니다.")


def cmd_입고(args):
    _이동(args, "입고", +1)


def cmd_출고(args):
    _이동(args, "출고", -1)
    if args.상대처:
        rows = read("거래처")
        for r in rows:
            if r["상호"] == args.상대처:
                r["최근거래일"] = f"{today(args):%Y-%m-%d}"
                if r.get("상태") in ("휴면", "미거래"):
                    r["상태"] = "거래"
                    print(f"  · {args.상대처} 상태를 '거래'로 되돌렸습니다.")
                write("거래처", rows)
                break


def cmd_조정(args):
    _이동(args, "조정", 0)

# ─────────────────────────────── 견적 ───────────────────────────────

def cmd_견적(args):
    품목 = 품목맵()
    항목 = []
    for 조각 in args.품목.split(","):
        조각 = 조각.strip()
        if not 조각:
            continue
        if ":" not in 조각:
            sys.exit(f"품목 형식은 '코드:수량' 입니다. 받은 값: {조각}")
        코드, 수량 = 조각.split(":", 1)
        코드, 수량 = 코드.strip(), num(수량)
        if 코드 not in 품목:
            sys.exit(f"품목 코드 '{코드}' 가 data/품목.csv 에 없습니다.")
        p = 품목[코드]
        단가 = num(p["판매단가"])
        if 단가 == 0:
            print(f"  ⚠ {코드} 판매단가가 0원입니다. data/품목.csv 를 먼저 채우십시오.")
        항목.append({
            "코드": 코드, "품명": p["품목명"], "규격": p["규격"], "단위": p["단위"],
            "수량": 수량, "단가": 단가, "금액": 단가 * 수량,
            "적재": num(p.get("차량적재수량")),
        })

    소계 = sum(i["금액"] for i in 항목)
    할인 = int(소계 * args.할인 / 100)
    운반비 = args.운반비
    적재가능 = [i for i in 항목 if i["적재"] > 0]
    차량수 = math.ceil(sum(i["수량"] / i["적재"] for i in 적재가능)) if 적재가능 else 0
    공급가 = 소계 - 할인 + 운반비
    부가세 = int(round(공급가 * 0.1))
    합계 = 공급가 + 부가세

    오늘 = today(args)
    기존 = [r["번호"] for r in read("견적") if r["번호"].startswith(f"{오늘:%Y%m%d}")]
    번호 = f"{오늘:%Y%m%d}-{len(기존)+1:02d}"

    title(f"견적 {번호} — {args.거래처}")
    for i in 항목:
        print(f"  {i['품명']} {i['규격']}  {i['수량']}{i['단위']} × {won(i['단가'])} = {won(i['금액'])}")
    if 할인:
        print(f"  할인 {args.할인}% △{won(할인)}")
    if 운반비:
        print(f"  운반비 {won(운반비)}")
    else:
        print("  운반비 별도 — 넣으시려면 --운반비 금액")
    if 차량수 and len(적재가능) == len(항목):
        print(f"  · 차량 {차량수}대 분량 (적재수량 기준, 운반비 산정 참고용)")
    print(f"  ─ 공급가 {won(공급가)} / 부가세 {won(부가세)} / 합계 {won(합계)}")

    원가 = sum(num(품목[i['코드']].get('원가')) * i['수량'] for i in 항목)
    if 원가:
        마진 = 소계 - 할인 - 원가
        print(f"  · 마진 {won(마진)} — 원가 대비 {마진/원가*100:.1f}% / 매출 대비 "
              f"{마진/max(소계-할인,1)*100:.1f}%  (내부 참고용, 견적서에는 안 나갑니다)")

    회신 = 오늘 + dt.timedelta(days=args.회신일)
    파일 = 견적서_HTML(번호, args, 항목, 소계, 할인, 운반비, 공급가, 부가세, 합계, 오늘)
    append("견적", {
        "번호": 번호, "일자": f"{오늘:%Y-%m-%d}", "거래처": args.거래처,
        "현장": args.현장 or "", "공급가": str(공급가), "부가세": str(부가세),
        "합계": str(합계), "상태": "작성", "회신예정일": f"{회신:%Y-%m-%d}",
        "실주사유": "", "파일": os.path.relpath(파일, ROOT),
    })
    print(f"\n  견적서 → {os.path.relpath(파일, ROOT)}  (브라우저에서 열고 인쇄 → PDF)")
    print(f"  발송하면: python3 scripts/ops.py 견적상태 --번호 {번호} --상태 발송\n")


def 견적서_HTML(번호, args, 항목, 소계, 할인, 운반비, 공급가, 부가세, 합계, 오늘):
    회사 = 회사정보()
    os.makedirs(견적서_DIR, exist_ok=True)
    f = os.path.join(견적서_DIR, f"{번호}_{re.sub(r'[^가-힣A-Za-z0-9]', '', args.거래처)}.html")
    줄 = []
    for i in 항목:
        줄.append(f"<tr><td>{i['품명']}</td><td>{i['규격']}</td><td class=r>{i['수량']:,}</td>"
                  f"<td>{i['단위']}</td><td class=r>{i['단가']:,}</td><td class=r>{i['금액']:,}</td></tr>")
    if 할인:
        줄.append(f"<tr><td colspan=5>할인 {args.할인}%</td><td class=r>-{할인:,}</td></tr>")
    if 운반비:
        줄.append(f"<tr><td>운반비</td><td>{args.운반비메모 or '현장 도착도'}</td>"
                  f"<td colspan=3></td><td class=r>{운반비:,}</td></tr>")
    html = f"""<!doctype html><html lang=ko><meta charset=utf-8>
<title>견적서 {번호} {args.거래처}</title>
<style>
 @page{{size:A4;margin:16mm}}
 body{{font-family:"맑은 고딕","Malgun Gothic",sans-serif;color:#111;font-size:12px;max-width:190mm;margin:0 auto;padding:20px}}
 h1{{font-size:26px;letter-spacing:.4em;text-align:center;margin:0 0 4px}}
 .sub{{text-align:center;color:#666;margin:0 0 22px;font-size:11px}}
 .head{{display:flex;gap:20px;margin-bottom:14px}}
 .head>div{{flex:1}}
 .box{{border:1px solid #333;padding:10px}}
 .box b{{display:inline-block;width:64px;color:#555;font-weight:400}}
 table{{width:100%;border-collapse:collapse;margin-top:8px}}
 th,td{{border:1px solid #333;padding:6px 8px}}
 th{{background:#eee;font-weight:600}}
 .r{{text-align:right}}
 tfoot td{{font-weight:700;background:#f7f7f7}}
 .total{{font-size:15px}}
 .note{{margin-top:14px;border-top:1px solid #ccc;padding-top:10px;color:#444;line-height:1.8;white-space:pre-wrap}}
 @media print{{body{{padding:0}}}}
</style>
<h1>견 적 서</h1>
<p class=sub>견적번호 {번호} · 견적일 {오늘:%Y년 %m월 %d일} · 유효기간 견적일로부터 {args.유효일}일</p>
<div class=head>
 <div class=box><b>수 신</b>{args.거래처} 귀중<br><b>현 장</b>{args.현장 or '-'}<br><b>담 당</b>{args.담당 or '-'}</div>
 <div class=box><b>상 호</b>{회사.get('상호','현담토목')}<br><b>대 표</b>{회사.get('대표','')}<br>
 <b>주 소</b>{회사.get('주소','')}<br><b>연락처</b>{회사.get('연락처','')}<br><b>사업자</b>{회사.get('사업자번호','')}</div>
</div>
<p style="font-size:14px">아래와 같이 견적합니다. &nbsp; <b>합계금액 (VAT 포함) : 금 {합계:,}원</b></p>
<table>
 <thead><tr><th>품명</th><th>규격</th><th>수량</th><th>단위</th><th>단가</th><th>금액</th></tr></thead>
 <tbody>{''.join(줄)}</tbody>
 <tfoot>
  <tr><td colspan=5 class=r>공급가액</td><td class=r>{공급가:,}</td></tr>
  <tr><td colspan=5 class=r>부가세</td><td class=r>{부가세:,}</td></tr>
  <tr class=total><td colspan=5 class=r>합계</td><td class=r>{합계:,}</td></tr>
 </tfoot>
</table>
<div class=note>{회사.get('견적조건','')}</div>
</html>"""
    with open(f, "w", encoding="utf-8") as fp:
        fp.write(html)
    return f


def cmd_견적상태(args):
    rows = read("견적")
    for r in rows:
        if r["번호"] == args.번호:
            r["상태"] = args.상태
            if args.사유:
                r["실주사유"] = args.사유
            write("견적", rows)
            print(f"  견적 {args.번호} → {args.상태}")
            if args.상태 == "실주" and not args.사유:
                print("  ⚠ 실주는 사유가 자산입니다. --사유 로 남기십시오.")
            return
    sys.exit(f"견적번호 {args.번호} 를 찾을 수 없습니다.")


def 회사정보():
    p = os.path.join(ROOT, "설정", "회사정보.md")
    out = {}
    if not os.path.exists(p):
        return out
    with open(p, encoding="utf-8") as f:
        본문 = f.read()
    for m in re.finditer(r"^-\s*([^:：]+)\s*[:：]\s*(.*)$", 본문, re.M):
        out[m.group(1).strip()] = m.group(2).strip()
    m = re.search(r"##\s*견적 조건\s*\n(.*?)(?=\n##|\Z)", 본문, re.S)
    if m:
        # 설명문은 빼고 실제 인쇄될 조건(※ 로 시작하는 줄)만 가져온다.
        조건 = [l.strip() for l in m.group(1).splitlines() if l.strip().startswith("※")]
        out["견적조건"] = "\n".join(조건)
    return out

# ─────────────────────────────── 활동 · 현장 ───────────────────────────────

def cmd_활동(args):
    다음일 = ""
    if args.다음일:
        다음일 = f"{date(args.다음일) or today(args):%Y-%m-%d}"
    elif args.다음:
        다음일 = f"{today(args) + dt.timedelta(days=3):%Y-%m-%d}"
    append("활동", {
        "일자": f"{today(args):%Y-%m-%d}", "유형": args.유형, "상대": args.상대,
        "내용": args.내용, "다음액션": args.다음 or "", "다음액션일": 다음일, "완료": "",
    })
    print(f"  기록 완료 — {args.상대} / {args.유형}")
    if args.다음:
        print(f"  다음 액션: {args.다음} ({다음일})")
    else:
        print("  ⚠ 다음 액션이 없습니다. 통화 한 건은 다음 약속이 있어야 영업입니다.")


def cmd_현장(args):
    오늘 = today(args)
    rows = 실데이터(read("현장"))
    if args.미접촉:
        rows = [r for r in rows if (r.get("접촉상태") or "미접촉") == "미접촉"]
    def 키(r):
        d = date(r.get("착공예정일"))
        return (d - 오늘).days if d else 9999
    title(f"현장 레이더 — {len(rows)}건" + (" (미접촉만)" if args.미접촉 else ""))
    for r in sorted(rows, key=키):
        d = date(r.get("착공예정일"))
        dday = f"D{(d-오늘).days:+d}" if d else "  --  "
        print(f"  {dday:>7}  {r['현장명']}")
        print(f"           {r.get('발주처','')} / {r.get('시공사','')} / {r.get('거리km','?')}km / "
              f"{won(num(r.get('공사금액'))) if num(r.get('공사금액')) else '금액미상'} / {r.get('접촉상태','미접촉')}")
        if r.get("예상품목"):
            print(f"           예상품목 {r['예상품목']}")
    print()


def cmd_현장추가(args):
    append("현장", {
        "현장명": args.현장명, "발주처": args.발주처 or "", "시공사": args.시공사 or "",
        "공사금액": str(args.공사금액 or ""), "착공예정일": args.착공예정일 or "",
        "거리km": str(args.거리 or ""), "예상품목": args.예상품목 or "",
        "접촉상태": "미접촉", "다음액션": args.다음 or "자재 담당자 파악",
        "다음액션일": f"{today(args) + dt.timedelta(days=2):%Y-%m-%d}", "비고": "",
    })
    print(f"  현장 등록 — {args.현장명}")

# ─────────────────────────────── 주간 · 발송물 ───────────────────────────────

def cmd_주간(args):
    오늘 = today(args)
    시작 = 오늘 - dt.timedelta(days=args.기간)
    def 기간내(rows, key="일자"):
        return [r for r in rows if (date(r.get(key)) or dt.date(1900, 1, 1)) >= 시작]

    견적 = 기간내(read("견적"))
    활동 = 기간내(read("활동"))
    출고 = [r for r in 기간내(read("입출고")) if r["구분"] == "출고"]
    현장 = 실데이터(read("현장"))
    수주 = [r for r in 견적 if r["상태"] == "수주"]
    마감 = [r for r in 견적 if r["상태"] in ("수주", "실주")]

    title(f"KPI — 최근 {args.기간}일 ({시작:%m/%d} ~ {오늘:%m/%d})")
    print(f"  레이더 등록 현장      {len(현장)}건 (미접촉 {sum(1 for r in 현장 if (r.get('접촉상태') or '미접촉')=='미접촉')}건)")
    print(f"  접촉 활동             {len(활동)}건 " +
          " / ".join(f"{t} {sum(1 for r in 활동 if r['유형']==t)}" for t in ("전화", "방문", "카톡", "메일") if any(r['유형']==t for r in 활동)))
    print(f"  견적 발행             {len(견적)}건 {won(sum(num(r['합계']) for r in 견적))}")
    print(f"  수주                  {len(수주)}건 {won(sum(num(r['합계']) for r in 수주))}")
    print(f"  수주율                {len(수주)/len(마감)*100:.0f}%" if 마감 else "  수주율                -")
    품목수 = {}
    for r in 출고:
        품목수.setdefault(r["현장"] or r["상대처"], set()).add(r["코드"])
    if 품목수:
        print(f"  현장당 품목 수        {sum(len(v) for v in 품목수.values())/len(품목수):.1f}개")
    거래처 = 실데이터(read("거래처"))
    print(f"  거래 자재상           {sum(1 for r in 거래처 if r.get('구분')=='자재상' and r.get('상태')=='거래')}곳 "
          f"(휴면 {sum(1 for r in 거래처 if r.get('구분')=='자재상' and r.get('상태')=='휴면')}곳)")
    실주 = [r for r in 견적 if r["상태"] == "실주" and r.get("실주사유")]
    if 실주:
        print("\n  실주 사유")
        for r in 실주:
            print(f"    · {r['거래처']} {r.get('현장','')} — {r['실주사유']}")
    미이행 = [r for r in read("활동") if r.get("다음액션") and not (r.get("완료") or "").strip()
              and (date(r.get("다음액션일")) or 오늘) < 오늘]
    if 미이행:
        print(f"\n  ⚠ 기한 지난 후속조치 {len(미이행)}건 — 여기가 새는 곳입니다.")
        for r in 미이행[:8]:
            print(f"    · {r['상대']} / {r['다음액션']} ({r['다음액션일']})")
    print()


def cmd_재고공개(args):
    """대리점·거래처에 매주 뿌리는 즉시출고 가능 재고 문자."""
    품목 = 품목맵()
    오늘 = today(args)
    가능 = []
    for r in read("재고"):
        여유 = num(r["현재고"]) - num(r["안전재고"])
        if 여유 > 0:
            p = 품목.get(r["코드"], {})
            가능.append(f"· {p.get('품목명', r['코드'])} {p.get('규격','')} — {여유}{p.get('단위','개')}")
    회사 = 회사정보()
    print()
    print(f"[{회사.get('상호','현담토목')}] {오늘:%m/%d} 즉시출고 가능 재고")
    print()
    print("\n".join(가능) if 가능 else "· 현재 여유 재고 없음 (전 품목 생산 중)")
    print()
    print("필요하신 수량 회신 주시면 당일 상차 가능합니다.")
    print(f"{회사.get('연락처','')}")
    print()
    print("─" * 58)
    print("  위 내용을 그대로 복사해 대리점 단톡방·문자로 발송하십시오. (60일 실행표 D53)")
    print()

# ─────────────────────────────── 대시보드 ───────────────────────────────

def cmd_대시보드(args):
    오늘 = today(args)
    품목, 이력 = 품목맵(), read("입출고")
    재고행 = []
    for r in read("재고"):
        p = 품목.get(r["코드"], {})
        현재고, 안전 = num(r["현재고"]), num(r["안전재고"])
        비율 = min(100, int(현재고 / max(안전, 1) * 50))
        cls = "bad" if 현재고 < 안전 else ("warn" if 현재고 < 안전 * 1.5 else "ok")
        재고행.append(f"<tr><td>{p.get('품목명', r['코드'])} <span class=dim>{p.get('규격','')}</span></td>"
                      f"<td class=r>{현재고:,}</td><td class=r dim>{안전:,}</td>"
                      f"<td><div class=bar><span class={cls} style='width:{비율}%'></span></div></td></tr>")
    현장행 = []
    for r in sorted(실데이터(read("현장")), key=lambda x: (date(x.get("착공예정일")) or dt.date(2099, 1, 1))):
        d = date(r.get("착공예정일"))
        dday = f"D{(d-오늘).days:+d}" if d else "-"
        hot = " hot" if d and 0 <= (d - 오늘).days <= 45 else ""
        현장행.append(f"<tr class='{hot}'><td class=mono>{dday}</td><td>{r['현장명']}</td>"
                     f"<td class=dim>{r.get('시공사','')}</td><td class=r>{r.get('거리km','')}km</td>"
                     f"<td>{r.get('접촉상태','미접촉')}</td></tr>")
    견적 = read("견적")
    수주 = [r for r in 견적 if r["상태"] == "수주"]
    마감 = [r for r in 견적 if r["상태"] in ("수주", "실주")]
    stats = [
        ("레이더 현장", f"{len(실데이터(read('현장')))}건"),
        ("미접촉", f"{sum(1 for r in 실데이터(read('현장')) if (r.get('접촉상태') or '미접촉')=='미접촉')}건"),
        ("진행 견적", f"{sum(1 for r in 견적 if r['상태'] in ('작성','발송'))}건"),
        ("수주율", f"{len(수주)/len(마감)*100:.0f}%" if 마감 else "-"),
        ("재고 부족", f"{sum(1 for r in read('재고') if num(r['현재고']) < num(r['안전재고']))}품목"),
    ]
    html = f"""<!doctype html><html lang=ko><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>현담토목 운영 대시보드</title>
<style>
 :root{{--bg:#ECEFEE;--card:#fff;--ink:#12201E;--dim:#697472;--line:#DEE4E2;--accent:#1D5C57;--hot:#C04D18}}
 @media (prefers-color-scheme:dark){{:root{{--bg:#0E1211;--card:#161C1B;--ink:#E7ECEA;--dim:#8B9694;--line:#2B3533;--accent:#5CB0A6;--hot:#E97B45}}}}
 body{{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,"Malgun Gothic",sans-serif;padding:24px;line-height:1.6}}
 .wrap{{max-width:940px;margin:0 auto}}
 h1{{font-size:22px;margin:0 0 2px}} .date{{color:var(--dim);font-size:13px;margin:0 0 20px}}
 .stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:20px}}
 .stat{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}
 .stat b{{display:block;font-size:24px;color:var(--accent)}} .stat span{{font-size:12px;color:var(--dim)}}
 .card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:16px;overflow-x:auto}}
 h2{{font-size:15px;margin:0 0 10px}}
 table{{width:100%;border-collapse:collapse;font-size:13px}}
 th,td{{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line)}}
 th{{color:var(--dim);font-weight:500;font-size:12px}} .r{{text-align:right}}
 .dim{{color:var(--dim)}} .mono{{font-variant-numeric:tabular-nums}}
 tr.hot td:nth-child(2){{color:var(--hot);font-weight:600}}
 .bar{{height:6px;background:var(--line);border-radius:9px;overflow:hidden;min-width:80px}}
 .bar span{{display:block;height:100%}} .ok{{background:var(--accent)}} .warn{{background:#C9A227}} .bad{{background:var(--hot)}}
 .foot{{color:var(--dim);font-size:12px;text-align:center;margin-top:24px}}
</style><div class=wrap>
<h1>현담토목 운영 대시보드</h1><p class=date>{오늘:%Y년 %m월 %d일} 기준 · <code>python3 scripts/ops.py 대시보드</code> 로 갱신</p>
<div class=stats>{''.join(f'<div class=stat><b>{v}</b><span>{k}</span></div>' for k, v in stats)}</div>
<div class=card><h2>현장 레이더</h2><table><tr><th>착공</th><th>현장</th><th>시공사</th><th>거리</th><th>상태</th></tr>{''.join(현장행) or '<tr><td colspan=5 class=dim>등록된 현장이 없습니다.</td></tr>'}</table></div>
<div class=card><h2>재고</h2><table><tr><th>품목</th><th class=r>현재고</th><th class=r>안전</th><th>여유</th></tr>{''.join(재고행)}</table></div>
<p class=foot>marketing/01-수주전략.html · marketing/02-60일-실행표.html</p>
</div></html>"""
    out = os.path.join(ROOT, "대시보드.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  대시보드 갱신 → 대시보드.html")

def cmd_품목(args):
    """품목이 수백 개라 검색이 없으면 코드를 못 찾는다."""
    말 = (args.찾기 or "").lower().replace(" ", "")
    rows = read("품목")
    if 말:
        rows = [r for r in rows
                if 말 in (r["코드"] + r["대분류"] + r["품목명"] + r["규격"] + r.get("비고", ""))
                            .lower().replace(" ", "")]
    if not rows:
        print(f"  '{args.찾기}' 로 찾은 품목이 없습니다. 다른 말로 찾아보십시오.")
        return
    title(f"품목 {len(rows)}건" + (f" — '{args.찾기}'" if 말 else ""))
    for r in rows[:args.최대]:
        판, 원 = num(r["판매단가"]), num(r["원가"])
        가격 = f"판매 {판:,}" if 판 else f"원가 {원:,}"
        조달 = f" · 조달 {num(r['조달가']):,}" if num(r.get("조달가")) else ""
        print(f"  {pad(r['코드'],7)} {pad(r['품목명'],22)} {pad(r['규격'],20)} "
              f"{pad(r['단위'],4)} {가격}{조달}")
        if r.get("비고"):
            print(f"          {r['비고']}")
    if len(rows) > args.최대:
        print(f"  … 외 {len(rows)-args.최대}건. --최대 로 늘리거나 검색어를 좁히십시오.")
    print()


def 적용마진(품목행):
    """data/마진율.csv 를 위에서부터 훑어 먼저 걸리는 규칙을 쓴다."""
    건초 = 품목행.get("대분류", "") + 품목행.get("품목명", "")
    for r in read("마진율"):
        말 = (r.get("매칭어") or "").strip()
        if 말 and 말 in 건초:
            단위 = num(r.get("원단위"), 0) or None
            올림 = (r.get("올림") or "").strip().upper().startswith("Y")
            return fnum(r.get("마진율")), r.get("구분", 말), 단위, 올림
    return None, None, None, False


def cmd_판매가설정(args):
    """원가에 마진을 얹어 판매단가를 만든다. 이미 값이 있으면 --덮어쓰기 없이는 건드리지 않는다."""
    rows = read("품목")
    적용, 건너뜀, 규칙없음 = {}, 0, []
    for r in rows:
        if args.대분류 and args.대분류 not in r["대분류"]:
            continue
        원가 = num(r["원가"])
        if 원가 <= 0:
            continue
        if num(r["판매단가"]) > 0 and not args.덮어쓰기:
            건너뜀 += 1
            continue
        if args.마진 is not None:
            마진, 이름, 단위, 올림 = args.마진, f"일괄 {args.마진}%", None, False
        else:
            마진, 이름, 단위, 올림 = 적용마진(r)
            if 마진 is None:
                규칙없음.append(r["코드"])
                continue
        단위 = args.반올림 or 단위 or 100
        값 = 원가 * (1 + 마진 / 100) / 단위
        r["판매단가"] = str(int((math.ceil(값) if 올림 else round(값)) * 단위))
        적용.setdefault((이름, 마진), []).append(r)
    write("품목", rows)
    title("판매단가 설정 완료")
    for (이름, 마진), 목록 in sorted(적용.items(), key=lambda x: -x[0][1]):
        print(f"  {pad(이름, 18)} {pad(f'{마진:g}%', 5, True)}  {len(목록):>4}건")
    print(f"  {'─'*40}\n  {pad('합계', 18)} {'':>5}  {sum(len(v) for v in 적용.values()):>4}건")
    if 건너뜀:
        print(f"\n  · 이미 단가가 있는 {건너뜀}건은 그대로 두었습니다. 바꾸려면 --덮어쓰기")
    if 규칙없음:
        print(f"\n  ⚠ 마진 규칙에 안 걸린 {len(규칙없음)}건: {', '.join(규칙없음[:10])}")
        print("    data/마진율.csv 에 매칭어를 추가하십시오.")
    print("\n  개별 품목은 data/품목.csv 를 엑셀로 열어 직접 고치면 됩니다.")


# ─────────────────────────────── 정리 ───────────────────────────────

def cmd_예시삭제(args):
    지움 = 0
    for name in ("거래처", "현장"):
        rows = read(name)
        남길 = 실데이터(rows)
        지움 += len(rows) - len(남길)
        write(name, 남길)
    for name in ("품목",):
        rows = read(name)
        for r in rows:
            if (r.get("비고") or "").startswith("예시"):
                r["비고"] = ""
        write(name, rows)
    print(f"  예시 행 {지움}건 삭제, 예시 표시 정리 완료. 이제 실제 데이터를 넣으십시오.")

# ─────────────────────────────── 진입점 ───────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="현담토목 운영 OS")
    ap.add_argument("--기준일", help="오늘 대신 쓸 날짜 (테스트용)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("브리핑", help="오늘 처리할 일 전부").set_defaults(func=cmd_브리핑)
    sub.add_parser("재고", help="재고 현황과 경보").set_defaults(func=cmd_재고)
    sub.add_parser("재고공개", help="대리점 발송용 재고 문자 생성").set_defaults(func=cmd_재고공개)
    sub.add_parser("대시보드", help="대시보드.html 갱신").set_defaults(func=cmd_대시보드)
    sub.add_parser("예시삭제", help="시드로 넣은 예시 데이터 정리").set_defaults(func=cmd_예시삭제)

    p = sub.add_parser("품목", help="품목 검색 (코드·품명·규격·비고에서 찾습니다)")
    p.add_argument("--찾기", default="", help="예: 648, 사각맨홀, 유공, 트렌치")
    p.add_argument("--최대", type=int, default=40)
    p.set_defaults(func=cmd_품목)

    p = sub.add_parser("판매가설정", help="원가 + 마진으로 판매단가 일괄 생성")
    p.add_argument("--마진", type=float, help="%% (생략하면 data/마진율.csv 규칙을 씁니다)")
    p.add_argument("--대분류", default="", help="특정 대분류만 (예: 주철)")
    p.add_argument("--반올림", type=int, help="원 단위 반올림 (생략하면 마진율.csv 의 원단위)")
    p.add_argument("--덮어쓰기", action="store_true", help="이미 있는 판매단가도 다시 계산")
    p.set_defaults(func=cmd_판매가설정)

    for 이름, fn in (("입고", cmd_입고), ("출고", cmd_출고), ("조정", cmd_조정)):
        p = sub.add_parser(이름, help=f"{이름} 기록 + 재고 반영")
        p.add_argument("--코드", required=True)
        p.add_argument("--수량", type=int, required=True, help="조정은 '실사한 최종 수량'")
        p.add_argument("--상대처", default="")
        p.add_argument("--현장", default="")
        p.add_argument("--메모", default="")
        p.set_defaults(func=fn)

    p = sub.add_parser("견적", help="견적 계산 + 견적서 HTML 생성")
    p.add_argument("--거래처", required=True)
    p.add_argument("--품목", required=True, help="'HP600:120,MH1200:8' 형식")
    p.add_argument("--현장", default="")
    p.add_argument("--담당", default="")
    p.add_argument("--운반비", type=int, default=0, help="운반비 (직접 계산해서 넣으십시오)")
    p.add_argument("--운반비메모", default="", help="견적서에 찍을 운반 조건 (예: 25톤 2대 도착도)")
    p.add_argument("--할인", type=float, default=0, help="%")
    p.add_argument("--유효일", type=int, default=15)
    p.add_argument("--회신일", type=int, default=3, help="며칠 뒤에 재연락할지")
    p.set_defaults(func=cmd_견적)

    p = sub.add_parser("견적상태", help="발송/수주/실주 갱신")
    p.add_argument("--번호", required=True)
    p.add_argument("--상태", required=True, choices=["작성", "발송", "검토중", "수주", "실주"])
    p.add_argument("--사유", default="", help="실주 사유")
    p.set_defaults(func=cmd_견적상태)

    p = sub.add_parser("활동", help="전화·방문·카톡 기록과 다음 약속")
    p.add_argument("--상대", required=True)
    p.add_argument("--유형", default="전화", choices=["전화", "방문", "카톡", "메일", "기타"])
    p.add_argument("--내용", required=True)
    p.add_argument("--다음", default="", help="다음 액션")
    p.add_argument("--다음일", default="", help="YYYY-MM-DD (생략 시 3일 뒤)")
    p.set_defaults(func=cmd_활동)

    p = sub.add_parser("현장", help="현장 레이더 조회")
    p.add_argument("--미접촉", action="store_true")
    p.set_defaults(func=cmd_현장)

    p = sub.add_parser("현장추가", help="레이더에 현장 등록")
    p.add_argument("--현장명", required=True)
    p.add_argument("--발주처", default="")
    p.add_argument("--시공사", default="")
    p.add_argument("--공사금액", type=int, default=0)
    p.add_argument("--착공예정일", default="")
    p.add_argument("--거리", type=int, default=0)
    p.add_argument("--예상품목", default="")
    p.add_argument("--다음", default="")
    p.set_defaults(func=cmd_현장추가)

    p = sub.add_parser("주간", help="KPI 집계")
    p.add_argument("--기간", type=int, default=7)
    p.set_defaults(func=cmd_주간)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
