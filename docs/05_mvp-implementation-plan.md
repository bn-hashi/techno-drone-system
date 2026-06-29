# 事務管理MVP 実装計画

> 作成日: 2026-06-20  
> ブランチ: feature/claude-design-integration  
> 入力: docs/04_three-way-comparison.md  
> 承認状態: **質問回答済み・承認待ち**

---

## 前提確認

| チェック項目 | 判定 |
|------------|------|
| 破壊的マイグレーション | **なし**（全マイグレーションはADD ONLY） |
| 法令未確認事項（スコープ内） | なし（電子講習記録簿・監査・請求はスコープ外で触れない） |
| 仕様未確認による実装ブロック | **4件あり（下記参照）** |

---

## 確認事項への回答（確定済み）

| 質問 | 回答 | 影響 |
|-----|------|------|
| Q1 書類確認列 | (A) `documentCheckedAt` + `documentCheckedBy` | タスク2-3のスキーマ確定 |
| Q2 規約バージョン管理 | 複数版保持 + `isActive` フラグ | タスク2-8の設計確定 |
| Q3 DIPS CSV仕様 | **未確定・後回し** | タスク3-3を今回スコープ外に除外 |
| Q4 ルーティング方針 | **(A) 全画面を /admin/* に統一** | Phase 0が大規模移設作業になる |

---

## フェーズ別タスクリスト

### Phase 0: ルーティング方針の確定

#### タスク 0-1: AdminLayout リンクの整備
- **ゴール**: Q4の回答に基づき、AdminLayoutのナビリンクに今回追加するページを追加
- **前提**: Q4の回答
- **変更ファイル**: `components/layouts/AdminLayout.tsx`
- **作業量**: S（方針Bの場合）

---

### Phase 1: デザインシステム統一（ブロッカーなし）

#### タスク 1-1: Tailwind デザイントークン定義
- **ゴール**: `accent: "#2563eb"`, `pageBackground: "#f4f6fa"`, Noto Sans JP をトークン化
- **前提**: なし（今すぐ着手可）
- **変更ファイル**:
  - `tailwind.config.ts` — `accent`, `pageBackground` 追加（既存 `primary` は**変更しない**）
  - `app/layout.tsx` — `next/font/google` で Noto Sans JP 読込・`<html>` に適用
  - `app/globals.css` — CSS変数 `--background` を `#f4f6fa` に整合
- **テスト**: `__tests__/config/tailwind-tokens.test.ts` に `accent`/`pageBackground` アサーション追加
- **作業量**: S
- **破壊的変更**: なし

#### タスク 1-2: 共通UIコンポーネントへのトークン適用
- **ゴール**: `Button`/`Card`/`Badge`/`Input`/`Table`/`Modal`/`AppLayout` のハードコード色を新トークンへ置換
- **前提**: タスク 1-1
- **ルール**: Props シグネチャ不変（API変更なし）、既存テスト・呼び出し側無傷
- **変更ファイル**: `components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx`, `Input.tsx`, `Table.tsx`, `Modal.tsx`, `LoadingSpinner.tsx`, `components/layouts/AppLayout.tsx`
- **作業量**: M
- **破壊的変更**: なし

#### タスク 1-3: ログイン画面の独自レイアウト再設計（#1）
- **ゴール**: DOROBYを参照しない独自レイアウト、`pageBackground` 背景。`LoginForm` のロジック不変
- **前提**: タスク 1-1, 1-2、Q4の回答
- **変更ファイル**: `app/(auth)/login/page.tsx`, `app/(auth)/layout.tsx`
- **禁止**: DOROBYのロゴ・文言・配色・画面構成をコピーしない
- **注意**: E2E `e2e/specs/auth.spec.ts` のセレクタ（role/labelベース）を壊さない
- **作業量**: M
- **破壊的変更**: なし

#### タスク 1-4: StudentLayout ナビリンクバグ修正（#36）
- **ゴール**: 壊れているナビリンクを実在ルートへ修正
- **前提**: タスク 1-2
- **バグ内容**（調査済み）:
  - `/student/dashboard` → `/student`（実在: `app/student/page.tsx`）
  - `/student/courses` → `/courses`（実在: `(student)` グループ）
  - `/student/exams` → `/exams`（実在: `(student)` グループ）
  - `/qa` → `/student/qa`、`/certificate` → `/student/certificate` も確認要
- **変更ファイル**: `components/layouts/StudentLayout.tsx`
- **テスト**: `__tests__/components/layouts/StudentLayout.test.tsx` のリンク先アサーション更新
- **作業量**: S
- **破壊的変更**: なし

#### タスク 1-5: その他LMS管理・受講生画面のトークン統一（#14,31,32,34,35,37,38）
- **ゴール**: 既存画面のハードコード色をトークンへ置換。マークアップ・ロジック不変
- **前提**: タスク 1-1, 1-2
- **対象ファイル**: `app/(admin)/courses/`, `videos/`, `questions/`, `exam-results/`, `app/(student)/` 各 page, `app/student/page.tsx`, `app/admin/qa/`
- **作業量**: M
- **破壊的変更**: なし

---

### Phase 2: 既存機能の拡張

#### タスク 2-1: 受講生一覧の実装（#3）
- **ゴール**: スタブ（`app/admin/students/page.tsx`）を進捗・修了審査状況の列を持つ一覧へ
- **前提**: タスク 0-1, 1-2
- **変更/作成ファイル**:
  - `app/admin/students/page.tsx` — Server Component
  - `services/studentLedgerService.ts` — 集計専用（新規）
  - `repositories/` — 既存 userRepository + subjectProgressRepository の集計クエリ追加
  - `lib/serviceFactory.ts` — studentLedgerService 登録
- **注意**: N+1回避のため集計クエリを1本で書く
- **作業量**: M
- **破壊的変更**: なし（DB変更なし）

#### タスク 2-2: 受講生詳細のタブ追加（#4）
- **ゴール**: 既存詳細に「書類」「監査資料」タブを追加。監査資料は既存ログの単純表示（新規監査ロジックは作らない）
- **前提**: タスク 0-1, 2-1
- **変更ファイル**: `app/(admin)/students/[id]/page.tsx` または統一後の配置先
- **作業量**: M
- **破壊的変更**: なし

#### タスク 2-3: 書類確認ステータス（#5）【**Q1の回答が必要**】
- **ゴール**: 申込一覧/詳細で書類確認ステータスを管理
- **前提**: Q1の回答、タスク 1-2
- **変更/作成ファイル**:
  - `prisma/schema.prisma` — `EnrollmentApplication` に列追加（nullable、非破壊）
  - `repositories/enrollmentApplicationRepository.ts` — 型拡張
  - `services/documentCheckService.ts` — 新規（単一責任）
  - `app/api/admin/applications/[id]/document-check/route.ts` — 新規（ADMIN認可+zod）
  - `app/admin/applications/page.tsx` — 列・ボタン追加
  - `components/admin/applications/DocumentCheckButton.tsx` — Client Component
- **テスト**: `__tests__/services/documentCheckService.test.ts`
- **作業量**: M
- **破壊的変更**: **なし**（nullableカラム追加のみ）

#### タスク 2-4: 入学者管理UI整備（#6）
- **ゴール**: 受理済み入学者の管理ビューを整える
- **前提**: タスク 2-3
- **変更ファイル**: `app/admin/applications/page.tsx`（フィルタ追加）
- **作業量**: S
- **破壊的変更**: なし

#### タスク 2-5: 管理者ダッシュボード集計（#2）
- **ゴール**: スタブ（`app/admin/page.tsx`）に受講者数・申込件数等の集計カードを表示
- **前提**: タスク 1-2, 2-1
- **変更/作成ファイル**:
  - `app/admin/dashboard/page.tsx` — 新規
  - `app/api/admin/dashboard/route.ts` — 新規（ADMIN認可）
  - `services/dashboardService.ts` — 新規
  - `repositories/dashboardRepository.ts` — 新規（`$transaction`で並列count）
  - `components/admin/dashboard/DashboardStatsCard.tsx` — 新規
  - `app/admin/page.tsx` → `redirect("/admin/dashboard")` に変更
  - `lib/serviceFactory.ts` — dashboardService 登録
- **APIレスポンス型**:
  ```typescript
  {
    totalStudents: number
    activeStudents: number
    examPassedStudents: number
    completedStudents: number
    pendingApplications: number
    pendingQaCount: number
  }
  ```
- **テスト**: `__tests__/services/dashboardService.test.ts`, `__tests__/app/api/admin/dashboard/route.test.ts`
- **作業量**: M
- **破壊的変更**: なし

#### タスク 2-6: 受講生進捗管理（管理者向け）（#33）
- **ゴール**: 科目別進捗の管理者一覧（DB変更なし）
- **前提**: タスク 2-1
- **変更/作成ファイル**: `app/admin/progress/page.tsx`（新規）、studentLedgerService に集計メソッド追加
- **作業量**: M
- **破壊的変更**: なし

#### タスク 2-7: 修了証明書台帳 一覧（#15）
- **ゴール**: 発行済み修了証明書の一覧画面（DB変更なし）
- **前提**: タスク 1-2
- **変更/作成ファイル**:
  - `app/admin/ledger/page.tsx` — 新規
  - `app/api/admin/ledger/route.ts` — 新規（GET、ページネーション付き）
  - `services/ledgerService.ts` — 新規
  - `repositories/completionCertificateRepository.ts` — `findAllPaginated()` 追加
  - `lib/serviceFactory.ts` — ledgerService 登録
- **APIレスポンス型**:
  ```typescript
  {
    items: LedgerItem[]  // certificateNumber, studentName, issuedAt, expiresAt, applicantNumber
    meta: { total: number; page: number; limit: number }
  }
  ```
- **テスト**: `__tests__/services/ledgerService.test.ts`, `__tests__/app/api/admin/ledger/route.test.ts`
- **作業量**: M
- **破壊的変更**: なし

#### タスク 2-8: 受講規約のDB管理化（#18）【**Q2の回答が必要**】
- **ゴール**: 規約本文をDB管理に。テーブルが空なら既存定数フォールバック（後方互換）
- **前提**: Q2の回答、タスク 1-2
- **DB変更**:
  ```prisma
  model AgreementText {
    id          String   @id @default(cuid())
    version     String   @unique
    body        String
    isActive    Boolean  @default(false)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    @@map("agreement_texts")
  }
  ```
- **変更/作成ファイル**:
  - `prisma/schema.prisma` — AgreementText 追加（新規テーブル、非破壊）
  - `repositories/agreementTextRepository.ts` — 新規
  - `services/agreementTextService.ts` — 新規
  - `services/setupService.ts` — 現行版取得を新serviceへ委譲（フォールバック付き）
  - `app/admin/agreement/page.tsx` — 新規（一覧+作成+有効化）
  - `app/api/admin/agreement/route.ts` — 新規（GET/POST）
  - `app/api/admin/agreement/[id]/activate/route.ts` — 新規（PATCH）
  - `components/admin/agreement/AgreementTextForm.tsx` — 新規（Client Component）
  - `lib/serviceFactory.ts` — agreementTextService 登録
  - `services/errors.ts` — `AgreementTextNotFoundError` 追加
- **注意**: SetupService を触るため既存認証フロー（本登録・規約同意）に影響。`__tests__/services/setupService.test.ts` が緑のまま維持されることを確認
- **テスト**: `__tests__/services/agreementTextService.test.ts`, `__tests__/repositories/agreementTextRepository.test.ts`
- **作業量**: L
- **破壊的変更**: なし（新規テーブル＋フォールバック）

---

### Phase 3: 完全新規機能

#### タスク 3-1: 講師管理 CRUD（#24）
- **ゴール**: Instructor テーブル新設・CRUD
- **前提**: タスク 1-2, 0-1
- **DB変更**:
  ```prisma
  model Instructor {
    id                           String   @id @default(cuid())
    name                         String
    instructorRegistrationNumber String   @unique
    qualifications               String?
    isActive                     Boolean  @default(true)
    createdAt                    DateTime @default(now())
    updatedAt                    DateTime @updatedAt
    @@map("instructors")
  }
  ```
  - `VideoSupervisor` との外部キーは**設けない**（YAGNI・既存への影響回避）
- **変更/作成ファイル**:
  - `prisma/schema.prisma` — Instructor 追加（新規テーブル、非破壊）
  - `repositories/instructorRepository.ts` — 新規
  - `services/instructorService.ts` — 新規（deactivate=論理削除）
  - `app/api/admin/instructors/route.ts` — 新規（GET/POST）
  - `app/api/admin/instructors/[id]/route.ts` — 新規（PUT/DELETE=論理削除）
  - `app/admin/instructors/page.tsx` — 新規
  - `components/admin/instructors/InstructorFormModal.tsx` — 新規
  - `lib/serviceFactory.ts` — instructorService 登録
  - `services/errors.ts` — `InstructorNotFoundError`, `DuplicateInstructorRegistrationNumberError` 追加
- **テスト**: `__tests__/services/instructorService.test.ts`, `__tests__/app/api/admin/instructors/route.test.ts`
- **作業量**: L
- **破壊的変更**: なし

#### タスク 3-2: LMS管理ダッシュボード集計（#30）
- **ゴール**: 動画数・科目別問題数等のLMS側集計（DB変更なし）
- **前提**: タスク 2-5
- **変更/作成ファイル**: `app/admin/lms/page.tsx`（新規）、`services/dashboardService.ts` にLMS集計メソッド追加
- **作業量**: M
- **破壊的変更**: なし

#### タスク 3-3: DIPS CSV 出力（#16）【**Q3の回答が必要**】
- **ゴール**: DIPSExportLog を活用しCSV生成
- **前提**: **Q3の回答（列定義・文字コード確定後）**、タスク 2-7
- **変更/作成ファイル**:
  - `lib/dips/csvFormatter.ts` — 新規（CSV生成専用。既存 `lib/csvParser.ts` はパース専用で流用不可）
  - `repositories/dipsExportLogRepository.ts` — 新規
  - `services/dipsExportService.ts` — 新規
  - `app/api/admin/dips/export/route.ts` — 新規（POST: CSV生成+ログ記録）
  - `app/api/admin/dips/export/download/route.ts` — 新規（GET: StreamでCSVダウンロード）
  - `app/admin/dips/page.tsx` — 新規（出力ボタン+履歴一覧）
  - `lib/serviceFactory.ts` — dipsExportService 登録
- **テスト**: `__tests__/lib/dips/csvFormatter.test.ts`, `__tests__/services/dipsExportService.test.ts`
- **作業量**: L
- **破壊的変更**: なし
- **停止条件**: Q3未回答のうちは着手しない

---

### Phase 4: 監査ログ記録（スコープ内操作のみ）

#### タスク 4-1: 状態変更操作のログ記録
- **ゴール**: 書類確認・規約公開・DIPS出力・講師CRUD など管理者変更操作を `lib/logger.ts` で記録
- **前提**: 対象タスク完了後
- **変更ファイル**: 各 service の変更メソッドに logger 呼び出しを追加
- **注意**: 新規監査テーブルは**作らない**（本格監査機能 #20-22 はスコープ外）
- **作業量**: S
- **破壊的変更**: なし

---

### Phase 5: 帳票

- PDF: 今回スコープで新規PDFなし。既存 `CertificatePDF`/`CertificateLedgerPDF` を再利用
- CSV: タスク 3-3（DIPS）に内包済み

---

### Phase 6: テスト

TDD（Red→Green→Refactor）は各実装タスクと並走。ここでは方針のみ。

| テスト種別 | カバレッジ目標 | ツール |
|----------|-------------|-------|
| ユニット (Service層) | **90%以上** | Vitest |
| インテグレーション (API Route) | 認可・バリデーション・正常系を最低1本 | Vitest |
| E2E | ログイン・受講生一覧・ダッシュボードのゴールデンパス | Playwright |

**E2E 禁止事項**: 既存 `auth.spec.ts` のセレクタを壊さない（role/labelベースのまま維持）

---

## DB変更サマリ（全3件、全て非破壊）

| # | 変更 | 方式 | 破壊的変更 |
|---|------|------|----------|
| M1 | EnrollmentApplication に2列追加 | nullable ADD | **なし** |
| M2 | AgreementText テーブル新設 | 新規テーブル | **なし** |
| M3 | Instructor テーブル新設 | 新規テーブル | **なし** |

---

## 新規ファイル一覧

### Phase 1 (P1)
- `components/admin/dashboard/DashboardStatsCard.tsx`
- `app/admin/dashboard/page.tsx`
- `app/api/admin/dashboard/route.ts`
- `services/dashboardService.ts`
- `repositories/dashboardRepository.ts`
- `app/admin/ledger/page.tsx`
- `app/api/admin/ledger/route.ts`
- `services/ledgerService.ts`
- (テスト: 各 `__tests__/services/*.test.ts`, `__tests__/app/api/admin/*.test.ts`)

### Phase 2 (P2・Q1依存あり)
- `services/documentCheckService.ts`
- `repositories/agreementTextRepository.ts` ← Q2確定後
- `services/agreementTextService.ts` ← Q2確定後
- `app/api/admin/applications/[id]/document-check/route.ts`
- `app/api/admin/agreement/route.ts` ← Q2確定後
- `app/api/admin/agreement/[id]/activate/route.ts` ← Q2確定後
- `app/admin/agreement/page.tsx` ← Q2確定後
- `components/admin/applications/DocumentCheckButton.tsx`
- `components/admin/agreement/AgreementTextForm.tsx` ← Q2確定後
- `app/admin/progress/page.tsx`

### Phase 3 (P3・Q3依存あり)
- `repositories/instructorRepository.ts`
- `services/instructorService.ts`
- `repositories/dipsExportLogRepository.ts` ← Q3確定後
- `services/dipsExportService.ts` ← Q3確定後
- `lib/dips/csvFormatter.ts` ← Q3確定後
- `app/api/admin/instructors/route.ts`
- `app/api/admin/instructors/[id]/route.ts`
- `app/api/admin/dips/export/route.ts` ← Q3確定後
- `app/api/admin/dips/export/download/route.ts` ← Q3確定後
- `app/admin/instructors/page.tsx`
- `app/admin/dips/page.tsx` ← Q3確定後
- `app/admin/lms/page.tsx`
- `components/admin/instructors/InstructorFormModal.tsx`
- `components/admin/instructors/InstructorPageClient.tsx`

---

## 修正が必要な既存ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `tailwind.config.ts` | `accent`, `pageBackground` トークン追加（`primary` は保持） |
| `app/layout.tsx` | `next/font/google` で Noto Sans JP 読込 |
| `app/globals.css` | CSS変数 `--background` を `#f4f6fa` に整合 |
| `components/layouts/StudentLayout.tsx` | ナビリンクバグ修正（3〜5本） |
| `components/layouts/AdminLayout.tsx` | ダッシュボード・台帳・DIPS・規約・講師へのリンク追加 |
| `components/ui/Button.tsx` (他UI) | ハードコード色をトークンへ置換 |
| `app/(auth)/login/page.tsx` | 独自レイアウト再設計（DOROBYコピー禁止） |
| `app/admin/page.tsx` | `redirect("/admin/dashboard")` に変更 |
| `app/admin/applications/page.tsx` | 書類確認列・ボタン追加（Q1確定後） |
| `app/(admin)/students/[id]/page.tsx` | タブ構造へ変更 |
| `app/admin/users/page.tsx` | 進捗状況列追加 |
| `repositories/enrollmentApplicationRepository.ts` | 新カラムを型に追加（Q1確定後） |
| `repositories/completionCertificateRepository.ts` | `findAllPaginated()` 追加 |
| `lib/serviceFactory.ts` | 新 service を登録 |
| `services/errors.ts` | 新 Error クラスを追加 |
| `services/setupService.ts` | 規約取得を agreementTextService へ委譲（Q2確定後） |
| `prisma/schema.prisma` | M1/M2/M3 の変更 |
| `__tests__/config/tailwind-tokens.test.ts` | 新トークンのテスト追加 |
| `__tests__/components/layouts/StudentLayout.test.tsx` | 修正後リンクURLのアサーション更新 |

---

## 依存関係グラフ

```text
Q4（ルーティング） ──► 0-1 ──► 新規画面の配置先確定
Q1（書類確認列）   ──► 2-3 ──► 2-4
Q2（規約方針）     ──► 2-8
Q3（DIPS仕様）     ──► 3-3

1-1（トークン定義）
  └── 1-2（共通UI）
        ├── 1-3（ログイン再設計）
        ├── 1-4（学生ナビ修正）  ← 今すぐ着手可
        ├── 1-5（各画面トークン統一）
        ├── 2-1（受講生一覧）──── 2-2（詳細タブ）
        │                   └── 2-6（進捗一覧）
        │                   └── 2-5（ダッシュボード）──── 3-2（LMS集計）
        ├── 2-7（台帳一覧）──────────────────────── 3-3（DIPS）← Q3要
        └── 3-1（講師管理）

2-3, 2-8, 3-1, 3-3 ──► 4-1（操作ログ）
全実装タスク ──► Phase 6（テスト、各タスクと並走）
```

**クリティカルパス**: 1-1 → 1-2 → Phase 2/3 系  
**今すぐ着手可**: 1-1, 1-4（Q4回答不要）  
**Q回答を待つ**: 2-3（Q1）, 2-8（Q2）, 3-3（Q3）, 0-1以降のURL確定（Q4）

---

## リスク・注意事項

| # | リスク | 対策 |
|---|-------|------|
| R1 | **ルーティング分裂**（最重要）: `(admin)` グループのURLがmiddleware保護外 | Q4で方針確定。今回は(B)案で新規画面を `app/admin/` に置く |
| R2 | SetupService改修（タスク2-8）: 認証フローの中核を触る | フォールバック必須。`setupService.test.ts` を緑で維持 |
| R3 | DIPS外部仕様（タスク3-3）: 列・エンコードがズレると取り込み失敗 | Q3確定まで着手しない |
| R4 | N+1クエリ（一覧系） | repository に集計クエリを1本で書く |
| R5 | E2E破壊: ログイン再設計でセレクタが壊れる | role/labelベースのセレクタを維持 |
| R6 | トークン名リネーム禁止 | 既存 `primary` の値のみ更新。名前変更は全画面に波及 |

---

## スコープ外（今回は手を付けない）

- 電子講習記録簿（#8-11）— 法令確認必要
- 四半期実施計画書・実施状況報告書（#12,13）— 法令確認必要
- 講習カレンダー（#7）— 依存マスタ未整備
- 請求・収受記録（#17）— 法令確認必要
- 監査機能（#20-22）— 法令確認必要
- 会場・機体・審査員管理（#25-27）— 依存関係あり
- キャンペーン管理（#19）— ビジネス要件未確定
