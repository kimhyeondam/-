const pptxgen = require("pptxgenjs");
const path = require("path");

const OUT = process.argv[2] || "out.pptx";
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625
pres.author = "주식회사 현담토목";
pres.title = "고창 신공장 건립 사업계획 (초안 v3)";

// ---- palette (concrete + teal) ----
const INK = "1F2A2E", INK2 = "3B4746", MUTED = "6B7776", LINE = "CBD3D1";
const TEAL = "1D5C57", TEAL_SOFT = "D6E4E1", TEAL_DEEP = "143F3B";
const HOT = "C04D18", HOT_SOFT = "F0DFD4";
const BG = "F3F5F4", WHITE = "FFFFFF", SAND = "E8E3DA";
const F = "Malgun Gothic";
const CHK = { text: "[확인]", options: { color: HOT, bold: true, fontSize: 9 } };

let pageNo = 0;
const TOTAL = 19;

function base(dark = false) {
  const s = pres.addSlide();
  s.background = { color: dark ? INK : WHITE };
  pageNo += 1;
  if (!dark) {
    s.addText(`주식회사 현담토목 · 고창 신공장 건립 사업계획 · 초안 v3`, {
      x: 0.5, y: 5.28, w: 6.5, h: 0.25, fontFace: F, fontSize: 8, color: MUTED, isTextBox: true, margin: 0,
    });
    s.addText(`${pageNo} / ${TOTAL}`, {
      x: 8.5, y: 5.28, w: 1.0, h: 0.25, fontFace: F, fontSize: 8, color: MUTED, align: "right", isTextBox: true, margin: 0,
    });
  }
  return s;
}

function header(s, num, title, sub) {
  s.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.42, w: 0.46, h: 0.46, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
  s.addText(String(num), { x: 0.5, y: 0.42, w: 0.46, h: 0.46, fontFace: F, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(title, { x: 1.1, y: 0.35, w: 8.4, h: 0.5, fontFace: F, fontSize: 22, bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
  if (sub) s.addText(sub, { x: 1.1, y: 0.83, w: 8.4, h: 0.3, fontFace: F, fontSize: 11, color: MUTED, isTextBox: true, margin: 0 });
}

function card(s, x, y, w, h, fill = BG) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.06 });
}

function stat(s, x, y, w, big, label, color = TEAL, fill = BG, size = 26) {
  card(s, x, y, w, 1.05, fill);
  s.addText(big, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.55, fontFace: F, fontSize: size, bold: true, color, isTextBox: true, margin: 0, valign: "middle" });
  s.addText(label, { x: x + 0.15, y: y + 0.62, w: w - 0.3, h: 0.36, fontFace: F, fontSize: 10, color: INK2, isTextBox: true, margin: 0, valign: "top" });
}

function bullets(s, items, x, y, w, h, size = 11, color = INK2) {
  const arr = items.map((t, i) => {
    const o = typeof t === "string" ? { text: t } : t;
    return { text: o.text, options: { bullet: o.bullet === false ? false : { indent: 12 }, bold: !!o.bold, color: o.color || color, breakLine: i < items.length - 1, paraSpaceAfter: 4 } };
  });
  s.addText(arr, { x, y, w, h, fontFace: F, fontSize: size, color, isTextBox: true, margin: 0, valign: "top" });
}

function tbl(s, rows, opts) {
  const { x, y, w, colW, fontSize = 9.5, rowH = 0.28, headFill = TEAL, headColor = WHITE } = opts;
  const data = rows.map((r, ri) => r.map((c, ci) => {
    const cell = typeof c === "object" && c !== null && !Array.isArray(c) ? c : { text: String(c) };
    const o = Object.assign({ fontFace: F, fontSize, color: INK2, valign: "middle", margin: [2, 5, 2, 5] }, cell.options || {});
    if (ri === 0) Object.assign(o, { bold: true, fill: { color: headFill }, color: headColor });
    else if (ri % 2 === 0 && !o.fill) o.fill = { color: "F7F8F8" };
    return { text: cell.text, options: o };
  }));
  s.addTable(data, { x, y, w, colW, rowH, border: { type: "solid", pt: 0.5, color: LINE }, autoPage: false });
}

function src(s, text) {
  s.addText(text, { x: 0.5, y: 5.0, w: 9, h: 0.25, fontFace: F, fontSize: 8, color: MUTED, italic: true, isTextBox: true, margin: 0 });
}

const chartBase = {
  chartColors: [TEAL, HOT, "8A9391"], catAxisLabelFontFace: F, valAxisLabelFontFace: F, dataLabelFontFace: F, legendFontFace: F,
  catAxisLabelColor: INK2, valAxisLabelColor: MUTED, catAxisLabelFontSize: 9, valAxisLabelFontSize: 8,
  valGridLine: { color: "E3E7E6", size: 0.5 }, catGridLine: { style: "none" }, dataLabelFontSize: 8, dataLabelColor: INK,
  legendFontSize: 9, legendColor: INK2,
};

// =====================================================================
// 1. Cover
// =====================================================================
{
  const s = base(true);
  s.addText("중소벤처기업진흥공단 창업기업지원자금 · 시설자금 신청", { x: 0.6, y: 0.7, w: 8.8, h: 0.3, fontFace: F, fontSize: 11, color: "9FB3B0", isTextBox: true, margin: 0 });
  s.addText("고창 신공장 건립\n사업계획", { x: 0.6, y: 1.15, w: 6.5, h: 1.9, fontFace: F, fontSize: 44, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "top", lineSpacingMultiple: 1.05 });
  s.addText("콘크리트 2차제품 제조 · 맨홀 · 집수정 · 옹벽블록 · 인터로킹블록 · 수로관", { x: 0.6, y: 3.15, w: 8.8, h: 0.35, fontFace: F, fontSize: 13, color: "CFD8D6", isTextBox: true, margin: 0 });
  const chips = [["68억", "총 소요자금"], ["177.5억", "반경 50km 관급 시장 (2025)"], ["46억", "2031년 매출 목표"]];
  chips.forEach((c, i) => {
    const x = 0.6 + i * 2.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.85, w: 2.4, h: 0.95, fill: { color: "2B3A3D" }, line: { color: "2B3A3D", width: 0 }, rectRadius: 0.06 });
    s.addText(c[0], { x: x + 0.15, y: 3.9, w: 2.1, h: 0.5, fontFace: F, fontSize: 22, bold: true, color: "7FCFC4", isTextBox: true, margin: 0, valign: "middle" });
    s.addText(c[1], { x: x + 0.15, y: 4.38, w: 2.1, h: 0.35, fontFace: F, fontSize: 9.5, color: "CFD8D6", isTextBox: true, margin: 0 });
  });
  s.addText("주식회사 현담토목  ·  2026. 09  ·  초안 v3", { x: 0.6, y: 5.05, w: 8.8, h: 0.3, fontFace: F, fontSize: 10, color: "9FB3B0", isTextBox: true, margin: 0 });
  s.addNotes("표지. [확인] 제출 시점의 버전 표기와 날짜를 갱신할 것.");
}

