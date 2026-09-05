#!/usr/bin/env python3
"""business-plan 폴더의 마크다운(.md)을 브라우저에서 바로 열리는 HTML로 변환.

사용법:
    python3 business-plan/md2html.py business-plan/draft/사업계획서-초안-v2.md
    → 같은 폴더에 같은 이름의 .html 생성

필요 패키지: pip install markdown
"""
import html
import re
import sys
from pathlib import Path

import markdown

CSS = """
:root{
  --ground:#ECEFEE; --surface:#FBFCFB; --surface-2:#E2E7E5;
  --ink:#141A19; --ink-2:#3B4746; --muted:#66716F;
  --line:#CBD3D1; --line-soft:#DDE3E1;
  --accent:#1D5C57; --accent-soft:#D6E4E1;
  --hot:#C04D18; --hot-soft:#F0DFD4;
  --shadow:0 1px 2px rgba(20,26,25,.05);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#0E1211; --surface:#161C1B; --surface-2:#1E2625;
    --ink:#E7ECEA; --ink-2:#C0C9C7; --muted:#8B9694;
    --line:#2A3432; --line-soft:#222B2A;
    --accent:#5CB0A6; --accent-soft:#1B2E2C;
    --hot:#E97B45; --hot-soft:#2E211A;
    --shadow:0 1px 2px rgba(0,0,0,.4);
  }
}
:root[data-theme="dark"]{
  --ground:#0E1211; --surface:#161C1B; --surface-2:#1E2625;
  --ink:#E7ECEA; --ink-2:#C0C9C7; --muted:#8B9694;
  --line:#2A3432; --line-soft:#222B2A;
  --accent:#5CB0A6; --accent-soft:#1B2E2C;
  --hot:#E97B45; --hot-soft:#2E211A;
  --shadow:0 1px 2px rgba(0,0,0,.4);
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font-family:"IBM Plex Sans KR","Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  font-size:16px;line-height:1.75;-webkit-font-smoothing:antialiased;word-break:keep-all}
.wrap{max-width:1040px;margin:0 auto;padding:0 24px 96px}
.mast{border-bottom:1px solid var(--line);padding:56px 0 28px;margin-bottom:40px}
.eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 14px}
h1{font-family:"Noto Serif KR",Georgia,serif;font-weight:700;font-size:clamp(28px,4.6vw,40px);line-height:1.3;letter-spacing:-.02em;margin:0 0 10px;text-wrap:balance}
.mast h2{font-family:"IBM Plex Sans KR",sans-serif;font-weight:400;font-size:17px;color:var(--ink-2);margin:0;border:0;padding:0}
.legend{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:22px;font-size:13.5px;color:var(--ink-2)}
.toc{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:18px 22px;margin:0 0 44px;box-shadow:var(--shadow)}
.toc .k{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:8px}
.toc ol{margin:0;padding-left:20px;columns:2;column-gap:32px;font-size:14.5px}
.toc li{break-inside:avoid;margin:2px 0}
.toc a{color:var(--accent);text-decoration:none}
.toc a:hover{text-decoration:underline}
article h2{font-family:"Noto Serif KR",Georgia,serif;font-weight:700;font-size:24px;letter-spacing:-.01em;margin:56px 0 18px;padding-top:28px;border-top:1px solid var(--line-soft)}
article h3{font-size:17.5px;font-weight:600;margin:30px 0 10px;color:var(--ink)}
article h4{font-size:15.5px;font-weight:600;margin:22px 0 8px;color:var(--ink-2)}
article p{margin:0 0 14px}
article ul,article ol{margin:0 0 16px;padding-left:24px}
article li{margin:4px 0}
article li>ul,article li>ol{margin:4px 0 4px}
article blockquote{margin:0 0 20px;padding:14px 20px;background:var(--surface);border-left:3px solid var(--accent);border-radius:0 3px 3px 0;color:var(--ink-2);font-size:15px;box-shadow:var(--shadow)}
article blockquote p:last-child{margin:0}
article hr{border:0;border-top:1px solid var(--line-soft);margin:36px 0}
article hr+h2{border-top:0;padding-top:0;margin-top:0}
article strong{font-weight:600;color:var(--ink)}
article code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.9em;background:var(--surface-2);padding:1px 6px;border-radius:3px}
article pre{background:var(--surface);border:1px solid var(--line);border-radius:3px;padding:14px 18px;overflow-x:auto;font-size:13.5px;line-height:1.6}
article pre code{background:none;padding:0}
.tbl{overflow-x:auto;margin:0 0 22px;border:1px solid var(--line);border-radius:3px;background:var(--surface);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{padding:9px 13px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line-soft)}
th{background:var(--surface-2);font-weight:600;white-space:nowrap;font-size:13.5px}
tr:last-child td{border-bottom:0}
td:first-child{font-weight:500}
.chk{display:inline-block;background:var(--hot-soft);color:var(--hot);font-weight:600;font-size:.86em;padding:0 7px;border-radius:3px;white-space:nowrap}
.asm{display:inline-block;background:var(--accent-soft);color:var(--accent);font-weight:600;font-size:.86em;padding:0 7px;border-radius:3px;white-space:nowrap}
.task-list-item{list-style:none;margin-left:-20px}
@media (max-width:640px){.toc ol{columns:1}}
@media print{
  body{background:#fff;color:#000;font-size:12.5px}
  .wrap{max-width:none;padding:0}
  .toc{display:none}
  article h2{page-break-after:avoid;break-after:avoid}
  .tbl,blockquote,table{page-break-inside:avoid;break-inside:avoid}
  .chk{background:none;color:#000;text-decoration:underline}
  .asm{background:none;color:#000;font-style:italic}
}
"""


