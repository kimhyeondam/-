# -*- coding: utf-8 -*-
"""
현담토목 제품을 카페24 '상품 등록용 엑셀' 형식으로 변환하는 스크립트.

실행:  python3 generate_cafe24_excel.py
결과:  현담토목_카페24_상품등록.xlsx  (같은 폴더)

시트 구성
  1) 카페24_규격별등록  : 규격 하나 = 상품 하나 (권장, 가격이 규격마다 달라도 문제 없음)
  2) 카페24_옵션형등록  : 제품군 하나 = 상품 하나 + 규격 옵션 (업로드 후 옵션별 추가금액 입력 필요)
  3) 옵션추가금액표     : 2)번 시트용 규격별 추가금액 (기본가 = 첫 번째 규격)
  4) 제품마스터_단가표  : 사람이 보는 단가표 (나라장터 식별번호 포함)
  5) 카페24_열설명      : 각 열에 무엇을 넣었는지 설명

가격을 바꾸려면 products.py의 숫자만 고치고 다시 실행하면 됩니다.
"""
import html
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from products import PRODUCTS, CATEGORIES

COMPANY = "주식회사 현담토목"
PHONE = "010-9999-1335"
FAX = "061-362-3621"
EMAIL = "khddddd@naver.com"
ADDR = "광주광역시 광산구 산월동 868-11"
HOMEPAGE = "https://hyundamtomok.wordpress.com"
LOGO = "https://hyundamtomok.wordpress.com/wp-content/uploads/2026/09/hyundam-logo.png"

# 카페24 '상품 등록용 엑셀' 열 순서 (2024~2025 양식 기준, AG=옵션사용 ~ AO=필수여부).
# 관리자에서 내려받은 양식의 열 이름이 다르면 README의 매칭표를 보고 맞춰 넣으세요.
CAFE24_COLUMNS = [
    "상품코드", "자체 상품코드", "진열상태", "판매상태", "상품분류 번호", "상품분류 신상품영역", "상품분류 추천상품영역",
    "상품명", "영문 상품명", "상품명(관리용)", "공급사 상품명", "모델명", "상품 요약설명", "상품 간략설명", "상품 상세설명",
    "모바일 상품 상세설명 설정", "모바일 상품 상세설명", "검색어설정", "과세구분", "소비자가", "공급가", "상품가", "판매가",
    "판매가 대체문구 사용", "판매가 대체문구", "주문수량 제한 기준", "최소 주문수량(이상)", "최대 주문수량(이하)",
    "적립금", "적립금 구분", "공통이벤트 정보", "성인인증",
    "옵션사용", "옵션구성방식", "옵션 표시방식", "옵션세트명", "옵션 입력", "옵션 스타일", "버튼이미지 설정", "색상 설정", "필수여부",
    "품절표시 문구", "추가입력옵션", "추가입력옵션 명칭", "추가입력옵션 선택/필수여부", "입력글자수(자)",
    "이미지등록(상세)", "이미지등록(목록)", "이미지등록(작은목록)", "이미지등록(축소)", "이미지등록(추가)",
    "제조사", "공급사", "브랜드", "트렌드", "자체분류 코드", "원산지", "상품부피(cm)", "상품소재", "영문 상품소재",
    "상품결제안내", "상품배송안내", "교환/반품안내", "서비스문의/안내",
    "배송정보", "배송방법", "국내/해외배송", "배송지역", "배송비 선결제 설정", "배송기간", "배송비 구분", "배송비입력", "스토어픽업 설정",
    "상품 전체중량(kg)", "HS코드", "상품 구분(해외통관)", "상품소재(해외통관)", "영문 상품소재(해외통관)", "옷감(해외통관)",
    "검색엔진 노출 설정", "검색엔진 노출 제목", "검색엔진 노출 작성자", "검색엔진 노출 설명", "검색엔진 노출 키워드",
    "개별결제수단설정", "상품 유효기간 사용", "상품 유효기간",
]

PAYMENT_GUIDE = ("무통장입금·카드결제 모두 가능합니다. 세금계산서가 필요하시면 주문 시 요청사항에 사업자번호와 이메일을 적어 주세요. "
                 "대량 주문(1대 차량분 이상)은 전화 견적 후 계약서 기준으로 진행합니다.")
SHIPPING_GUIDE = ("콘크리트 제품은 무게가 많이 나가 택배가 불가능하며 화물차(카고·크레인)로 배송합니다. 운반비는 착불이며 "
                  "거리·물량·차량 종류(5톤/11톤/크레인)에 따라 달라집니다. 광주광역시·전남 현장은 당일~2일, 그 외 지역은 2~4일 소요됩니다. "
                  f"하차 장비(지게차·크레인)가 없는 현장은 주문 전에 알려 주세요. 문의 {PHONE}")
