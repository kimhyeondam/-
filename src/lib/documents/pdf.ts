// pdfkit으로 견적서·거래명세표·납품확인서 PDF를 만듭니다. (A4, 나눔고딕)
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import type { FormDoc, CompanyProfile } from "@/data/sample";
import { docSupply, docVat, docTotal, docNetSupply, toKoreanNumber, fmtDateKo } from "./calc";

const FONT = path.join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "public/fonts/NanumGothic-Bold.ttf");
const won = (n: number) => n.toLocaleString("ko-KR");

/** 로고를 파일 경로(/brand/...) 또는 data URL에서 읽어 옵니다. 실패하면 로고 없이 만듭니다. */
function loadLogo(src?: string): Buffer | null {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) {
      const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/.exec(src);
      return m ? Buffer.from(m[3], "base64") : null;
    }
    if (src.startsWith("/")) return fs.readFileSync(path.join(process.cwd(), "public", src));
  } catch {}
  return null;
}

export function buildPdf(doc: FormDoc, company: CompanyProfile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 40, info: { Title: `${doc.type} ${doc.number}`, Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const W = pdf.page.width - 80; // 본문 폭
    const L = 40;
    let y = 40;

    // 로고 + 문서번호
    const logo = loadLogo(company.logo);
    if (logo) { try { pdf.image(logo, L, y, { fit: [140, 30] }); } catch {} }
    pdf.font(FONT).fontSize(9).fillColor("#555").text(`문서번호 ${doc.number}`, L, y + 18, { width: W, align: "right" });
    y += 38;
    // 제목
    pdf.fillColor("#000").font(FONT_BOLD).fontSize(24).text(doc.type.split("").join(" "), L, y, { width: W, align: "center" });
    y += 44;

    // 수신 / 공급자 상자
    const half = W / 2 - 6;
    // 오른쪽(공급자) 칸 높이는 주소 길이에 따라 늘어남
    pdf.font(FONT).fontSize(8.5);
    const rightRowsPre = [company.name, company.ceo, company.bizNo, company.address, `${company.phone}${company.fax ? ` / FAX ${company.fax}` : ""}`, company.bizType ? `${company.bizType} / ${company.bizItem ?? ""}` : ""].filter(Boolean);
    const rightNeeded = 30 + rightRowsPre.reduce((sum, v) => sum + Math.max(13, pdf.heightOfString(v, { width: W / 2 - 6 - 70 }) + 3), 0);
    const boxH = Math.max(108, rightNeeded);
    pdf.rect(L, y, half, boxH).stroke("#999");
    pdf.rect(L + half + 12, y, half, boxH).stroke("#999");
    pdf.fillColor("#000");
    pdf.font(FONT_BOLD).fontSize(10).text("수    신", L + 8, y + 8);
    pdf.font(FONT).fontSize(10);
    const leftLines = [
      [`${doc.customer} 귀하`, true],
      [doc.customerRef ?? "", false],
      [doc.project ? `건명: ${doc.project}` : "", false],
      [doc.site ? `현장: ${doc.site}` : "", false],
      [`일자: ${fmtDateKo(doc.date)}`, false],
    ] as [string, boolean][];
    let ly = y + 24;
    leftLines.filter(([t]) => t).forEach(([t, bold]) => { pdf.font(bold ? FONT_BOLD : FONT).fontSize(bold ? 12 : 9).text(t, L + 8, ly, { width: half - 16 }); ly += bold ? 18 : 14; });

    const rx = L + half + 20;
    pdf.font(FONT_BOLD).fontSize(10).text("공 급 자", rx, y + 8);
    const rightRows = [
      ["상 호", company.name], ["대 표", company.ceo], ["등록번호", company.bizNo], ["주 소", company.address],
      ["전 화", `${company.phone}${company.fax ? ` / FAX ${company.fax}` : ""}`], ...(company.bizType ? [["업태/종목", `${company.bizType} / ${company.bizItem ?? ""}`]] : []),
    ];
    let ry = y + 24;
    rightRows.forEach(([k, v]) => {
      pdf.font(FONT).fontSize(8.5).fillColor("#555").text(k, rx, ry, { width: 52 });
      pdf.fillColor("#000").text(v, rx + 54, ry, { width: half - 70 });
      ry += Math.max(13, pdf.heightOfString(v, { width: half - 70 }) + 3);
    });
    y += boxH + 14;

    // 문구
    pdf.font(FONT).fontSize(10).fillColor("#000");
    const intro = doc.type === "견적서" ? `아래와 같이 견적합니다.${doc.validDays ? ` (유효기간: 견적일로부터 ${doc.validDays}일)` : ""}`
      : doc.type === "거래명세표" ? "아래와 같이 거래 내역을 통보합니다."
      : "아래 품목을 이상 없이 납품하였음을 확인합니다.";
    pdf.text(intro, L, y, { width: W });
    y += 20;

    // 합계 금액 한글
    const total = docTotal(doc);
    pdf.rect(L, y, W, 26).fillAndStroke("#f5f5f5", "#999");
    pdf.fillColor("#000").font(FONT_BOLD).fontSize(11).text(`합계금액 (${doc.vatIncluded ? "부가세 포함" : "부가세 별도"})`, L + 8, y + 7, { width: 160 });
    pdf.text(`일금 ${toKoreanNumber(total)}원정  (₩${won(total)})`, L + 170, y + 7, { width: W - 178, align: "right" });
    y += 36;

    // 품목 표
    const cols = [
      { t: "번호", w: 32, a: "center" as const }, { t: "품명", w: 120, a: "left" as const }, { t: "규격", w: 120, a: "left" as const }, { t: "단위", w: 36, a: "center" as const },
      { t: "수량", w: 50, a: "right" as const }, { t: "단가", w: 70, a: "right" as const }, { t: "금액", w: W - 32 - 120 - 120 - 36 - 50 - 70, a: "right" as const },
    ];
    const rowH = 20;
    const drawRow = (cells: string[], bold = false, fill?: string) => {
      let x = L;
      if (fill) pdf.rect(L, y, W, rowH).fill(fill);
      pdf.fillColor("#000");
      cells.forEach((c, i) => {
        pdf.rect(x, y, cols[i].w, rowH).stroke("#bbb");
        pdf.font(bold ? FONT_BOLD : FONT).fontSize(9).text(c, x + 4, y + 6, { width: cols[i].w - 8, align: cols[i].a, lineBreak: false, ellipsis: true });
        x += cols[i].w;
      });
      y += rowH;
    };
    drawRow(cols.map((c) => c.t), true, "#f5f5f5");
    const items = doc.items;
    const minRows = 8;
    for (let i = 0; i < Math.max(items.length, minRows); i++) {
      if (y > pdf.page.height - 160) { pdf.addPage(); y = 40; drawRow(cols.map((c) => c.t), true, "#f5f5f5"); }
      const it = items[i];
      drawRow(it ? [String(i + 1), it.name, it.spec ?? "", it.unit, won(it.qty), won(it.unitPrice), won(it.qty * it.unitPrice)] : ["", "", "", "", "", "", ""]);
    }
    // 합계 행
    const supplyLabel = doc.vatIncluded ? "공급가액(부가세 제외)" : "공급가액";
    drawRow(["", "소계", "", "", "", "", won(docSupply(items))], true, "#fafafa");
    drawRow(["", supplyLabel, "", "", "", "", won(docNetSupply(doc))], false);
    drawRow(["", "부가세", "", "", "", "", won(docVat(doc))], false);
    drawRow(["", "합계", "", "", "", "", won(total)], true, "#f5f5f5");
    y += 12;

    // 비고 / 계좌 / 서명
    if (doc.memo) { pdf.font(FONT_BOLD).fontSize(9).text("비고", L, y); pdf.font(FONT).fontSize(9).text(doc.memo, L + 40, y, { width: W - 40 }); y += Math.max(16, pdf.heightOfString(doc.memo, { width: W - 40 }) + 6); }
    if (doc.type !== "납품확인서" && company.bank) { pdf.font(FONT_BOLD).fontSize(9).text("입금계좌", L, y); pdf.font(FONT).fontSize(9).text(company.bank, L + 50, y, { width: W - 50 }); y += 18; }

    if (doc.type === "납품확인서") {
      y += 14;
      pdf.font(FONT).fontSize(10).text(`위 물품을 ${fmtDateKo(doc.date)} 정히 인수하였습니다.`, L, y, { width: W, align: "center" });
      y += 30;
      pdf.text(`인수자 : ${doc.receiver ?? "                  "}  (서명/인)`, L, y, { width: W, align: "right" });
      y += 30;
    } else {
      y += 14;
      pdf.font(FONT).fontSize(10).text(`${fmtDateKo(doc.date)}`, L, y, { width: W, align: "center" });
      y += 22;
      pdf.font(FONT_BOLD).fontSize(11).text(`${company.name}  대표 ${company.ceo}  (인)`, L, y, { width: W, align: "right" });
    }

    pdf.end();
  });
}
