// 거래명세표 PDF: 회사에서 쓰던 엔택스 B형 서식과 같은 모양 (A4 한 장에 위 = 공급받는자 보관용(파랑), 아래 = 공급자 보관용(빨강))
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import type { FormDoc, CompanyProfile } from "@/data/sample";
import { docTotal } from "./calc";

const FONT = path.join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "public/fonts/NanumGothic-Bold.ttf");
const won = (n: number) => (n ? Math.round(n).toLocaleString("ko-KR") : "");

export interface StatementExtra {
  prevBalance?: number; // 전잔금 (이 명세표 전까지의 미수금)
  customerPhone?: string;
  customerFax?: string;
  customerAddress?: string;
  customerBizNo?: string;
}

function loadLogo(src?: string): Buffer | null {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) { const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/.exec(src); return m ? Buffer.from(m[3], "base64") : null; }
    if (src.startsWith("/")) return fs.readFileSync(path.join(process.cwd(), "public", src));
  } catch {}
  return null;
}

export function buildStatementPdf(doc: FormDoc, company: CompanyProfile, extra: StatementExtra = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 0, info: { Title: `거래명세표 ${doc.number}`, Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    const logo = loadLogo(company.logo);

    const L = 28, W = 595 - 56; // 좌우 여백 28pt
    const rows = Math.max(10, doc.items.length);
    const total = docTotal(doc);
    const prev = extra.prevBalance ?? 0;
    const qtySum = doc.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const md = (d: string) => (d && d.length >= 10 ? `${d.slice(5, 7)}${d.slice(8, 10)}` : "");

    const drawCopy = (top: number, color: string, fill: string, label: string) => {
      let y = top;
      const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) => pdf.moveTo(x1, y1).lineTo(x2, y2).lineWidth(w).strokeColor(color).stroke();
      const box = (x: number, yy: number, w: number, h: number, filled = false) => { if (filled) pdf.rect(x, yy, w, h).fillAndStroke(fill, color); else pdf.rect(x, yy, w, h).lineWidth(0.6).strokeColor(color).stroke(); };
      const txt = (t: string, x: number, yy: number, w: number, o: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; col?: string } = {}) =>
        pdf.font(o.bold ? FONT_BOLD : FONT).fontSize(o.size ?? 8.5).fillColor(o.col ?? "#111").text(t, x, yy, { width: w, align: o.align ?? "left", lineBreak: false });

      // 머리: 서식 이름 · 로고
      txt("(거래명세표 · " + company.name + ")", L, y, 200, { size: 7, col: color });
      if (logo) { try { pdf.image(logo, L + W - 90, y - 2, { fit: [90, 16] }); } catch {} }
      y += 14;

      // 제목 줄
      const titleW = 300;
      box(L, y, W, 26);
      txt("거 래 명 세 표", L + 8, y + 4, 180, { size: 17, bold: true, col: color });
      txt(`(${label})`, L + 178, y + 6, 90, { size: 7.5, col: color });
      const rx = L + titleW; // 오른쪽 일자 칸 시작
      line(rx, y, rx, y + 26);
      box(rx, y, 36, 26, true); txt("일자", rx, y + 8, 36, { size: 8, align: "center", col: color });
      txt(doc.date, rx + 38, y + 8, 82, { size: 9 });
      line(rx + 122, y, rx + 122, y + 26);
      box(rx + 122, y, 28, 26, true); txt("No", rx + 122, y + 8, 28, { size: 8, align: "center", col: color });
      txt(doc.number, rx + 152, y + 8, 100, { size: 9 });
      line(L + W - 30, y, L + W - 30, y + 26); txt("1/1", L + W - 30, y + 8, 30, { size: 8, align: "center" });
      y += 26;
      // To 연락처
      const toLine = [extra.customerPhone ? `☎ ${extra.customerPhone}` : "", extra.customerFax ? `Fax ${extra.customerFax}` : "", !extra.customerPhone && !extra.customerFax && doc.customerRef ? doc.customerRef : ""].filter(Boolean).join("  ");
      box(rx, y, W - titleW, 14); txt(`To. ${toLine}`, rx + 4, y + 3, W - titleW - 8, { size: 8 });

      // 공급자(왼쪽) / 공급받는자(오른쪽)
      const boxH = 84;
      box(L, y, titleW, boxH);
      const lab = (t: string, x: number, yy: number, w: number, h: number) => { box(x, yy, w, h, true); txt(t, x, yy + h / 2 - 5, w, { size: 8, align: "center", col: color, bold: true }); };
      // 1행: 공급자 사업자번호 / 종사업장
      lab("공 급 자", L, y, 46, 20); txt(company.bizNo, L + 50, y + 4, 120, { size: 13, bold: true });
      lab("종사업장", L + 178, y, 44, 20); line(L + 222, y, L + 222, y + 20);
      line(L, y + 20, L + titleW, y + 20);
      // 2행: 상호 / 성명
      lab("상호", L, y + 20, 22, 16); txt(company.name, L + 26, y + 23, 150, { size: 9.5, bold: true });
      lab("성명", L + 178, y + 20, 22, 16); txt(`${company.ceo}  (인)`, L + 204, y + 23, 90, { size: 9 });
      line(L, y + 36, L + titleW, y + 36);
      // 3행: 주소
      lab("주소", L, y + 36, 22, 16); txt(company.address, L + 26, y + 39, titleW - 30, { size: 8.5 });
      line(L, y + 52, L + titleW, y + 52);
      // 4행: 업태 / 종목
      lab("업태", L, y + 52, 22, 16); txt(company.bizType ?? "", L + 26, y + 55, 120, { size: 8.5 });
      lab("종목", L + 178, y + 52, 22, 16); txt(company.bizItem ?? "", L + 204, y + 55, 90, { size: 8.5 });
      line(L, y + 68, L + titleW, y + 68);
      // 5행: 전화/팩스
      lab("전화", L, y + 68, 22, 16); txt(`${company.phone}${company.fax ? `   Fax ${company.fax}` : ""}`, L + 26, y + 71, titleW - 30, { size: 8.5 });

      // 오른쪽: 공급받는자
      const rw = W - titleW;
      box(rx, y + 14, rw, boxH - 14);
      lab("공급받는자", rx, y + 14, 16, boxH - 14);
      // 세로 글자
      pdf.save(); pdf.rect(rx, y + 14, 16, boxH - 14).fillAndStroke(fill, color);
      "공급받는자".split("").forEach((ch, i) => txt(ch, rx + 3, y + 22 + i * 11, 12, { size: 7.5, col: color, bold: true }));
      pdf.restore();
      txt(doc.customer, rx + 22, y + 22, rw - 60, { size: 12, bold: true, align: "center" });
      txt("貴下", rx + rw - 34, y + 22, 30, { size: 10, bold: true, col: color });
      txt("거래해 주셔서 감사드립니다.", rx + 22, y + 42, rw - 30, { size: 8, align: "center", col: color });
      line(rx + 16, y + 56, rx + rw, y + 56);
      lab("비고", rx + 16, y + 56, 16, boxH - 14 - 42);
      txt(doc.memo ?? "", rx + 36, y + 59, rw - 130, { size: 7.5 });
      line(rx + rw - 80, y + 56, rx + rw - 80, y + boxH);
      lab("인수자", rx + rw - 80, y + 56, 26, boxH - 14 - 42); txt(doc.receiver ?? "", rx + rw - 52, y + 60, 50, { size: 8.5 });
      y += boxH;

      // 품목 표
      const cols = [["월일", 30], ["품 명 / 규 격", 172], ["단위", 26], ["수량", 34], ["단 가", 58], ["공급가액", 68], ["세 액", 58], ["비고/합계", W - 30 - 172 - 26 - 34 - 58 - 68 - 58]] as [string, number][];
      const rowH = 15;
      let x = L;
      cols.forEach(([t, w]) => { box(x, y, w, rowH, true); txt(t, x, y + 4, w, { size: 8, align: "center", col: color, bold: true }); x += w; });
      y += rowH;
      for (let i = 0; i < rows; i++) {
        const it = doc.items[i];
        const striped = i % 2 === 1;
        x = L;
        cols.forEach(([, w]) => { if (striped) pdf.rect(x, y, w, rowH).fillAndStroke(fill, color); else box(x, y, w, rowH); x += w; });
        if (it) {
          const qty = Number(it.qty) || 0, up = Number(it.unitPrice) || 0;
          const gross = qty * up;
          const supply = doc.vatIncluded ? Math.round(gross / 1.1) : gross;
          const vat = doc.vatIncluded ? gross - supply : Math.round(gross * 0.1);
          let cx = L;
          const cell = (t: string, w: number, align: "left" | "center" | "right" = "left", size = 8) => { txt(t, cx + 3, y + 4, w - 6, { size, align }); cx += w; };
          cell(md(doc.date), cols[0][1], "center");
          cell(`${it.name}${it.spec ? ` / ${it.spec}` : ""}`, cols[1][1]);
          cell(it.unit ?? "", cols[2][1], "center");
          cell(qty ? qty.toLocaleString("ko-KR") : "", cols[3][1], "right");
          cell(won(up), cols[4][1], "right");
          cell(won(supply), cols[5][1], "right");
          cell(won(vat), cols[6][1], "right");
          cell((it as { note?: string }).note ?? "", cols[7][1]);
        }
        y += rowH;
      }
      // 납품 장소·연락처
      box(L, y, W, 22);
      txt([doc.site ?? extra.customerAddress ?? "", doc.customerRef ?? ""].filter(Boolean).join("\n"), L + 4, y + 3, W - 8, { size: 8 });
      y += 22;
      // 합계 / 메모
      const sumLabelW = 40, balLabelW = 40, balW = 110;
      lab("합계", L, y, sumLabelW, 16);
      box(L + sumLabelW, y, W - sumLabelW - balLabelW - balW, 16);
      txt(`( 수량합계 : ${qtySum.toLocaleString("ko-KR")} )`, L + sumLabelW, y + 4, W - sumLabelW - balLabelW - balW - 6, { size: 8, align: "right" });
      lab("전잔금", L + W - balLabelW - balW, y, balLabelW, 16); box(L + W - balW, y, balW, 16); txt(won(prev), L + W - balW, y + 4, balW - 4, { size: 8.5, align: "right" });
      y += 16;
      lab("메모", L, y, sumLabelW, 16);
      box(L + sumLabelW, y, W - sumLabelW - balLabelW - balW, 16);
      txt(doc.project ? `건명: ${doc.project}` : "", L + sumLabelW + 4, y + 4, W - sumLabelW - balLabelW - balW - 8, { size: 8 });
      lab("총잔금", L + W - balLabelW - balW, y, balLabelW, 16); box(L + W - balW, y, balW, 16); txt(won(prev + total), L + W - balW, y + 4, balW - 4, { size: 9, align: "right", bold: true });
      y += 16;
      // 바닥: 계좌 · From
      txt(company.bank ?? "", L, y + 4, 300, { size: 7.5 });
      txt(`From, ☎ ${company.phone}${company.fax ? ` Fax ${company.fax}` : ""}${company.email ? ` ${company.email}` : ""}`, L + 280, y + 4, W - 280, { size: 7.5, align: "right" });
      return y + 16;
    };

    const end1 = drawCopy(24, "#0070f3", "#d3e5ff", "공급받는자 보관용");
    // 절취선
    const cut = end1 + 8;
    pdf.moveTo(L, cut).lineTo(L + W, cut).dash(3, { space: 3 }).lineWidth(0.5).strokeColor("#999").stroke().undash();
    drawCopy(cut + 10, "#c50000", "#f7d4d6", "공급자 보관용");
    pdf.end();
  });
}

