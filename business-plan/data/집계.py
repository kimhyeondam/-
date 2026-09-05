#!/usr/bin/env python3
"""나라장터 종합쇼핑몰 납품요구 내역(xlsx)을 집계한다. 01-관급시장-분석-2025.md의 숫자를 재현.

사용법: pip install pandas openpyxl && python3 business-plan/data/집계.py
방법: 같은 납품요구번호·물품순번은 '납품요구변경차수'가 가장 큰 행(최종 상태)만 남기고, 납품금액 > 0인 행만 합산.
"""
import glob, os, warnings
import pandas as pd
warnings.filterwarnings("ignore")
here = os.path.dirname(os.path.abspath(__file__))
for f in sorted(glob.glob(os.path.join(here, "2025-*.xlsx"))):
    df = pd.read_excel(f, header=4).dropna(how="all")
    for c in ("납품금액", "납품수량", "납품단가"):
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    fd = df.sort_values("납품요구변경차수").groupby(["납품요구번호", "물품순번"]).tail(1)
    fd = fd[fd["납품금액"] > 0].copy()
    fd["군"] = fd["수요기관"].str.replace("전북특별자치도 ", "")
    print("=" * 80)
    print(os.path.basename(f), f"| 전행합 {df['납품금액'].sum()/1e8:.1f}억 | 최종차수 {fd['납품금액'].sum()/1e8:.1f}억")
    print(" 세부품명:", (fd.groupby("세부품명")["납품금액"].sum() / 1e8).round(1).sort_values(ascending=False).to_dict())
    print(" 시군:", (fd.groupby("군")["납품금액"].sum() / 1e8).round(1).sort_values(ascending=False).to_dict())
    top = (fd.groupby(["업체명", "계약시점 업체소재시군구"])["납품금액"].sum() / 1e8).round(1).sort_values(ascending=False)
    print(" 업체 TOP10:")
    for (n, l), v in top.head(10).items():
        print(f"   {n:22s} {str(l).replace('전북특별자치도 ','전북 '):14s} {v:5.1f}억 {v/top.sum()*100:4.1f}%")
