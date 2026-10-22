import { defineConfig } from 'vitest/config';

// 상대 경로로 빌드해 zip을 풀어 아무 정적 서버·Capacitor 앱 안에서도 열린다.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'] },
});
