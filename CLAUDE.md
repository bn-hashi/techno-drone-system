# プロジェクト概要

本プロジェクトは [サービス名] のリポジトリです。
Claude Code は本ファイルを毎回読み込むため、簡潔に保つこと（目安: 200行未満）。

## 技術スタック
- フロントエンド：Next.js 14 (App Router) + TypeScript + Tailwind CSS
- バックエンド：Next.js API Routes（FastAPIは使わない。1プロセスに統合）
- DB：PostgreSQL（サーバー内にインストール済み。DB名: drone_school）
- ORM：Prisma（接続先: postgresql://ubuntu@localhost/drone_school）
- 動画配信：/home/ubuntu/videos/ にMP4を配置し、nginxのlocationで直接配信
- 認証：NextAuth.js（Credentials Provider、DB保存）
- PDF生成：@react-pdf/renderer（Puppeteerは使わない。本番は RAM 512MB + Swap 構成のため）
- ファイル保存：ローカルSSD（/home/ubuntu/uploads/）
- メール：Resend（環境変数 RESEND_API_KEY で設定）

## アーキテクチャ原則
- レイヤードアーキテクチャを厳守 (Controller → Service → Repository)
- ビジネスロジックは Service 層に集約する
- Controller にビジネスロジックを書かない

## 開発フロー (必須)
1. 新機能は必ず `/plan` で計画を立て、承認するまで実装に入らない
2. 実装は `/tdd` で TDD サイクルを自動実行する
3. 実装が一段落したら、`/verify` でビルド・テスト・リント・型を一括チェックし、push 前にローカルで一括チェック
4. 落ちた場合は、[エラーログをペースト]して、`/build-fix` で最小限の修正で通してください。アーキテクチャの変更は禁止です。
5. コミットは `/smart-commit`、push後、PR説明は `/pr-description`を使い、その後、GitHub上でCodeRabbit のレビューを待つ
6. マージ前に `/code-review` を実行する
7. 両方のAIレビューがクリアしたら人間が最終判断 (アーキテクチャ・
   ライブラリ追加・DB変更・事業妥当性のみ)
8. セッション終了時は `/save-session`、再開時は `/resume-session`

## ECC 利用上の注意
- ECC のコマンド (`/plan`, `/tdd`, `/code-review` 等) を優先して使う
- ECC の MCP は最小構成 (GitHub, Context7, Playwright, Memory) のみ有効化
- 不要な MCP は `disabledMcpServers` で無効化してコンテキストを節約する

## よく使うコマンド
- 起動: `make dev`
- テスト: `make test`
- Lint: `make lint`
- マイグレーション: `make migrate`

## 詳細ルール
- バックエンド規約: `.claude/rules/backend.md`
- フロントエンド規約: `.claude/rules/frontend.md`
- テスト規約: `.claude/rules/testing.md`
- ユーザーレベル共通規約: `~/.claude/rules/` (ECC が配布)

## 環境上の制約

- DIPS 連携の疎通検証はローカル dev では不可（検証環境が IP 制限。本番 Lightsail 57.181.4.59 からのみ到達可能）。DIPS 周辺の動作確認を伴う計画では、本番サーバーでの実施を前提にすること

## 禁止事項
- `rm -rf` / `git push --force` / 本番DBへの直接アクセス
- `.env` ファイルの読み取り・出力
- MCP は最終手段。CLI コマンド → skills → MCP の順で検討する

## ワークフロー原則

### プランモード
- 3ステップ以上または設計判断が必要なタスクはプランモードで開始する
- 問題が生じたらすぐに止めて再計画する（無理に進めない）
- 実装だけでなく検証にもプランモードを使う
- 最初に詳細な仕様を書いてあいまいさを減らす

### サブエージェント戦略
- メインのコンテキスト整理のためにサブエージェントを積極活用する
- 調査・探索・並列分析はサブエージェントに任せる
- 1サブエージェントにつき1タスクで集中実行する

### 自己改善ループ
- ユーザーからの修正があったら必ず `tasks/lessons.md` を更新する
- 同じミスを防ぐルールを自分で定義する

### 完了前の検証
- 動作確認なしで完了扱いにしない
- 「これをシニアエンジニアは承認するか？」と自問する
- テスト実行・ログ確認・正しさの証明を行う

### コア原則
- **シンプルさ最優先**: 変更はできるだけシンプルに。影響範囲は最小限に。
- **手抜き禁止**: 根本原因を解決する。一時的な対応は禁止。
- **最小影響**: 必要な部分だけ変更し、バグを増やさない。

## タスク管理
1. まず `tasks/todo.md` にチェック可能な形で計画を記述
2. 実装前に計画を確認
3. 完了したら都度チェック
4. 各ステップで変更の要約を書く
5. 修正後に `tasks/lessons.md` を更新