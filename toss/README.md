# 토스 미니앱(앱인토스) 버전

`workout-app/index.html`(원본)을 토스 미니앱으로 포장해요.

## 만드는 법
```bash
cd toss
npm install
npm run build      # dist/ 생성 후 plate-log.ait 파일이 만들어짐
```

- `apps-in-toss.config.ts`의 `appName`은 앱인토스 콘솔에 등록한 앱 이름과 같아야 해요.
- `src/bridge.js`: 기록을 토스 저장소에도 보관하고, 바깥 링크(유튜브)를 `Device.openURL`로 열어요.
- 만들어진 `.ait` 파일을 앱인토스 콘솔 → 앱 → 번들 업로드에 올리면 돼요.
