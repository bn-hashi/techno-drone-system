import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    // *.slow.test.* は実レンダリング等を伴う低速統合テスト。
    // デフォルト実行から除外し、`npm run test:slow` (vitest.slow.config.ts) で実行する。
    // .claude/worktrees/** はエージェント用の一時ワークツリー配下。残置すると
    // 収集対象に混入し、本タスクと無関係な失敗（config.test.ts の重複解決や
    // e2e/specs/*.spec.ts の Playwright 二重登録）を起こすため除外する。
    exclude: ["node_modules", ".next", "e2e", "**/*.slow.test.*", "**/.claude/worktrees/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**", "components/**", "lib/**", "services/**", "repositories/**", "hooks/**"],
      exclude: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**", "lib/db.ts"],
      // カバレッジ低下を防ぐラチェット閾値 (2026-07 実測: lines 51.2% / branches 88.7% /
      // functions 76.8%)。app/ のページは E2E が担当するため全体値は低めに出る。
      // 目標 80% への引き上げはテスト補強の進捗に合わせて段階的に行う。
      thresholds: {
        lines: 50,
        statements: 50,
        branches: 85,
        functions: 75,
        // Service 層はテスト規約により 90% 以上必須 (実測 95.8%)
        "services/**": {
          lines: 90,
          statements: 90,
          branches: 90,
          functions: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