RETURN_GUIDE = ("제품 특성상 단순 변심 반품은 어렵습니다. 파손·규격 오배송은 하차 전 확인 후 즉시 연락 주시면 교환해 드립니다. "
                "하차 완료 후에는 파손 책임을 판단하기 어려우니 인수 시 반드시 확인해 주세요.")
SERVICE_GUIDE = f"규격 선택·수량 계산·시공 방법 상담: 전화 {PHONE} (평일 08:00~18:00) / 팩스 {FAX} / 이메일 {EMAIL}"

CAT_NAME = dict(CATEGORIES)


def fmt_won(v):
    return f"{v:,}원"


def detail_html(p, only_option=None):
    """상품 상세설명 HTML. only_option 을 주면 그 규격 한 줄만 표에 넣는다."""
    rows = p["options"] if only_option is None else [only_option]
    esc = html.escape
    tr = ""
    for spec, price in rows:
        ident = p["ident"].get(spec, "")
        price_txt = "견적 문의" if p["quote_only"] or price == 0 else fmt_won(price)
        tr += (f"<tr><td style='border:1px solid #ccc;padding:8px'>{esc(spec)}</td>"
               f"<td style='border:1px solid #ccc;padding:8px;text-align:right'>{price_txt}</td>"
               f"<td style='border:1px solid #ccc;padding:8px;text-align:center'>{esc(ident)}</td></tr>")
    return (
        "<div style='max-width:860px;margin:0 auto;font-family:\"Malgun Gothic\",\"Apple SD Gothic Neo\",sans-serif;line-height:1.7;color:#222'>"
        f"<p style='text-align:center'><img src='{LOGO}' alt='{COMPANY}' style='max-width:180px'></p>"
        f"<h2 style='border-left:6px solid #1D5C57;padding-left:12px'>{esc(p['name'])}</h2>"
        f"<p><b>{esc(p['summary'])}</b></p>"
        f"<p>{esc(p['desc'])}</p>"
        "<h3>규격 및 단가</h3>"
        "<table style='border-collapse:collapse;width:100%'>"
        "<thead><tr style='background:#D6E4E1'><th style='border:1px solid #ccc;padding:8px'>규격</th>"
        "<th style='border:1px solid #ccc;padding:8px'>단가(부가세 포함)</th>"
        "<th style='border:1px solid #ccc;padding:8px'>나라장터 식별번호</th></tr></thead>"
        f"<tbody>{tr}</tbody></table>"
        "<p style='font-size:0.9em;color:#555'>※ 단가는 공장 상차도 기준이며 운반비는 별도(착불)입니다. 대량 주문은 별도 견적을 드립니다.</p>"
        "<h3>배송 안내</h3>"
        f"<p>{esc(SHIPPING_GUIDE)}</p>"
        "<h3>교환·반품</h3>"
        f"<p>{esc(RETURN_GUIDE)}</p>"
        "<h3>문의</h3>"
        f"<p>{esc(COMPANY)}<br>전화 {PHONE} (평일 08:00~18:00, 주말·공휴일 휴무)<br>팩스 {FAX}<br>이메일 {EMAIL}<br>"
        f"{esc(ADDR)}<br><a href='{HOMEPAGE}'>{HOMEPAGE}</a></p>"
        "</div>"
    )