// =====================================================================
// 2. 한 장 요약
// =====================================================================
{
  const s = base();
  header(s, "요약", "한 장 요약", "5억 매출은 시장이 아니라 공장의 한계다");
  s.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.42, w: 0.46, h: 0.46, fill: { color: HOT }, line: { color: HOT, width: 0 } });
  s.addText("★", { x: 0.5, y: 0.42, w: 0.46, h: 0.46, fontFace: F, fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  stat(s, 0.5, 1.3, 2.1, "5억", "2026년 예상 매출 (25년 3.05억)");
  stat(s, 2.8, 1.3, 2.1, "월 2,000만원", "납기 확정 불가로 놓치는 주문 (연 2.4억)", HOT, HOT_SOFT, 17);
  stat(s, 5.1, 1.3, 2.1, "177.5억", "고창 반경 50km 6개 시군 관급 발주 (2025)");
  stat(s, 7.4, 1.3, 2.1, "92~98%", "전북 관급을 전북 소재 업체가 공급하는 비율");
  const cols = [
    ["문제", ["임차 공장이라 양생·야적 면적을 늘릴 수 없음", "재고생산 불가 → 납기 확정 불가 → 월 2,000만원 미수주", "광주 소재 + KS·MAS 미등록 → 전북 관급 0원"]],
    ["해결", ["고창군 자가 공장 68억 (토지 6 · 건물 20 · 설비 42)", "7개 품목 재고생산, KS·직접생산확인·MAS 등록", "맨홀(현지 공백)·인터로킹(현지 생산자 0)부터 진입"]],
    ["결과", ["2028년 15억 → 2031년 46억 (관급 24 · 민간 22)", "2031년 가동률 57%, 관급 점유 13.5%", "이익률 15% 기준 차입 48~59억 상환 가능"]],
  ];
  cols.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 2.6, 2.9, 2.3, i === 1 ? TEAL_SOFT : BG);
    s.addText(c[0], { x: x + 0.2, y: 2.7, w: 2.5, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: TEAL, isTextBox: true, margin: 0 });
    bullets(s, c[1], x + 0.2, 3.1, 2.55, 1.7, 10.5);
  });
  s.addNotes("요약. 관급 수치는 나라장터 종합쇼핑몰 납품요구 내역 2025(최종 변경차수 기준). [확인] 이익률 15%는 2025년 결산 원가율로 확정 필요.");
}

// =====================================================================
// 3. 회사 개요
// =====================================================================
{
  const s = base();
  header(s, 1, "회사 개요", "창업 20개월, 매출 3.05억 → 5억, 거래처 7개사");
  tbl(s, [
    ["항목", "내용"],
    ["회사명", "주식회사 현담토목 (2025.01 설립, 2026.01 사명 변경)"],
    ["설립일", "2025년 1월 2일 · 업력 1년 8개월 · 창업기업 요건 충족"],
    ["소재지", "광주광역시 광산구 (IC 5분, 철골 조립식 임차 공장)"],
    ["업종 · 제품", "콘크리트 제품 제조 · 맨홀, 집수정, 자중식 옹벽블록, 수로관, 기초"],
    ["인원", "3명"],
    ["매출", "2025년 305백만원 / 2026년 500백만원 예상"],
    ["보유 형틀", "수로관 50 · 옹벽블록 28 · 사각맨홀 30 · 원형맨홀 3 (80% 운용)"],
    ["인증", "KS 미보유 → 2027년 취득 계획"],
    ["기존 정책자금", "중진공 청년전용창업자금 150백만원 (2026년 초, 정상 상환 중)"],
  ], { x: 0.5, y: 1.3, w: 5.6, colW: [1.2, 4.4], fontSize: 9.5, rowH: 0.33 });
  card(s, 6.4, 1.3, 3.1, 3.55, TEAL_SOFT);
  s.addText("대표자 역량", { x: 6.6, y: 1.4, w: 2.7, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: TEAL, isTextBox: true, margin: 0 });
  bullets(s, [
    "콘크리트 구조물 제조업 경력 12년",
    "생산관리팀장 4년 (2014~2018)",
    "품질관리팀장 4년 (2020~2024), 영업팀장 겸임",
    "품질관리담당자 자격 (한국표준협회, 2020) → KS 공장심사·MAS 등록을 직접 준비",
    "회계·생산·출고·영업 직접 운영 → 원가와 현장 요구를 동시에 파악",
  ], 6.6, 1.8, 2.75, 2.5, 10.5);
  s.addText([{ text: "대표 만 39세 이하 여부 ", options: { color: MUTED } }, CHK], { x: 6.6, y: 4.45, w: 2.7, h: 0.3, fontFace: F, fontSize: 9, isTextBox: true, margin: 0 });
  s.addNotes("[확인] 대표 연령(청년 우대), 직원 3명의 역할, 임차 여부·조건, 2026년 8월까지 실적.");
}