def convert(md_path: Path) -> Path:
    text = md_path.read_text(encoding="utf-8")

    # 첫 h1을 제목, 바로 뒤 h2를 부제로 분리
    title, subtitle = md_path.stem, ""
    lines = text.splitlines()
    body_start = 0
    if lines and lines[0].startswith("# "):
        title = lines[0][2:].strip()
        body_start = 1
        if len(lines) > 1 and lines[1].startswith("## "):
            subtitle = lines[1][3:].strip()
            body_start = 2
    body_md = "\n".join(lines[body_start:])

    md = markdown.Markdown(extensions=["tables", "sane_lists", "toc"],
                           extension_configs={"toc": {"toc_depth": "2"}})
    body_html = md.convert(body_md)

    # 표를 가로 스크롤 상자로 감싸기
    body_html = body_html.replace("<table>", '<div class="tbl"><table>').replace("</table>", "</table></div>")
    # [확인 ...] / (가정) 표시 강조. 백틱 안에 있던 것은 code 태그를 벗겨 통일
    body_html = re.sub(r"<code>(\[확인[^\]<]*\])</code>", r"\1", body_html)
    body_html = re.sub(r"<code>(\(가정\))</code>", r"\1", body_html)
    body_html = re.sub(r"\[확인[^\]<]*\]", lambda m: f'<span class="chk">{m.group(0)}</span>', body_html)
    body_html = body_html.replace("(가정)", '<span class="asm">(가정)</span>')
    # 체크박스 목록
    body_html = body_html.replace("<li>[ ] ", '<li class="task-list-item">☐ ').replace("<li>[x] ", '<li class="task-list-item">☑ ')

    # 목차 (h2 기준)
    toc_items = "".join(
        f'<li><a href="#{t["id"]}">{html.escape(t["name"])}</a></li>' for t in md.toc_tokens
    )
    toc_html = f'<nav class="toc"><span class="k">목차</span><ol>{toc_items}</ol></nav>' if toc_items else ""

    legend = ""
    if "[확인" in text or "(가정)" in text:
        legend = ('<div class="legend">'
                  '<span><span class="chk">[확인]</span> 대표가 채우거나 맞는지 확인할 칸</span>'
                  '<span><span class="asm">(가정)</span> 임의로 넣은 숫자, 실제 값으로 교체</span>'
                  '</div>')

    out = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&family=IBM+Plex+Sans+KR:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="mast">
    <p class="eyebrow">사업계획서 · {html.escape(md_path.stem)}</p>
    <h1>{html.escape(title)}</h1>
    {f'<h2>{html.escape(subtitle)}</h2>' if subtitle else ''}
    {legend}
  </header>
  {toc_html}
  <article>
{body_html}
  </article>
</div>
</body>
</html>
"""
    out_path = md_path.with_suffix(".html")
    out_path.write_text(out, encoding="utf-8")
    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for arg in sys.argv[1:]:
        p = convert(Path(arg))
        print("→", p)
