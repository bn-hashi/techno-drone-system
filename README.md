# techno-drone-system

ドローンスクール（登録講習機関）向けの受講管理システム。受講者管理・入学申請・動画受講・修了確認試験・修了証明書発行・DIPS 2.0 連携・飛行管理（機体/飛行計画/飛行日誌）までを 1 つの Next.js アプリケーションで提供する。

## 技術スタック

- **フロントエンド / バックエンド**: Next.js 14 (App Router) + TypeScript + Tailwind CSS（API Routes に統合、別プロセスなし）
- **DB / ORM**: PostgreSQL + Prisma（`@prisma/adapter-pg`）
- **認証**: NextAuth.js（Credentials Provider、JWT セッション）
- **PDF 生成**: `@react-pdf/renderer`（NotoSansJP 埋め込み）
- **メール**: Resend
- **テスト**: Vitest + React Testing Library（単体）/ Playwright（E2E）

## アーキテクチャ

レイヤードアーキテクチャを厳守する（詳細は `CLAUDE.md` と `.claude/rules/` を参照）。

```
app/            ルーティング・API Route Handlers（Controller 層）
services/       ビジネスロジック（Service 層）
repositories/   Prisma 経由の DB アクセス（Repository 層）
components/     UI コンポーネント（admin / student / flight / ui ほか）
lib/            横断ユーティリティ（auth / dips / pdf / zod / api クライアントほか）
hooks/          カスタムフック
e2e/            Playwright E2E（specs / pages / fixtures）
__tests__/      Vitest 単体テスト（本番コードと同じ構造でミラー）
```

## セットアップ

```bash
npm ci
npx prisma generate

# 開発 DB (drone_school) を用意して .env.local に DATABASE_URL 等を設定
make migrate   # マイグレーション適用
make seed      # 管理者・科目マスタ等の初期データ投入 (SEED_ADMIN_PASSWORD が必要)

make dev       # http://localhost:3000
```

必要な環境変数は `.env.local`（gitignore 対象）で管理する。主なもの: `DATABASE_URL` / `NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `APP_BASE_URL` / `INVITE_TOKEN_SECRET` / `RESEND_API_KEY` / `SEED_ADMIN_PASSWORD`。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `make dev` | 開発サーバー起動 |
| `make test` | 単体テスト（高速スイート） |
| `make test-slow` | 低速統合テスト（PDF 実レンダリング等、`*.slow.test.*`） |
| `make test-coverage` | カバレッジ付き単体テスト（閾値チェックあり） |
| `make lint` | ESLint + `tsc --noEmit` |
| `make verify` | build + lint + test の一括チェック（push 前に実行） |
| `make e2e` | Playwright E2E（下記のテスト DB 設定が必要） |
| `make migrate` / `make seed` | マイグレーション / シード |

## E2E テスト（ローカル）

E2E は開発 DB と分離した専用 DB `drone_school_test` を使用する（誤接続は fail-closed ガードで拒否される）。

1. `createdb drone_school_test`
2. `.env.test.local`（gitignore 対象）に以下を設定:
   - `DATABASE_URL=postgresql://<ユーザー>@localhost/drone_school_test`
   - `NODE_ENV=test`
   - `E2E_STUDENT_PASSWORD` / `E2E_ADMIN_PASSWORD` / `E2E_PILOT_PASSWORD` / `E2E_PENDING_PASSWORD`（任意の値）
   - `INVITE_TOKEN_SECRET`（`.env.local` と同値にする。未設定だと招待フローの一部テストが fixme スキップされる）
3. マイグレーションとシード:
   ```bash
   DATABASE_URL=postgresql://<ユーザー>@localhost/drone_school_test npx prisma migrate deploy
   DATABASE_URL=postgresql://<ユーザー>@localhost/drone_school_test npx prisma db seed
   npm run e2e:seed
   ```
4. `npm run e2e`（dev server は Playwright が自動起動する）

## CI

GitHub Actions（`.github/workflows/ci.yml`）で以下を自動実行する。

- **PR (dev/main 向け) と dev への push**: lint / 単体テスト（カバレッジ閾値強制）/ 低速統合テスト / 本番ビルド
- **dev への push のみ**: E2E（postgres サービスコンテナ + Playwright、失敗時はレポートを artifact 保存）

## デプロイ

AWS Lightsail (Ubuntu) + nginx + pm2 構成。手順は `docs/lightsail-deploy-guide.md` を参照。

## 開発フロー

ブランチは dev 起点の `feature/*` `fix/*` を dev に squash merge する（main への直接 push は禁止）。詳細な開発ルールは `CLAUDE.md`、ドキュメント一覧は `docs/`（旧世代は `docs/archive/`）を参照。
