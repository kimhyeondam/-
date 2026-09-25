# 설치용(홈 화면 앱) 버전 만들기: python3 workout-app/build.py
# workout-app/index.html(원본)을 감싸서 workout/index.html 로 만든다.
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'workout-app' / 'index.html').read_text(encoding='utf-8')
cut = src.index('</style>') + len('</style>')
head, body = src[:cut], src[cut:]
version = re.sub(r'\D', '', __import__('hashlib').md5(src.encode()).hexdigest())[:8]
page = f'''<!doctype html>
<html lang="ko">
<head>
{head}
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0E6B55">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="운동일지">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
<style>body{{margin:0;padding-top:env(safe-area-inset-top,0px)}}</style>
</head>
<body>
{body}
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {{}}));
</script>
</body>
</html>
'''
out = root / 'workout'
(out / 'index.html').write_text(page, encoding='utf-8')
sw = (out / 'sw.js').read_text(encoding='utf-8')
sw = re.sub(r"const VERSION = '[^']*';", f"const VERSION = 'v{version}';", sw)
(out / 'sw.js').write_text(sw, encoding='utf-8')
print('built workout/index.html', version)
