---
description: バックエンド (FastAPI) コーディング規約
globs:
  - "backend/**/*.py"
  - "api/**/*.py"
alwaysApply: false
---

# バックエンド規約

## アーキテクチャ
- レイヤード構成を厳守する: `routers/` → `services/` → `repositories/` → `models/`
- Controller (router) はリクエスト受け取りとレスポンス返却のみ
- ビジネスロジックは必ず `services/` 配下に書く
- DB アクセスは `repositories/` 経由のみ。Service から直接 ORM を呼ばない

## コードスタイル
- 型ヒント必須 (mypy strict)
- フォーマッタ: `ruff format` / リンタ: `ruff check`
- 関数は最大 50 行、循環的複雑度 10 以下
- マジックナンバー禁止。定数は `constants.py` に切り出す

## エラーハンドリング
- 業務例外は `app/exceptions.py` のカスタム例外を使う
- `except Exception:` での握りつぶしは禁止
- ログは `structlog` で構造化ログを出力する

## 禁止事項
- 生 SQL の文字列連結 (SQL インジェクション対策)
- print デバッグの残置
- `os.environ` の直接参照 (必ず `settings` 経由)