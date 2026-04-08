---
description: テスト規約 (TDD 必須)
globs:
  - "**/*.test.{ts,tsx,py}"
  - "**/*_test.py"
  - "**/tests/**"
alwaysApply: true
---

# テスト規約

> ⚠️ **このファイルは ECC の `/tdd` コマンド (tdd-guide エージェント) が
> 自動的に参照します。ECC を使う場合も以下の規約は必ず遵守すること。**

## TDD サイクル (必須)
1. **Red**: 失敗するテストを先に書く
2. **Green**: テストを通す最小実装
3. **Refactor**: テストを保ったままリファクタ

## カバレッジ
- 全体カバレッジ 80% 以上を維持
- Service 層は 90% 以上必須

## テスト構成
- バックエンド: pytest + pytest-asyncio
- フロントエンド: Vitest + React Testing Library
- E2E: Playwright

## 命名規則
- `test_<対象>_<条件>_<期待結果>` の形式
  - 例: `test_create_user_with_duplicate_email_raises_error`

## テストの粒度
- 1 テスト 1 アサーション (原則)
- AAA パターン (Arrange / Act / Assert) で構造化

## 禁止事項
- テストをスキップしてのコミット (`@pytest.mark.skip` 残置)
- 本物の外部 API を叩くテスト (必ずモック化)
- テストなしでの新機能実装