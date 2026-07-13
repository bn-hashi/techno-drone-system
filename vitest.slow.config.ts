import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * 低速統合テスト (*.slow.test.*) 専用の Vitest 設定
 *
 * 実フォント読み込み + 実 PDF レンダリングなど、1 分超かかるテストを
 * デフォルトの `npm run test` から分離する。実行は `npm run test:slow`。
 * CI では別ジョブとして実行し、通常の単体テストの高速性を保つ。
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["**/__tests__/**/*.slow.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    // 実レンダリングは 60 秒超かかりうるため全体で余裕を持たせる
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