def base_row(p, name, own_code, price, desc_html, model, seo_title):
    """카페24 열 순서대로 값 채우기. 비워둔 열은 관리자 기본값 사용."""
    r = {c: "" for c in CAFE24_COLUMNS}
    quote = p["quote_only"] or price == 0
    r.update({
        "상품코드": "",                      # 신규 등록 시 비움 (자동 발급)
        "자체 상품코드": own_code,
        "진열상태": "T",
        "판매상태": "T",
        "상품분류 번호": "",                 # 관리자에서 분류 만든 뒤 번호 입력 (README 참고)
        "상품명": name,
        "상품명(관리용)": name,
        "모델명": model,
        "상품 요약설명": p["summary"],
        "상품 간략설명": p["summary"],
        "상품 상세설명": desc_html,
        "모바일 상품 상세설명 설정": "F",     # F = PC 상세설명을 모바일에도 사용
        "검색어설정": p["keywords"],
        "과세구분": "A",                      # A=과세상품
        "소비자가": "" if quote else price,
        "공급가": "" if quote else price,
        "판매가": 0 if quote else price,
        "판매가 대체문구 사용": "T" if quote else "F",
        "판매가 대체문구": "견적문의" if quote else "",
        "주문수량 제한 기준": "O",            # O=주문 기준
        "최소 주문수량(이상)": 1,
        "적립금": 0,
        "적립금 구분": "W",                   # W=원
        "성인인증": "F",
        "옵션사용": "F",
        "추가입력옵션": "T",
        "추가입력옵션 명칭": "납품 현장 주소·하차장비 유무",
        "추가입력옵션 선택/필수여부": "F",     # F=선택
        "입력글자수(자)": 100,
        "제조사": COMPANY,
        "공급사": COMPANY,
        "브랜드": "현담토목",
        "자체분류 코드": p["category"],
        "원산지": "국내산(광주광역시)",
        "상품결제안내": PAYMENT_GUIDE,
        "상품배송안내": SHIPPING_GUIDE,
        "교환/반품안내": RETURN_GUIDE,
        "서비스문의/안내": SERVICE_GUIDE,
        "배송정보": "F",                      # F=기본 배송설정 사용 (관리자 배송설정에서 화물/착불 지정)
        "국내/해외배송": "A",                 # A=국내
        "배송지역": "전국지역",
        "스토어픽업 설정": "T",               # 공장 직접 수령 가능
        "검색엔진 노출 설정": "T",
        "검색엔진 노출 제목": seo_title,
        "검색엔진 노출 작성자": COMPANY,
        "검색엔진 노출 설명": p["summary"],
        "검색엔진 노출 키워드": p["keywords"],
        "상품 유효기간 사용": "F",
    })
    return r


def spec_code(spec):
    """규격 문자열을 자체 상품코드용 짧은 코드로."""
    s = spec.split(" (")[0]
    s = s.replace("×", "x").replace(" ", "").replace("/", "")
    keep = "".join(ch for ch in s if (ch.isascii() and ch.isalnum()) or ch in "x-")
    return keep[:20] or "SPEC"


def style_header(ws, ncol):
    fill = PatternFill("solid", fgColor="D6E4E1")
    for c in range(1, ncol + 1):
        cell = ws.cell(row=1, column=c)
        cell.font = Font(bold=True)
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"


def write_rows(ws, rows):
    ws.append(CAFE24_COLUMNS)
    for r in rows:
        ws.append([r[c] for c in CAFE24_COLUMNS])
    style_header(ws, len(CAFE24_COLUMNS))
    widths = {"상품명": 46, "상품 요약설명": 40, "상품 간략설명": 40, "상품 상세설명": 30, "검색어설정": 40,
              "자체 상품코드": 22, "모델명": 26, "상품결제안내": 30, "상품배송안내": 30, "교환/반품안내": 30,
              "서비스문의/안내": 30, "옵션 입력": 60, "검색엔진 노출 제목": 40, "검색엔진 노출 설명": 40, "검색엔진 노출 키워드": 40}
    for i, c in enumerate(CAFE24_COLUMNS, 1):
        ws.column_dimensions[get_column_letter(i)].width = widths.get(c, 14)