/** 견적서 PDF: 회사 엔택스 견적서 서식 (한 장, 순번·품명/규격·단위·수량·단가·공급가액·세액·비고) */
export function buildQuotePdf(doc: FormDoc, company: CompanyProfile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 0, info: { Title: `견적서 ${doc.number}`, Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    const logo = loadLogo(company.logo);
    const L = 30, W = 595 - 60, C = "#333";
    const box = (x: number, y: number, w: number, h: number, fill?: string) => { if (fill) pdf.rect(x, y, w, h).fillAndStroke(fill, C); else pdf.rect(x, y, w, h).lineWidth(0.7).strokeColor(C).stroke(); };
    const line = (x1: number, y1: number, x2: number, y2: number) => pdf.moveTo(x1, y1).lineTo(x2, y2).lineWidth(0.7).strokeColor(C).stroke();
    const txt = (t: string, x: number, y: number, w: number, o: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; col?: string; lineBreak?: boolean } = {}) =>
      pdf.font(o.bold ? FONT_BOLD : FONT).fontSize(o.size ?? 9).fillColor(o.col ?? "#111").text(t, x, y, { width: w, align: o.align ?? "left", lineBreak: o.lineBreak ?? false });

    let y = 34;
    txt(`No. ${doc.number}`, L, y + 18, 150, { size: 8.5 });
    txt("견  적  서", L, y, W, { size: 22, bold: true, align: "center" });
    if (logo) { try { pdf.image(logo, L + W - 110, y, { fit: [110, 24] }); } catch {} }
    y += 40;

    // 공급자 상자 (왼쪽) + 수신 (오른쪽)
    const leftW = 370, boxH = 130;
    box(L, y, W, boxH);
    line(L + leftW, y, L + leftW, y + boxH);
    box(L, y, 24, boxH, "#f5f5f5");
    "공급자".split("").forEach((ch, i) => txt(ch, L + 5, y + 18 + i * 34, 14, { size: 11, bold: true }));
    const lx = L + 24, lw = leftW - 24;
    const rowsY = [0, 24, 48, 72, 100, boxH];
    rowsY.slice(1, -1).forEach((r) => line(lx, y + r, L + leftW, y + r));
    const lab = (t: string, x: number, yy: number, w: number, h: number) => { line(x + w, yy, x + w, yy + h); txt(t, x, yy + h / 2 - 5, w, { size: 8, align: "center" }); };
    lab("사업자\n등록번호", lx, y, 46, 24); txt(company.bizNo, lx + 50, y + 5, 200, { size: 13, bold: true });
    lab("상 호", lx, y + 24, 46, 24); txt(company.name, lx + 50, y + 30, 150, { size: 10 });
    line(lx + 230, y + 24, lx + 230, y + 48); lab("성명", lx + 230, y + 24, 24, 24); txt(`${company.ceo}`, lx + 258, y + 30, 70, { size: 10 }); txt("(인)", lx + lw - 28, y + 31, 26, { size: 7, col: "#666" });
    lab("사업장\n소재지", lx, y + 48, 46, 24); txt(company.address, lx + 50, y + 54, lw - 54, { size: 9 });
    lab("업  태", lx, y + 72, 46, 28); txt(company.bizType ?? "", lx + 50, y + 80, 160, { size: 9 });
    line(lx + 230, y + 72, lx + 230, y + 100); lab("종목", lx + 230, y + 72, 24, 28); txt(company.bizItem ?? "", lx + 258, y + 75, lw - 262, { size: 8, lineBreak: true });
    lab("연 락 처", lx, y + 100, 46, 30); txt(`${company.phone}${company.fax ? `   Fax ${company.fax}` : ""}`, lx + 50, y + 110, lw - 54, { size: 9.5 });
    // 오른쪽
    const rx = L + leftW + 10, rw = W - leftW - 20;
    const d = doc.date;
    txt(`일자 : ${d.slice(0, 4)}년 ${d.slice(5, 7)}월 ${d.slice(8, 10)}일`, rx, y + 8, rw, { size: 9 });
    txt(doc.customer, rx, y + 40, rw - 40, { size: 12, bold: true, align: "center" });
    txt("귀하", rx + rw - 36, y + 42, 36, { size: 10, bold: true });
    txt("아래와 같이 견적합니다.", rx, y + 96, rw, { size: 10, bold: true, align: "center" });
    y += boxH;

    // 합계금액
    const supply = doc.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
    const sup = doc.vatIncluded ? Math.round(supply / 1.1) : supply;
    const vat = doc.vatIncluded ? supply - sup : Math.round(supply * 0.1);
    box(L, y, W, 26); line(L + 180, y, L + 180, y + 26);
    txt("합계금액\n(공급가액+세액)", L, y + 3, 180, { size: 8, align: "center", lineBreak: true });
    txt(`₩${(sup + vat).toLocaleString("ko-KR")}  (${sup.toLocaleString("ko-KR")} + ${vat.toLocaleString("ko-KR")})`, L + 190, y + 7, W - 200, { size: 11, bold: true });
    y += 26;

    // 표
    const cols = [["순번", 30], ["품 명 / 규 격", 180], ["단위", 36], ["수량", 40], ["단가", 62], ["공급가액", 76], ["세  액", 62], ["비  고", W - 30 - 180 - 36 - 40 - 62 - 76 - 62]] as [string, number][];
    const rowH = 21;
    let x = L;
    cols.forEach(([t, w]) => { box(x, y, w, 24, "#f5f5f5"); txt(t, x, y + 7, w, { size: 8.5, align: "center" }); x += w; });
    y += 24;
    const memoH = 90, footerY = 842 - 70;
    const rows = Math.max(doc.items.length, Math.floor((footerY - memoH - y) / rowH));
    for (let i = 0; i < rows; i++) {
      const it = doc.items[i];
      x = L; cols.forEach(([, w]) => { box(x, y, w, rowH); x += w; });
      if (it) {
        const qty = Number(it.qty) || 0, up = Number(it.unitPrice) || 0, gross = qty * up;
        const s1 = doc.vatIncluded ? Math.round(gross / 1.1) : gross; const v1 = doc.vatIncluded ? gross - s1 : Math.round(gross * 0.1);
        let cx = L; const cell = (t: string, w: number, align: "left" | "center" | "right" = "left") => { txt(t, cx + 4, y + 6, w - 8, { size: 8.5, align }); cx += w; };
        cell(String(i + 1), cols[0][1], "center"); cell(`${it.name}${it.spec ? `/${it.spec}` : ""}`, cols[1][1]); cell(it.unit ?? "", cols[2][1], "center"); cell(qty.toLocaleString("ko-KR"), cols[3][1], "right"); cell(up.toLocaleString("ko-KR"), cols[4][1], "right"); cell(s1.toLocaleString("ko-KR"), cols[5][1], "right"); cell(v1.toLocaleString("ko-KR"), cols[6][1], "right"); cell((it as { note?: string }).note ?? "", cols[7][1]);
      }
      y += rowH;
    }
    // 비고(건명·메모) 상자
    box(L, y, W, memoH);
    txt([doc.project ?? "", doc.site && doc.site !== doc.project ? `현장: ${doc.site}` : "", doc.memo ?? "", doc.validDays ? `견적 유효기간: ${doc.validDays}일` : ""].filter(Boolean).join("\n"), L + 8, y + 8, W - 16, { size: 9, lineBreak: true });
    y += memoH + 6;
    txt(company.bank ?? "", L, y + 4, W, { size: 8.5 });
    txt("[1/1]", L, 842 - 30, W, { size: 8, align: "right" });
    pdf.end();
  });
}
