// 계약서 PDF (본문 + 서명란). 서명이 있으면 서명 이미지를 넣습니다.
import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import type { Contract, CompanyProfile } from "@/data/sample";

const FONT = path.join(process.cwd(), "public/fonts/NanumGothic-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "public/fonts/NanumGothic-Bold.ttf");

function dataUrlToBuffer(src?: string) {
  if (!src) return null;
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(src);
  return m ? Buffer.from(m[2], "base64") : null;
}
function logoBuffer(src?: string) {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) return dataUrlToBuffer(src);
    if (src.startsWith("/")) return fs.readFileSync(path.join(process.cwd(), "public", src));
  } catch {}
  return null;
}

export function buildContractPdf(c: Contract, company: CompanyProfile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 60, left: 55, right: 55 }, info: { Title: c.title, Author: company.name } });
    const chunks: Buffer[] = [];
    pdf.on("data", (ch: Buffer) => chunks.push(ch));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    const W = pdf.page.width - 110;

    const logo = logoBuffer(company.logo);
    if (logo) { try { pdf.image(logo, 55, 40, { fit: [120, 26] }); } catch {} }
    pdf.font(FONT).fontSize(8.5).fillColor("#666").text(`계약번호 ${c.id.toUpperCase()} · ${c.status}`, 55, 46, { width: W, align: "right" });
    pdf.moveDown(2);

    pdf.fillColor("#000");
    const lines = c.body.split("\n");
    // 첫 줄은 제목으로 크게
    const [first, ...rest] = lines;
    pdf.font(FONT_BOLD).fontSize(18).text(first.trim() || c.title, { align: "center" });
    pdf.moveDown(1);
    pdf.font(FONT).fontSize(10.5).lineGap(3);
    for (const line of rest) {
      const isHeading = /^제\d+조/.test(line.trim());
      if (isHeading) { pdf.moveDown(0.3); pdf.font(FONT_BOLD).text(line, { width: W }); pdf.font(FONT); }
      else if (!line.trim()) pdf.moveDown(0.4);
      else pdf.text(line, { width: W });
    }

    // 서명란
    pdf.moveDown(1.5);
    if (pdf.y > pdf.page.height - 170) pdf.addPage();
    const y = pdf.y;
    const half = W / 2 - 10;
    pdf.rect(55, y, half, 96).stroke("#999");
    pdf.rect(55 + half + 20, y, half, 96).stroke("#999");
    pdf.font(FONT_BOLD).fontSize(9.5).text('갑 (공급자)', 63, y + 8);
    pdf.font(FONT).fontSize(9.5).text(`${company.name}`, 63, y + 26).text(`대표 ${company.ceo}`, 63, y + 42).text(`사업자등록번호 ${company.bizNo}`, 63, y + 58).text("(인)", 55 + half - 40, y + 70);
    const rx = 55 + half + 28;
    pdf.font(FONT_BOLD).fontSize(9.5).text('을 (수요자)', rx, y + 8);
    pdf.font(FONT).fontSize(9.5).text(c.customer, rx, y + 26).text(c.customerRef ?? "", rx, y + 42);
    const sig = dataUrlToBuffer(c.signature);
    if (sig && c.signedAt) {
      try { pdf.image(sig, rx + half - 150, y + 20, { fit: [120, 50] }); } catch {}
      pdf.fontSize(8).fillColor("#444").text(`${c.signerName ?? ""} 전자서명 · ${c.signedAt.slice(0, 10)}`, rx, y + 74, { width: half - 40 });
      pdf.fillColor("#000");
    } else {
      pdf.fontSize(8).fillColor("#888").text("(서명 전)", rx, y + 74);
      pdf.fillColor("#000");
    }
    pdf.end();
  });
}
