import { defineConfig } from '@apps-in-toss/web-framework/config';

// appName은 앱인토스 콘솔에 등록한 앱 이름(영문 케밥-케이스)과 같아야 해요.
export default defineConfig({
  appName: 'plate-log',
  brand: { primaryColor: '#0E6B55' },
  permissions: [],
  navigationBar: { withBackButton: true, withHomeButton: true },
  webBundleDir: 'dist',
});