// =====================================================================
// 4. 사업 이력
// =====================================================================
{
  const s = base();
  header(s, 2, "사업 이력과 이번 이전의 의미", "임차 소규모 → 임차 확장 → 자가 공장 정착. 마지막 이전");
  const nodes = [
    ["2025.01", "전북 순창 창업", "소규모 임차 공장\n수로관·옹벽블록 시작"],
    ["2026.01", "광주 광산구 이전", "거래처 밀집지, 형틀 확충\n청년전용창업자금 1.5억"],
    ["2028.01", "고창 자가 공장 가동", "양생·야적 면적 확보\nKS·MAS 등록, 관급 진입"],
  ];
  s.addShape(pres.shapes.LINE, { x: 1.0, y: 2.05, w: 5.0, h: 0, line: { color: LINE, width: 2 } });
  nodes.forEach((n, i) => {
    const x = 0.5 + i * 2.2;
    const fill = i === 2 ? HOT : TEAL;
    s.addShape(pres.shapes.OVAL, { x: x + 0.38, y: 1.9, w: 0.3, h: 0.3, fill: { color: fill }, line: { color: WHITE, width: 2 } });
    s.addText(n[0], { x, y: 1.4, w: 1.9, h: 0.35, fontFace: F, fontSize: 12, bold: true, color: fill, isTextBox: true, margin: 0 });
    s.addText(n[1], { x, y: 2.35, w: 2.0, h: 0.35, fontFace: F, fontSize: 12, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(n[2], { x, y: 2.7, w: 2.0, h: 0.7, fontFace: F, fontSize: 10, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  card(s, 0.5, 3.6, 6.1, 1.3, BG);
  bullets(s, [
    "순창·광주 모두 임차·소규모라 양생장·야적장을 늘릴 수 없었음",
    "올해 초 형틀을 늘렸으나 병목은 형틀이 아니라 면적임을 8개월 만에 확인 → 시설자금 신청",
    "기존 계획(2027 KS 취득, 나라장터 등록)은 그대로, 그 실행 장소가 신공장",
  ], 0.7, 3.72, 5.8, 1.1, 10.5);
  s.addChart(pres.charts.BAR, [{ name: "매출(억원)", labels: ["2025", "2026(E)"], values: [3.05, 5.0] }], Object.assign({}, chartBase, {
    x: 6.9, y: 1.3, w: 2.6, h: 3.6, barDir: "col", showValue: true, dataLabelPosition: "outEnd", showLegend: false, showTitle: true, title: "매출 (억원)", titleFontFace: F, titleFontSize: 11, titleColor: INK2, valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 60, chartColors: [TEAL], dataLabelFormatCode: "0.00", dataLabelFontSize: 10,
  }));
  s.addNotes("심사역 예상 질문: 2년에 세 번 이전하는 이유. 답: 임차 소규모 → 임차 확장 → 자가 정착. [확인] 현 광주 공장 임차 만료 시점.");
}

// =====================================================================
// 5. 현재의 한계
// =====================================================================
{
  const s = base();
  header(s, 3, "현 사업장의 한계", "만들 수는 있는데 '언제 준다'를 못 한다");
  tbl(s, [
    ["품목 (1일 생산능력)", "1일", "월(22일)"],
    ["원형맨홀 1호 (하부·연직·상부 1조)", "4조", "88조"],
    ["사각집수정 600×600×H600", "2개", "44개"],
    ["사각집수정 300×400×H600", "2개", "44개"],
    ["사각집수정 300×400×H900", "2개", "44개"],
    ["사각집수정 1000×1000×H1000", "1개", "22개"],
    ["자중식 옹벽블록 1200×600×H600", "32EA", "704EA"],
  ], { x: 0.5, y: 1.3, w: 4.6, colW: [2.9, 0.8, 0.9], fontSize: 9.5, rowH: 0.31 });
  s.addText("보유 형틀의 80% 운용 · 월 22일 근무 기준", { x: 0.5, y: 3.5, w: 4.6, h: 0.25, fontFace: F, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0 });
  const probs = [
    ["병목은 성형이 아니라 면적", "임차 공장이라 증기양생 공간과 야적장을 늘릴 수 없음 → 재고생산 불가 → 주문 후 생산"],
    ["납기 확정 불가 → 월 2,000만원 미수주", "연 2.4억, 현재 매출의 48%. 경쟁사는 재고생산 일 50EA·납기 7일, 우리는 일 30EA"],
    ["관급 시장 0원", "광주 소재 + KS·MAS 미등록. 전북 관급 465억의 92~98%는 전북 소재 업체가 공급"],
  ];
  probs.forEach((p, i) => {
    const y = 1.3 + i * 1.2;
    card(s, 5.4, y, 4.1, 1.08, i === 1 ? HOT_SOFT : BG);
    s.addText(p[0], { x: 5.6, y: y + 0.1, w: 3.75, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: i === 1 ? HOT : TEAL, isTextBox: true, margin: 0 });
    s.addText(p[1], { x: 5.6, y: y + 0.42, w: 3.75, h: 0.6, fontFace: F, fontSize: 9.5, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addText([{ text: "이론 생산능력을 매출로 환산하면 연 10억 안팎인데 실제 출하는 5억 → 심사역이 계산기로 확인할 숫자. 병목이 면적이 맞는지 ", options: { color: MUTED } }, CHK], { x: 0.5, y: 4.0, w: 4.6, h: 0.8, fontFace: F, fontSize: 9, isTextBox: true, margin: 0, valign: "top" });
  s.addNotes("[확인] 미수주 사례 2~3건(품목·수량·시기). 병목이 양생·야적 면적이 맞는지. 현재 생산능력 대비 출하가 낮은 이유를 심사역에게 설명할 준비.");
}

// =====================================================================
// 6. 관급 시장 규모
// =====================================================================
{
  const s = base();
  header(s, 4, "관급 시장 규모 (2025년 나라장터 실측)", "전북 14개 시군 465억, 고창 반경 50km 6개 시군 177.5억");
  s.addChart(pres.charts.BAR, [
    { name: "6개 시군", labels: ["옹벽·호안블록", "배수로", "보차도블록", "맨홀"], values: [87.4, 46.1, 24.8, 19.2] },
    { name: "전북 14개 시군", labels: ["옹벽·호안블록", "배수로", "보차도블록", "맨홀"], values: [223.1, 133.5, 65.4, 42.5] },
  ], Object.assign({}, chartBase, {
    x: 0.5, y: 1.25, w: 5.6, h: 3.7, barDir: "bar", barGrouping: "clustered", showValue: true, dataLabelPosition: "outEnd", showLegend: true, legendPos: "b", valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 40, catAxisLabelFontSize: 10, dataLabelFontSize: 9, chartColors: [TEAL, "9FB3B0"],
  }));
  stat(s, 6.4, 1.25, 3.1, "465억 / 177.5억", "전북 14개 시군 / 6개 시군 발주액 (블록·배수로·맨홀)", TEAL, BG, 20);
  stat(s, 6.4, 2.45, 3.1, "92~98%", "전북 소재 업체 점유율 (블록 92 · 맨홀 95 · 배수로 98) → 사실상 도내 업체 시장", HOT, HOT_SOFT);
  stat(s, 6.4, 3.65, 3.1, "MAS 99~100%", "다수공급자계약 비중 → KS·직접생산확인·나라장터 MAS 등록이 전제", TEAL, BG, 20);
  src(s, "출처: 나라장터 종합쇼핑몰 납품요구 내역 2025.01~12, 수요기관 전북 14개 시군, 최종 변경차수 기준 집계. 6개 시군 = 고창·부안·정읍·순창·남원·임실");
  s.addNotes("취소·감량 변경분을 제외한 최종 차수 기준. 전행 합산 시 6개군 맨홀 23.6억, 배수로 55.8억으로 커지지만 심사 반박 가능성이 있어 작은 쪽을 사용.");
}

// =====================================================================
// 7. 6개군 시군별
// =====================================================================
{
  const s = base();
  header(s, 5, "6개 시군별 발주 구조", "고창·부안·정읍 서해안 축 3곳만으로 110.6억");
  const labels = ["부안군", "정읍시", "고창군", "순창군", "임실군", "남원시"];
  s.addChart(pres.charts.BAR, [
    { name: "블록", labels, values: [18.8, 28.0, 17.2, 22.0, 16.6, 9.7] },
    { name: "배수로", labels, values: [15.4, 7.8, 14.7, 2.8, 4.3, 1.1] },
    { name: "맨홀", labels, values: [4.4, 0.9, 3.4, 3.6, 2.5, 4.5] },
  ], Object.assign({}, chartBase, {
    x: 0.5, y: 1.25, w: 5.8, h: 3.7, barDir: "col", barGrouping: "stacked", showValue: true, dataLabelPosition: "ctr", dataLabelColor: WHITE, showLegend: true, legendPos: "b", valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 45, catAxisLabelFontSize: 10, chartColors: [TEAL, "5E8F8A", HOT],
  }));
  tbl(s, [
    ["시군", "블록", "배수로", "맨홀", "합계"],
    ["부안군", "18.8", "15.4", "4.4", { text: "38.6", options: { bold: true } }],
    ["정읍시", "28.0", "7.8", "0.9", { text: "36.7", options: { bold: true } }],
    ["고창군", "17.2", "14.7", "3.4", { text: "35.3", options: { bold: true } }],
    ["순창군", "22.0", "2.8", "3.6", "28.4"],
    ["임실군", "16.6", "4.3", "2.5", "23.4"],
    ["남원시", "9.7", "1.1", "4.5", "15.3"],
    [{ text: "합계", options: { bold: true } }, { text: "112.2", options: { bold: true } }, { text: "46.1", options: { bold: true } }, { text: "19.2", options: { bold: true } }, { text: "177.5", options: { bold: true, color: TEAL } }],
  ], { x: 6.6, y: 1.25, w: 2.9, colW: [0.7, 0.55, 0.6, 0.5, 0.55], fontSize: 9, rowH: 0.3 });
  s.addText("단위: 억원. 신공장 반경 30km 안의 고창·부안·정읍이 62%", { x: 6.6, y: 3.75, w: 2.9, h: 0.5, fontFace: F, fontSize: 9, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  s.addText("2차 권역(60~80km): 완주군 블록 61.7억, 김제시 배수로 39.0억", { x: 6.6, y: 4.2, w: 2.9, h: 0.5, fontFace: F, fontSize: 9, color: MUTED, isTextBox: true, margin: 0, valign: "top" });
  src(s, "출처: 나라장터 종합쇼핑몰 납품요구 내역 2025, 최종 변경차수 기준");
}

// =====================================================================
// 8. 진입 기회: 맨홀 / 인터로킹
// =====================================================================
{
  const s = base();
  header(s, 6, "진입 기회 ① 맨홀 · ② 인터로킹블록", "현지 공급이 비어 있는 두 품목부터 들어간다");
  s.addText("① 맨홀 · 6개 시군 19.2억", { x: 0.5, y: 1.25, w: 4.6, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: TEAL, isTextBox: true, margin: 0 });
  tbl(s, [
    ["업체", "소재지", "고창에서", "납품(억)"],
    ["재건콘크리트", "익산", "75km", "4.1"],
    ["서원산업", "김제", "50km", "3.9"],
    ["팔마", "완주", "80km", "2.7"],
    ["남광", "김제", "50km", "1.8"],
    ["진성이앤씨", "순창", "45km", "1.4"],
    ["상진·전일·동서 (부안 3사)", "부안", "30km", "3.6"],
    ["태산산업 · 오투", "고창 · 정읍", "0~30km", "0.7"],
  ], { x: 0.5, y: 1.6, w: 4.6, colW: [1.9, 0.9, 0.9, 0.9], fontSize: 9, rowH: 0.29 });
  card(s, 0.5, 4.0, 4.6, 0.85, HOT_SOFT);
  s.addText([{ text: "63%", options: { bold: true, fontSize: 20, color: HOT } }, { text: "  (약 12억)가 50km 밖 익산·김제·완주에서 공급. 가장 무거운 품목이라 운반비 격차가 가장 큼. 고창·부안 현지 4개사 합계 4억뿐", options: { fontSize: 9.5, color: INK2 } }], { x: 0.7, y: 4.05, w: 4.25, h: 0.75, fontFace: F, isTextBox: true, margin: 0, valign: "middle" });

  s.addText("② 인터로킹블록 · 6개 시군 24.8억", { x: 5.4, y: 1.25, w: 4.1, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: TEAL, isTextBox: true, margin: 0 });
  tbl(s, [
    ["전북 인터로킹 생산자", "소재지"],
    ["한스 · 로드텍 · 엔씨원", "전주"],
    ["신흥콘크리트", "김제"],
    ["강남기업사", "익산"],
    ["대명산업", "임실"],
    ["나대영", "무주"],
    [{ text: "고창 · 부안 · 정읍 · 순창 · 남원", options: { bold: true, color: HOT } }, { text: "0개", options: { bold: true, color: HOT } }],
  ], { x: 5.4, y: 1.6, w: 4.1, colW: [2.7, 1.4], fontSize: 9, rowH: 0.29 });
  card(s, 5.4, 4.0, 4.1, 0.85, BG);
  s.addText("현지 공급이 없으니 경기 화성 업체(이노블록)가 6개 시군에 4.9억을 납품 중. 신공장 블록 라인(1일 25,000장)이 서남권 최초 인터로킹 생산 거점", { x: 5.6, y: 4.05, w: 3.75, h: 0.75, fontFace: F, fontSize: 9.5, color: INK2, isTextBox: true, margin: 0, valign: "middle" });
  src(s, "출처: 나라장터 2025 납품요구 내역(업체 소재지는 계약시점 기준), 거리는 도로 기준 대략치");
}

// =====================================================================
// 9. 경쟁 구조
// =====================================================================
{
  const s = base();
  header(s, 7, "품목별 경쟁 구조", "가장 큰 시장(옹벽·호안블록)은 경쟁이 있고, 배수로는 현지 밀집 → 후순위");
  const cols = [
    ["옹벽·호안블록 · 6개군 87.4억", [["무일콘크리트", "정읍", "23.9", "21%"], ["해리콘크리트", "고창", "9.8", "9%"], ["미성산업", "군산", "9.6", "9%"], ["전북콘크리트조합", "전주", "8.3", "7%"], ["하나스톤 · 옥천", "순창", "11.3", "10%"]], "42개사. 주력은 대형 옹벽블록(W1000, 4.1~5.1만원)과 대형 식생블록(3.2~3.7만원). 5% 점유(4.4억)면 상위 8위권"],
    ["보차도블록 · 전북 65.4억", [["한스", "전주", "14.9", "23%"], ["로드텍", "전주", "14.8", "23%"], ["엔씨원", "전주", "14.8", "23%"], ["신흥콘크리트", "김제", "10.7", "16%"], ["강남기업사", "익산", "10.1", "15%"]], "전주 3사 과점. 6개군 24.8억은 원거리 공급 + 경기 업체 4.9억"],
    ["배수로 · 6개군 46.1억", [["대원", "정읍", "6.8", "15%"], ["동서산업", "부안", "6.4", "14%"], ["고창레미콘", "고창", "5.6", "12%"], ["태산산업", "고창", "4.3", "9%"], ["고창기업", "고창", "4.0", "9%"]], "고창 3사·부안 3사 밀집 → 운반비 우위 없음. 측구수로관은 민간·혼적용 보조 품목"],
  ];
  cols.forEach((c, i) => {
    const x = 0.5 + i * 3.05;
    s.addText(c[0], { x, y: 1.25, w: 2.9, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: TEAL, isTextBox: true, margin: 0 });
    tbl(s, [["업체", "소재", "억", "점유"], ...c[1]], { x, y: 1.58, w: 2.9, colW: [1.35, 0.55, 0.5, 0.5], fontSize: 8.5, rowH: 0.27 });
    s.addText(c[2], { x, y: 3.3, w: 2.9, h: 0.9, fontFace: F, fontSize: 9, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  card(s, 0.5, 4.25, 9.0, 0.65, TEAL_SOFT);
  s.addText([{ text: "진입 순서  ", options: { bold: true, color: TEAL } }, { text: "① 맨홀·집수정 (현지 공백)  →  ② 인터로킹 (현지 생산자 0)  →  ③ 옹벽·식생블록 (최대 시장, 5~10% 점유 목표)  →  ④ 배수로·측구 (보조)", options: { color: INK2 } }], { x: 0.7, y: 4.3, w: 8.6, h: 0.55, fontFace: F, fontSize: 10, isTextBox: true, margin: 0, valign: "middle" });
  src(s, "출처: 나라장터 2025 납품요구 내역. 점유율은 해당 범위 총액 대비");
  s.addNotes("[확인] 전북콘크리트공업협동조합 가입 가능 여부(전북 블록 관급 1위 31.9억, 조합 통한 판로).");
}

// =====================================================================
// 10. 왜 고창인가
// =====================================================================
{
  const s = base();
  header(s, 8, "왜 고창인가", "자료로 확인된 여섯 가지 이유");
  const reasons = [
    ["전북 소재 요건", "전북 관급 465억의 92~98%가 도내 업체 → 전북 이전 없이는 관급 0원"],
    ["맨홀 현지 공백", "6개군 맨홀 19.2억 중 63%가 50km 밖에서 공급 → 운반비 우위로 대체"],
    ["인터로킹 생산자 0", "서해안 축(고창·부안·정읍)에 생산자 없음, 경기 업체가 4.9억 납품"],
    ["광주 40km", "기존 거래처(광주·나주·담양·화순)와 직원 유지, 통근 가능"],
    ["서해안고속도로", "정읍·부안·김제(배수로 최대 39억)·영광·함평 커버"],
    ["면적 확보", "광주 대비 낮은 토지 단가 → 재고생산에 필요한 양생·야적 면적"],
  ];
  reasons.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.3 + row * 1.75;
    card(s, x, y, 2.9, 1.6, BG);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.42, h: 0.42, fill: { color: i < 3 ? HOT : TEAL }, line: { color: WHITE, width: 0 } });
    s.addText(String(i + 1), { x: x + 0.2, y: y + 0.2, w: 0.42, h: 0.42, fontFace: F, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
    s.addText(r[0], { x: x + 0.75, y: y + 0.2, w: 2.0, h: 0.42, fontFace: F, fontSize: 12, bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: x + 0.2, y: y + 0.72, w: 2.5, h: 0.8, fontFace: F, fontSize: 9.5, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addNotes("[확인] 고창 IC까지 거리, 광주 대비 토지 단가 비율, 고창군 기업유치 보조금·산단 임대용지 문의 결과.");
}

// =====================================================================
// 11. 신공장 개요 + 생산능력
// =====================================================================
{
  const s = base();
  header(s, 9, "신공장 개요와 생산능력", "7개 품목, 이론 능력 연 약 80억 → 계획 매출 46억은 가동률 57%");
  tbl(s, [
    ["항목", "내용"],
    ["위치", "고창군 [확인] 읍·면 · 산단/개별입지"],
    ["부지", "[확인]㎡, 매입 6억 (또는 산단 임대용지)"],
    ["건축", "생산동·증기양생장·야적장·시험실·사무동, 20억"],
    ["설비", "배처·성형라인·몰드·양생·호이스트 일괄 42억"],
    ["인원", "3명 → 2028년 [확인]명 (생산책임자·품질 포함)"],
    ["가동", "2028년 1월, 본점 이전"],
  ], { x: 0.5, y: 1.3, w: 4.0, colW: [0.8, 3.2], fontSize: 9, rowH: 0.32 });
  tbl(s, [
    ["라인", "품목", "현재/일", "신공장/일"],
    ["블록 라인 (택일)", "인터로킹블록", "-", "25,000장 (약 500㎡)"],
    ["", "보강토옹벽블록", "-", "4,000장"],
    ["", "식생블록", "-", "1,000장"],
    ["별도 라인 (동시)", "원형맨홀 1호", "4조", "10조"],
    ["", "사각집수정", "7개", "15개"],
    ["", "자중식 옹벽블록", "32EA", "32EA"],
    ["", "측구수로관", "-", "30EA"],
  ], { x: 4.8, y: 1.3, w: 4.7, colW: [1.3, 1.3, 0.7, 1.4], fontSize: 8.5, rowH: 0.27 });
  card(s, 4.8, 4.1, 4.7, 0.8, TEAL_SOFT);
  s.addText([{ text: "심사역에게는 ", options: { color: INK2 } }, { text: "\"80% 가동\"", options: { color: INK2 } }, { text: " 대신 ", options: { color: INK2 } }, { text: "\"시장 점유율로 잡은 매출이 가동률 57%\"", options: { bold: true, color: TEAL } }, { text: "라고 설명. 능력은 병목이 아님을 보여주는 숫자", options: { color: INK2 } }], { x: 5.0, y: 4.12, w: 4.3, h: 0.75, fontFace: F, fontSize: 9, isTextBox: true, margin: 0, valign: "middle" });
  s.addText([{ text: "자중식 옹벽블록이 신공장에서도 32EA인데 6개군 최대 시장(옹벽·호안 87.4억)의 주력이 대형 옹벽블록 → 라인 증설 검토 ", options: { color: MUTED } }, CHK], { x: 0.5, y: 3.7, w: 4.0, h: 1.0, fontFace: F, fontSize: 8.5, isTextBox: true, margin: 0, valign: "top" });
  s.addNotes("[확인] 부지 위치·면적, 설비 견적 내역(배처·성형·몰드·양생·호이스트 금액), 2028년 인원 계획. 이론 능력 80억은 관급 단가 기준 가정.");
}

// =====================================================================
// 12. 제품 전략 · 판매 경로
// =====================================================================
{
  const s = base();
  header(s, 10, "품목별 목표 시장과 판매 경로", "2031년 46억 = 관급 24억 + 민간 22억");
  tbl(s, [
    ["순위", "품목", "근거", "2031 목표(억)"],
    ["1", "맨홀 · 집수정", "6개군 관급 19.2억의 63%가 원거리 공급, 현지 공백", "관급 6.5 (점유 34%) + 민간 3.5 = 10"],
    ["2", "인터로킹블록", "서남권 생산자 0, 6개군 관급 24.8억", "관급 6 (24%) + 인접 3 + 민간 4 = 13"],
    ["3", "옹벽 · 식생블록", "6개군 관급 87.4억(최대), 상위 1사 21%", "관급 9 (10%) + 민간 4 = 13"],
    ["4", "배수로 · 측구", "6개군 46.1억이나 현지 7개사 밀집 → 보조", "관급 2 (4%) + 민간 2 = 4"],
    ["5", "기존 광주권", "수로관·기초·옹벽, 현 거래처 유지·확대", "6"],
    [{ text: "", options: {} }, { text: "합계", options: { bold: true } }, { text: "관급 24억 = 6개군 177.5억의 13.5%  ·  민간 22억 = 영업권역 198억의 11%", options: { bold: true, color: TEAL } }, { text: "46", options: { bold: true, color: TEAL } }],
  ], { x: 0.5, y: 1.3, w: 9.0, colW: [0.5, 1.4, 4.1, 3.0], fontSize: 9, rowH: 0.36 });
  const routes = [["관급 MAS", "2027 직접생산확인 → KS → 단체표준 → 나라장터 MAS 등록 → 2028 납품"], ["건설사 직납", "착공 전 현장 파악, 낙찰 직후 접촉 (기존 방식)"], ["대리점·자재상", "고창·정읍·부안 토목자재상 개척, 남의 발을 쓴다"], ["온라인", "스마트스토어·블로그, 민간 소량·시공 사례 축적"]];
  routes.forEach((r, i) => {
    const x = 0.5 + i * 2.28;
    card(s, x, 3.95, 2.15, 0.95, i === 0 ? TEAL_SOFT : BG);
    s.addText(r[0], { x: x + 0.15, y: 4.0, w: 1.9, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: TEAL, isTextBox: true, margin: 0 });
    s.addText(r[1], { x: x + 0.15, y: 4.3, w: 1.9, h: 0.58, fontFace: F, fontSize: 8.5, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addNotes("[확인] 민간 198억(한국물가협회, 기존 계획서) 출처 재확인. 보강토블록 4,000장/일의 민간 판로 근거(관급은 전북 전체 4.9억뿐).");
}

// =====================================================================
// 13. 매출 계획
// =====================================================================
{
  const s = base();
  header(s, 11, "매출 계획", "가동 첫해 15억, 4년차 46억");
  const labels = ["2025", "2026(E)", "2027", "2028", "2029", "2030", "2031"];
  s.addChart(pres.charts.BAR, [
    { name: "민간", labels, values: [3.05, 5, 6, 10, 15, 19, 22] },
    { name: "관급", labels, values: [0, 0, 0, 5, 12, 19, 24] },
  ], Object.assign({}, chartBase, {
    x: 0.5, y: 1.25, w: 6.0, h: 3.7, barDir: "col", barGrouping: "stacked", showValue: true, dataLabelPosition: "ctr", dataLabelColor: WHITE, dataLabelFontSize: 8, showLegend: true, legendPos: "b", valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 45, catAxisLabelFontSize: 10, chartColors: ["7FA7A2", TEAL], showTitle: true, title: "매출 (억원)", titleFontFace: F, titleFontSize: 11, titleColor: INK2,
  }));
  tbl(s, [
    ["연도", "매출", "관급", "민간", "가동률"],
    ["2027", "6", "0", "6", "현 공장"],
    ["2028", "15", "5", "10", "19%"],
    ["2029", "27", "12", "15", "34%"],
    ["2030", "38", "19", "19", "48%"],
    [{ text: "2031", options: { bold: true } }, { text: "46", options: { bold: true, color: TEAL } }, "24", "22", "57%"],
  ], { x: 6.8, y: 1.25, w: 2.7, colW: [0.6, 0.5, 0.5, 0.5, 0.6], fontSize: 9, rowH: 0.3 });
  bullets(s, [
    "2028: 맨홀·인터로킹 관급 개시, 기존 거래처 이관",
    "2029: 옹벽·식생블록 관급 추가",
    "2031 관급 24억 = 6개군 13.5%. 정읍 1개사가 블록에서 21%를 가져가는 시장",
    "가동률은 이론 능력 80억 대비",
  ], 6.8, 3.2, 2.7, 1.7, 9);
  s.addNotes("산식: 품목별 1일 능력 × 단가(가정) × 264일 × 배정률. [확인] 원형맨홀 1조 60만원, 집수정 20만원, 인터로킹 2.2만원/㎡, 보강토 7천원, 식생 3만원, 측구 8만원 가정을 실제 단가로 교체.");
}

// =====================================================================
// 14. 소요자금 · 조달
// =====================================================================
{
  const s = base();
  header(s, 12, "소요자금과 조달 계획", "총 68억 · 자기자금 9억 · 차입 59억 → 보조금·임대로 48억까지 축소가 목표");
  tbl(s, [
    ["소요자금", "금액(억)", "내용"],
    ["토지", "6", "고창군 [확인]㎡ (산단 임대 시 0)"],
    ["건물", "20", "생산동·양생장·야적장·시험실·사무동"],
    ["기계설비", "42", "배처플랜트·성형라인·몰드·양생·호이스트 일괄 (분할 불가)"],
    [{ text: "합계", options: { bold: true } }, { text: "68", options: { bold: true, color: TEAL } }, "예비비 포함 여부 [확인] · 초기 운전자금 별도"],
  ], { x: 0.5, y: 1.3, w: 4.4, colW: [1.0, 0.8, 2.6], fontSize: 9, rowH: 0.36 });
  tbl(s, [
    ["조달 (기본안)", "금액(억)", "비율"],
    ["자기자금", "9", "13%"],
    ["중진공 창업기업지원자금 (시설)", "45~50", "66~74%"],
    ["지자체 보조금", "[확인]", ""],
    ["은행 시설자금 · 보증부 · 설비리스", "9~14", ""],
    [{ text: "합계", options: { bold: true } }, { text: "68", options: { bold: true, color: TEAL } }, "100%"],
  ], { x: 5.1, y: 1.3, w: 4.4, colW: [2.6, 0.9, 0.9], fontSize: 9, rowH: 0.36 });
  s.addText("차입을 줄이는 지렛대 4가지 (자기자금 9억은 그대로)", { x: 0.5, y: 3.5, w: 9, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: TEAL, isTextBox: true, margin: 0 });
  const lev = [["지방투자촉진보조금", "전북 신·증설 유형, 설비투자 일정 비율"], ["고창군 조례 보조금", "기업유치·고용 보조금"], ["산단 임대용지", "토지 6억 → 임대료, 차입 6억 감소"], ["성형라인 리스", "중진공 차입 감소, 상환 분산"]];
  lev.forEach((l, i) => {
    const x = 0.5 + i * 2.28;
    card(s, x, 3.85, 2.15, 1.0, BG);
    s.addText(l[0], { x: x + 0.15, y: 3.9, w: 1.9, h: 0.3, fontFace: F, fontSize: 10.5, bold: true, color: INK, isTextBox: true, margin: 0 });
    s.addText(l[1], { x: x + 0.15, y: 4.2, w: 1.9, h: 0.6, fontFace: F, fontSize: 8.5, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addNotes("보조금 5억 + 토지 임대 6억이면 차입 48억 → 이익률 15%에서 필요 매출 34억. [확인] 전북도·고창군 보조금, 산단 임대용지, 설비사 리스 조건, 중진공 사전상담에서 현실적 승인 범위.");
}

// =====================================================================
// 15. 손익 · 상환
// =====================================================================
{
  const s = base();
  header(s, 13, "추정 손익과 상환 계획", "영업이익률 15% 가정 · 금리 3.5% · 4년 거치 6년 분할 · 감가상각 연 4.7억 포함");
  tbl(s, [
    ["연도", "매출", "영업이익(15%)", "감가상각", "상환 재원", "원리금 (차입 59억)", "원리금 (차입 48억)", "여유 59 / 48"],
    ["2028", "15", "2.3", "4.7", "7.0", "2.1 (이자)", "1.7", "4.9 / 5.3"],
    ["2029", "27", "4.1", "4.7", "8.8", "2.1", "1.7", "6.7 / 7.1"],
    ["2030", "38", "5.7", "4.7", "10.4", "2.1", "1.7", "8.3 / 8.7"],
    ["2031", "46", "6.9", "4.7", "11.6", "11.9 (원금 시작)", "9.7", { text: "−0.3 / 1.9", options: { bold: true, color: HOT } }],
    ["2032", "48", "7.2", "4.7", "11.9", "11.6", "9.4", "0.3 / 2.5"],
  ], { x: 0.5, y: 1.3, w: 9.0, colW: [0.7, 0.7, 1.2, 0.95, 1.0, 1.6, 1.5, 1.35], fontSize: 9, rowH: 0.34 });
  s.addText("단위: 억원", { x: 0.5, y: 3.4, w: 2, h: 0.25, fontFace: F, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0 });
  const boxes = [
    ["차입 59억", "2031년 상환 재원이 0.3억 부족. 거치기간 3년 여유분(약 20억) 적립으로 메울 수 있으나 '빠듯하다'는 평가", HOT_SOFT, HOT],
    ["차입 48억", "매년 2억 안팎 여유. 보조금·토지 임대가 성사되면 이 구조가 목표", TEAL_SOFT, TEAL],
    ["이익률 15%의 근거", "기존 계획서 19%(현 구조) − 신공장 고정비 증가분. 2025년 결산 원가율로 확정 [확인]", BG, INK],
  ];
  boxes.forEach((b, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 3.75, 2.9, 1.15, b[2]);
    s.addText(b[0], { x: x + 0.2, y: 3.82, w: 2.5, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: b[3], isTextBox: true, margin: 0 });
    s.addText(b[1], { x: x + 0.2, y: 4.12, w: 2.55, h: 0.75, fontFace: F, fontSize: 9, color: INK2, isTextBox: true, margin: 0, valign: "top" });
  });
  s.addNotes("[확인] 2025년 결산 매출원가율·영업이익률. 기존 청년전용창업자금 1.5억 상환 조건(2029~)도 표에 반영. 실제 금리·거치 조건은 공고 확인.");
}

// =====================================================================
// 16. 추진 일정
// =====================================================================
{
  const s = base();
  header(s, 14, "추진 일정", "2026년 4분기 신청 → 2027년 건축·인증 → 2028년 1분기 가동·MAS 등록");
  const steps = [
    ["2026.09~10", "사전상담 · 부지", "중진공 사전상담, 고창군 공장설립 사전검토·보조금·산단 문의, 토지 (가)계약, 설비 견적 3사"],
    ["2026.11~12", "신청 · 평가", "정책자금 신청, 기업진단·현장평가, 건축 설계"],
    ["2027.01~03", "승인 · 인허가", "대출 승인, 토지 잔금(또는 임대), 공장설립 승인·건축허가, 비산먼지·소음·폐수 신고"],
    ["2027.04~10", "건축 · 설비 발주", "공장 건축, 설비 발주(납기 4~6개월), 직접생산확인·단체표준 준비, 조합 가입"],
    ["2027.11~12", "설치 · KS 심사", "설비 설치·시운전, 형틀 111EA 이관, KS 공장심사"],
    ["2028.01~03", "가동 · MAS 등록", "본격 가동, 본점 이전, 나라장터 MAS 등록 → 관급 납품 개시"],
  ];
  s.addShape(pres.shapes.LINE, { x: 1.55, y: 1.45, w: 0, h: 3.35, line: { color: LINE, width: 2 } });
  steps.forEach((st, i) => {
    const y = 1.3 + i * 0.6;
    const fill = i >= 4 ? HOT : TEAL;
    s.addShape(pres.shapes.OVAL, { x: 1.43, y: y + 0.1, w: 0.24, h: 0.24, fill: { color: fill }, line: { color: WHITE, width: 2 } });
    s.addText(st[0], { x: 0.5, y, w: 0.9, h: 0.45, fontFace: F, fontSize: 9.5, bold: true, color: fill, isTextBox: true, margin: 0, valign: "middle", align: "right" });
    s.addText(st[1], { x: 1.85, y, w: 1.7, h: 0.45, fontFace: F, fontSize: 11, bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(st[2], { x: 3.6, y, w: 5.9, h: 0.45, fontFace: F, fontSize: 9.5, color: INK2, isTextBox: true, margin: 0, valign: "middle" });
  });
  s.addText([{ text: "MAS 등록은 KS 취득 후 심사 기간이 별도 → 2028년 1분기 관급 매출은 보수적으로 5억만 반영. 등록 소요 기간 ", options: { color: MUTED } }, CHK], { x: 0.5, y: 4.95, w: 9, h: 0.3, fontFace: F, fontSize: 8.5, isTextBox: true, margin: 0 });
}

// =====================================================================
// 17. 조직 · 위험
// =====================================================================
{
  const s = base();
  header(s, 15, "조직·고용 계획과 위험 대응", "기존 약점 '인력 채용 부실'에 자가 공장·정규 채용·지역 인력으로 답한다");
  tbl(s, [
    ["구분", "현재", "2028", "2030"],
    ["대표 (경영·품질 총괄·영업)", "1", "1", "1"],
    ["생산 (블록라인·몰드·양생)", "[확인]", "[확인]", "[확인]"],
    ["품질·시험 (KS·MAS 담당)", "0", "1", "1"],
    ["영업·관리", "[확인]", "1", "2"],
    [{ text: "합계", options: { bold: true } }, "3", "[확인]", "[확인]"],
  ], { x: 0.5, y: 1.3, w: 4.1, colW: [2.2, 0.6, 0.65, 0.65], fontSize: 9, rowH: 0.33 });
  bullets(s, [
    "생산 책임자 1명 채용(2027.3Q)이 가동의 전제",
    "고창 지역 채용 + 광주 통근권, 자동화 블록 라인으로 인원 최소화",
    "협력: 시험기관(KCL·KTR), 원자재 공급사, 설비사 A/S, 물류사, 전북콘크리트공업협동조합, 고창·정읍·부안 자재상",
  ], 0.5, 3.45, 4.1, 1.45, 9.5);
  tbl(s, [
    ["위험", "대응"],
    ["KS·MAS 등록 지연", "설계부터 KS 기준 반영, 대표 자격 보유, 2028 관급 5억으로 보수 설정"],
    ["관급 발주 감소", "민간 198억 권역 병행, 7개 품목 혼적으로 현장당 매출 방어"],
    ["공사비·설비비 상승", "예비비, 견적 3사, 리스 활용"],
    ["상환기 매출 미달", "거치기간 여유분 적립(약 20억), 보조금·임대로 차입 축소"],
    ["인력 확보", "지역 채용 + 통근권, 자동화 라인"],
    ["대표 1인 의존", "생산 책임자·품질 담당 채용, 업무 매뉴얼화"],
  ], { x: 4.9, y: 1.3, w: 4.6, colW: [1.4, 3.2], fontSize: 8.5, rowH: 0.42 });
  s.addNotes("[확인] 현재 직원 3명의 역할과 2028·2030 인원 계획.");
}

// =====================================================================
// 18. 중장기 전략
// =====================================================================
{
  const s = base();
  header(s, 16, "중장기 전략", "기존 계획서의 인증 로드맵을 신공장에서 실행한다");
  const years = [
    ["2027", "인증 · 등록", ["직접생산확인서", "KS 인증 (신공장 심사)", "단체표준 인증", "나라장터 종합쇼핑몰 MAS 등록"], TEAL],
    ["2028", "가동 · 진입", ["맨홀·인터로킹 관급 개시", "ISO 품질경영시스템", "전북콘크리트공업협동조합", "서남권 자재상 네트워크"], TEAL],
    ["2029~", "확장 · 브랜드", ["옹벽·식생블록 관급 확대", "페로니켈슬래그 배합 연구", "녹색인증, 부설연구소", "'친환경 콘크리트 기업' 브랜드"], HOT],
  ];
  years.forEach((y, i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.3, 2.9, 3.55, i === 2 ? HOT_SOFT : BG);
    s.addText(y[0], { x: x + 0.2, y: 1.4, w: 2.5, h: 0.5, fontFace: F, fontSize: 24, bold: true, color: y[3], isTextBox: true, margin: 0 });
    s.addText(y[1], { x: x + 0.2, y: 1.92, w: 2.5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: INK, isTextBox: true, margin: 0 });
    bullets(s, y[2], x + 0.2, 2.35, 2.5, 2.4, 10.5);
  });
}

// =====================================================================
// 19. Closing
// =====================================================================
{
  const s = base(true);
  s.addText("\"5억 매출은 시장이 아니라 공장의 한계입니다.\n전북에 KS 자가 공장을 지으면 관급 177억 시장의 문이 열리고,\n재고생산으로 매달 놓치던 2,000만원을 잡습니다.\"", { x: 0.7, y: 1.2, w: 8.6, h: 2.0, fontFace: F, fontSize: 18, bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle", lineSpacingMultiple: 1.3 });
  s.addText("감사합니다", { x: 0.7, y: 3.6, w: 8.6, h: 0.6, fontFace: F, fontSize: 28, bold: true, color: "7FCFC4", isTextBox: true, margin: 0 });
  s.addText("주식회사 현담토목  ·  전북특별자치도 고창군 신공장 건립 사업계획  ·  초안 v3 (2026. 09)", { x: 0.7, y: 4.4, w: 8.6, h: 0.3, fontFace: F, fontSize: 10, color: "9FB3B0", isTextBox: true, margin: 0 });
  s.addNotes("제출 전 [확인] 항목을 모두 채우고, 슬라이드 노트의 확인 사항을 정리할 것. 관급 자료 출처: 나라장터 종합쇼핑몰 납품요구 내역 2025.");
}

pres.writeFile({ fileName: OUT }).then((f) => console.log("written", f));
