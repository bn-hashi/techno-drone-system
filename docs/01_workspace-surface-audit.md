# Workspace Surface Audit — techno-drone-system

> 作成日: 2026-06-20  
> ブランチ: feature/claude-design-integration

---

## 1. Current Surface（現在使えるもの）

### フレームワーク
| 項目 | 内容 |
|------|------|
| フロントエンド | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| バックエンド | Next.js API Routes（同一プロセス） |
| DB | PostgreSQL (`drone_school`) + Prisma ORM |
| 認証 | NextAuth.js v4（Credentials Provider、JWT + role/status） |
| PDF生成 | @react-pdf/renderer |
| メール | Resend |
| 動画配信 | nginx 静的配信（/home/ubuntu/videos/） |

### 画面一覧（35画面）

**管理者側（`/admin`）**
- ダッシュボード、入学申請一覧、新規入学申請
- ユーザー管理・新規作成
- 受講者一覧・詳細・受講確認レビュー・修了証明書
- コース管理、動画管理、科目管理、問題管理、試験結果
- Q&A管理

**受講者側（`/student`）**
- ダッシュボード、コース詳細、動画視聴
- 試験（一覧・実施・結果）、修了証明書、Q&A

**共通**
- ログイン、初期設定（利用規約同意・パスワード設定）

### API Routes（40エンドポイント）
- Admin: users, courses, subjects, videos（監修者含む）, questions（CSV import）, enrollment, students（invite/judge/review/certificate）, QA, exam-results
- Student: courses/videos, exams（submit/result/eligibility）, progress, viewing-log, fraud-flag, QA, certificate
- Auth: NextAuth `[...nextauth]`

### DB モデル（Prisma）
User, EnrollmentApplication, AgreementLog, Subject, Course, Video, VideoSupervisor, ViewingLog, SubjectProgress, Question, Exam, ExamAnswer, QARecord, CompletionCertificate, DIPSExportLog, FraudFlag, JudgmentRecord

### 認証・認可
- JWT にrole（ADMIN/STUDENT）+ status（7ステータス）を埋め込み
- `middleware.ts` で `/admin/*`, `/student/*` のルートガード
- status-based リダイレクト（`middlewareHelpers.ts`）

### テスト
| 種別 | 数 | ツール |
|------|----|--------|
| Unit/Integration | 約100ファイル | Vitest + Testing Library |
| E2E | 4スペック | Playwright |

対象: repositories層・services層・API routes・コンポーネント・hooks全網羅

### インストール済みプラグイン（9個）
- `ecc@ecc` v2.0.0（ECC本体）
- `ecc@everything-claude-code` v2.0.0
- `feature-dev`, `frontend-design`, `playwright`, `pyright-lsp`, `security-guidance`, `slack`, `typescript-lsp`

### 有効なスキル（主要）
`ecc:plan`, `ecc:code-review`, `ecc:react-review`, `ecc:react-test`, `ecc:security-scan`, `ecc:tdd-workflow`, `ecc:e2e-testing`, `frontend-design:frontend-design`, `ecc:react-build`

---

## 2. Parity（ECC が既にカバーしているもの）

| 必要な能力 | ECC の対応 |
|-----------|-----------|
| TypeScript コードレビュー | `ecc:typescript-reviewer` エージェント + typescript-lsp |
| React コードレビュー | `ecc:react-reviewer` エージェント |
| TDD サイクル | `ecc:tdd-workflow` スキル |
| セキュリティスキャン | `ecc:security-scan` スキル |
| E2E テスト | playwright プラグイン + `ecc:e2e-testing` |
| ビルドエラー修正 | `ecc:react-build-resolver` エージェント |
| コードレビュー全般 | `/code-review` スキル |

---

## 3. Primitive-only Gaps（ツールはあるが ECC のワークフローが薄いもの）

| ギャップ | 状況 |
|---------|------|
| **Prisma マイグレーション管理** | `make migrate` はあるが、スキーマ変更時の安全確認ワークフロー（`ecc:database-migrations`）は未整備 |
| **Playwright E2E** | playwright プラグインはあるが、E2E スペックは4ファイルのみ（管理者画面のテストがほぼない）|
| **PDF生成テスト** | `@react-pdf/renderer` は使用中だが、PDF出力の視覚的回帰テストなし |
| **メール送信確認** | Resend は設定されているが、メール配信フロー（招待・セットアップ）の E2E テストなし |

---

## 4. Missing Integrations（未接続の能力）

| 不足している能力 | 補足 |
|----------------|------|
| **GitHub MCP** | PR作成・レビューは `gh` CLI 経由のみ。GitHub MCP サーバーを接続すると PR 操作が自動化できる |
| **Sentry / エラー監視** | 本番エラーの可観測性がない |
| **DIPS 連携の実装** | スキーマに `DIPSExportLog` があるが、CSV 生成・エクスポート API が未実装（要件書に記載あり）|
| **請求・収受記録管理** | 要件書に記載あるが、現システムに費用管理機能がない |
| **実地講習記録・四半期計画** | 要件書に記載あるが、未実装 |

---

## 5. Top 3-5 Next Moves（優先度順）

1. **E2E テストの拡充（管理者フロー）**
   - `ecc:e2e-testing` スキルを使い、入学申請→招待→受講確認→修了証明書発行の管理者ゴールデンパスを E2E で網羅する
   - 現在 E2E は受講者フロー中心で、管理者操作がほぼ未テスト

2. **DIPS CSV エクスポート機能の実装**
   - `DIPSExportLog` モデルはあるが `/api/admin/students/[id]/certificate/ledger` 以外の DIPS 出力が未実装
   - 要件書の最重要業務フローのひとつ

3. **frontend-design プラグインで UI 品質を上げる**
   - `frontend-design:frontend-design` スキルが新規インストール済み
   - 現ブランチ `feature/claude-design-integration` の目的と合致する

4. **GitHub MCP 接続**
   - PR レビューのコメント投稿、issue 管理を自動化
   - `ecc:github-ops` スキルと組み合わせで PR ワークフローが完結する

5. **Prisma マイグレーション安全確認の整備**
   - `ecc:database-migrations` スキルを使い、スキーマ変更時に `--create-only` + レビュー後適用のフローを確立する

---

## 質問事項（ユーザーへの確認）

1. **現ブランチ `feature/claude-design-integration` の目的** — 具体的にどの画面のデザインを改善したいですか？（管理者全体？特定の画面？）

2. **要件書 `docs/requirements/registered-training-system-requirements.md`** — これは「これから実装する機能」の仕様ですか？それとも現状の整理ですか？

3. **DIPS 連携** — CSV エクスポートの実装は優先事項ですか？
