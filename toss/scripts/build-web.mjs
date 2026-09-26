// 토스 미니앱용 웹 번들 만들기: ../workout-app/index.html(원본)을 dist/로 변환
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const src = readFileSync(new URL('../../workout-app/index.html', import.meta.url), 'utf8');
const cut = src.indexOf('</style>') + '</style>'.length;
const head = src.slice(0, cut);
let body = src.slice(cut);

// 앱 본체 스크립트(마지막 <script>)를 함수로 감싸, 토스 저장소 복원이 끝난 뒤 실행되게 한다.
const open = body.lastIndexOf('<script>');
const close = body.lastIndexOf('</script>');
if (open < 0 || close < open) throw new Error('앱 스크립트를 찾지 못했어요');
body = body.slice(0, open) + '<script>\nwindow.__startApp = function(){\n' + body.slice(open + 8, close) + '\n};\n</script>\n<script src="bridge.js"></script>' + body.slice(close + 9);

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/index.html', import.meta.url), `<!doctype html>
<html lang="ko">
<head>
${head}
<meta name="theme-color" content="#0E6B55">
<style>body{margin:0}</style>
</head>
<body>
${body}
</body>
</html>
`);
await build({ entryPoints: [new URL('../src/bridge.js', import.meta.url).pathname], bundle: true, format: 'iife', target: 'es2019', minify: true,
  outfile: new URL('../dist/bridge.js', import.meta.url).pathname, logLevel: 'warning' });
console.log('dist/ 준비 완료');