def main():
    wb = Workbook()

    # 1) 규격별 개별 상품 (권장)
    ws1 = wb.active
    ws1.title = "카페24_규격별등록"
    rows1 = []
    seen = set()
    for p in PRODUCTS:
        for spec, price in p["options"]:
            code = f"{p['code']}-{spec_code(spec)}"
            n = 2
            while code in seen:
                code = f"{p['code']}-{spec_code(spec)}-{n}"
                n += 1
            seen.add(code)
            name = f"{p['name']} {spec}"
            seo = f"{name} | {COMPANY} 광주 직접생산"
            rows1.append(base_row(p, name, code, price, detail_html(p, (spec, price)), spec, seo))
    write_rows(ws1, rows1)

    # 2) 옵션형 (제품군 1개 = 상품 1개)
    ws2 = wb.create_sheet("카페24_옵션형등록")
    rows2 = []
    addprice_rows = []
    for p in PRODUCTS:
        first_price = p["options"][0][1]
        opt_values = "|".join(spec for spec, _ in p["options"])
        r = base_row(p, p["name"], p["code"], first_price, detail_html(p), p["code"], f"{p['name']} | {COMPANY} 광주 직접생산")
        r.update({
            "옵션사용": "T",
            "옵션구성방식": "C",                 # C=조합 일체선택형
            "옵션 표시방식": "S",                # S=셀렉트박스
            "옵션 입력": f"규격{{{opt_values}}}",
            "필수여부": "T",
        })
        rows2.append(r)
        for spec, price in p["options"]:
            addprice_rows.append([p["code"], p["name"], spec, price, price - first_price if not p["quote_only"] else 0])
    write_rows(ws2, rows2)

    # 3) 옵션 추가금액표
    ws3 = wb.create_sheet("옵션추가금액표")
    ws3.append(["자체 상품코드", "상품명", "규격(옵션값)", "규격 단가", "기본가 대비 추가금액 (옵션형 등록 시 입력)"])
    for r in addprice_rows:
        ws3.append(r)
    style_header(ws3, 5)
    for i, w in enumerate([16, 40, 44, 14, 30], 1):
        ws3.column_dimensions[get_column_letter(i)].width = w

    # 4) 제품 마스터 단가표
    ws4 = wb.create_sheet("제품마스터_단가표")
    ws4.append(["분류", "자체 상품코드", "상품명", "규격", "단가(원, VAT포함)", "나라장터 식별번호", "비고"])
    for p in PRODUCTS:
        for spec, price in p["options"]:
            ws4.append([CAT_NAME[p["category"]], p["code"], p["name"], spec,
                        "견적문의" if p["quote_only"] else price, p["ident"].get(spec, ""),
                        "가격 미확정, 상담 후 견적" if p["quote_only"] else ""])
    style_header(ws4, 7)
    for i, w in enumerate([14, 16, 40, 44, 16, 16, 24], 1):
        ws4.column_dimensions[get_column_letter(i)].width = w

    # 5) 열 설명
    ws5 = wb.create_sheet("카페24_열설명")
    ws5.append(["열 이름", "이 파일에 넣은 값", "설명"])
    notes = [
        ("상품코드", "비움", "신규 등록은 비워 둡니다. 카페24가 자동으로 만들어 줍니다. (수정 업로드 때만 입력)"),
        ("자체 상품코드", "HD-… 코드", "우리 회사가 관리용으로 쓰는 코드. 나중에 가격 수정 엑셀을 올릴 때 이 코드로 찾습니다."),
        ("진열상태 / 판매상태", "T", "T=진열함/판매함, F=안 함"),
        ("상품분류 번호", "비움", "관리자 > 상품 > 분류 관리에서 분류를 먼저 만들면 번호가 생깁니다. 그 번호를 넣으면 자동 분류됩니다. 비워도 등록은 됩니다."),
        ("상품명", "제품명 + 규격", "고객에게 보이는 이름"),
        ("상품 상세설명", "HTML", "제품 설명·규격표·배송안내가 들어간 HTML. 업로드 후 이미지만 추가하면 됩니다."),
        ("검색어설정", "쉼표로 구분된 검색어", "쇼핑몰 안 검색과 네이버 노출용"),
        ("과세구분", "A", "A=과세상품, B=면세, C=영세"),
        ("판매가", "단가표 금액", "부가세 포함 판매가. 견적문의 상품은 0"),
        ("판매가 대체문구 사용 / 문구", "T + 견적문의", "가격 대신 '견적문의' 글자를 보여줍니다(견적 상품만)"),
        ("주문수량 제한 기준", "O", "O=주문 기준, P=품목 기준"),
        ("적립금 구분", "W", "W=원 단위, P=퍼센트"),
        ("옵션사용", "F 또는 T", "규격별등록 시트는 F(옵션 없음), 옵션형 시트는 T"),
        ("옵션구성방식", "C", "C=조합 일체선택형, S=조합 분리선택형, E=상품 연동형, F=독립 선택형"),
        ("옵션 입력", "규격{값1|값2|…}", "옵션명{옵션값|옵션값}. 옵션이 여럿이면 // 로 구분"),
        ("추가입력옵션", "T", "고객이 주문할 때 '납품 현장 주소·하차장비 유무'를 적을 수 있는 칸"),
        ("이미지등록(상세) 등", "비움", "카페24 웹FTP에 사진을 올린 뒤 파일 이름만 적습니다. 사진이 준비되면 상품 수정 화면에서 올려도 됩니다."),
        ("배송정보", "F", "F=쇼핑몰 기본 배송 설정 사용. 관리자 > 설정 > 배송 설정에서 '화물배송/착불'을 기본으로 지정해 두세요."),
        ("스토어픽업 설정", "T", "공장에서 직접 가져가는 손님을 위해 켬"),
        ("검색엔진 노출 …", "제목/설명/키워드", "네이버·구글 검색 노출용 문구"),
    ]
    for n in notes:
        ws5.append(list(n))
    style_header(ws5, 3)
    for i, w in enumerate([26, 26, 90], 1):
        ws5.column_dimensions[get_column_letter(i)].width = w

    out = "현담토목_카페24_상품등록.xlsx"
    wb.save(out)
    print(f"saved {out}: {len(rows1)} 규격별 상품, {len(rows2)} 옵션형 상품")


if __name__ == "__main__":
    main()
