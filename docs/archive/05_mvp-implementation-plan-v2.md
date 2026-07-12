# 事務管理MVP 実装計画 v2

> 作成日: 2026-06-21
> ブランチ: feature/claude-design-integration
> 入力: docs/04_three-way-comparison.md, docs/05_mvp-implementation-plan.md (v1)
> 承認状態: **承認待ち（コード未変更）**
> v2での主な変更: Q4=A確定によるPhase 0の詳細化、ダッシュボード仕様確定、font/token/logger/監査の方針明記、Prisma安全手順とphase条件の追加

---

## 0. 前提・確定事項

### 確認事項の最終回答

| 質問 | 回答 | 状態 | 影響 |
|-----|------|------|------|
| Q1 書類確認列 | (A) `documentCheckedAt` + `documentCheckedBy` | **回答済み** | タスク2-3のスキーマ確定 |
| Q2 規約バージョン管理 | 複数版保持 + `isActive` フラグ + `updatedBy` | **回答済み** | タスク2-8の設計確定 |
| Q3 DIPS CSV仕様 | 未確定 | **今回除外** | タスク3-3はスコープ外（着手しない） |
| Q4 ルーティング方針 | **(A) 全管理画面を `/admin/*` へ統一** | **回答済み** | Phase 0で全管理page routeを移設 |

### 全体方針（不変条件）

- DOROBYのロゴ・商品名・文言・配色・画面構成をコピーしない
- デザインHTMLで既存コードを丸ごと置き換えない
- 既存の業務ロジック・データ・認証・権限を壊さない
- 不明な機能や法令要件を推測して実装しない
- **commit / push / PR / deploy はユーザーの明示承認なしに実行しない**（→ §8参照）

### 破壊的変更チェック

| チェック項目 | 判定 |
|------------|------|
| 破壊的マイグレーション | **なし**（M1〜M3すべてADD ONLY。§6で安全手順を規定） |
| 法令未確認事項（スコープ内） | なし（電子講習記録簿・監査・請求はスコープ外で触れない） |
| 仕様未確認による実装ブロック | Q3のみ（DIPS）→ 今回スコープ外で回避 |

---

## 1. Phase 0: ルーティング統一（Q4=A・最優先・前提作業）

> **Q4はA案「全管理画面を `/admin/*` へ統一」で確定。** v1リスク表のR1に残っていた「今回は(B)案」は撤回・削除した（→ §7 R1）。

### 1-1. 移設の基本原則

- **移設対象は page route のみ**（`app/(admin)/.../page.tsx`）。
- **API route（`app/api/admin/...`）は移設対象外**。これらは既に `/api/admin/*` 配下にあり、URLもmiddlewareも変わらない。`lib/api/*` の `fetch("/api/admin/...")` 呼び出しは**一切変更不要**。
- 受講生向け route（`app/(student)/courses/[courseId]` 等、URL `/courses/[courseId]`）は**移設対象から除外**する。これは別ドメイン（受講生の動画視聴）であり、admin統一とは無関係。

### 1-2. ルーティング影響表（page routeのみ）

| 現route（ファイル） | 現URL | 移設先ファイル | 新URL | 旧URL redirect | middleware | 内部link修正 | test影響 |
|---|---|---|---|---|---|---|---|
| `app/(admin)/courses/page.tsx` | `/courses` | `app/admin/courses/page.tsx` | `/admin/courses` | `/courses`(完全一致)→`/admin/courses` ※下記注 | 変更不要（既存matcherが`/admin/*`を包含） | AdminLayout L10 | AdminLayout.test |
| `app/(admin)/videos/page.tsx` | `/videos` | `app/admin/videos/page.tsx` | `/admin/videos` | `/videos`→`/admin/videos` | 変更不要 | AdminLayout L11 | AdminLayout.test |
| `app/(admin)/questions/page.tsx` | `/questions` | `app/admin/questions/page.tsx` | `/admin/questions` | `/questions`→`/admin/questions` | 変更不要 | AdminLayout L12 | AdminLayout.test |
| `app/(admin)/exam-results/page.tsx` | `/exam-results` | `app/admin/exam-results/page.tsx` | `/admin/exam-results` | `/exam-results`→`/admin/exam-results` | 変更不要 | AdminLayout L13 | AdminLayout.test |
| `app/(admin)/students/[id]/page.tsx` | `/students/[id]` | `app/admin/students/[id]/page.tsx` ※既存folderへ統合 | `/admin/students/[id]` | `/students/:id`→`/admin/students/:id` | 変更不要 | `app/admin/users/page.tsx` L62 | （URL直書きtestなし。要grep再確認） |
| `app/(admin)/students/[id]/InviteButton.tsx` | （component） | `app/admin/students/[id]/InviteButton.tsx` | — | 不要 | — | import相対パスのみ | InviteButton関連test |
| `app/(admin)/layout.tsx` | （layout） | **削除**（`app/admin/layout.tsx`が同一の`requireAdminSession`+`AdminLayout`を提供） | — | — | — | — | — |

**移設先の既存状況（重要）**:
`app/admin/students/[id]/` には既に `certificate/page.tsx` と `review/page.tsx` が存在する。移設する `page.tsx`（詳細トップ）と `InviteButton.tsx` を同フォルダへ統合する形になり、衝突はない（同名ファイルなし）。

### 1-3. middleware の扱い（変更不要・要検証）

- `middleware.ts` の matcher は `"/(admin|student)/:path*"` で、**既に `/admin/*` を保護対象に含む**。移設先URLはすべて `/admin/*` なので、移設するだけで自動的にmiddleware保護下に入る。
- `lib/middlewareHelpers.ts` の `determineRedirect` は正規表現 `/^\/admin(\/|$)/` でADMIN専用判定している。`/admin/courses` 等も同じ判定に乗る。
- **結論: middleware.ts と middlewareHelpers.ts のロジック変更は不要。** ただし「移設後に新URLが確実に保護される」ことを `__tests__/lib/middlewareHelpers.test.ts` にケース追加して検証する（完了条件に含める）。

### 1-4. 旧URL redirect の方針（注意点あり）

- redirectは `next.config.js` の `redirects()` で **完全一致 (exact)** 指定する。
- ⚠️ **`/courses` の注意**: 受講生 route `/courses/[courseId]` が存在するため、`/courses/:path*` のような前方一致redirectは厳禁（受講生の動画視聴を破壊する）。`/courses`（パラメータなし完全一致）→ `/admin/courses` のみ許可。`/videos` `/questions` `/exam-results` は受講生側に衝突routeがないが、一貫性のため同様に完全一致で書く。
- redirectは「旧URLブックマーク救済」目的の任意施策。管理者のみが使う内部URLのため、**省略しても機能影響はない**。採用可否はユーザー判断に委ねる（→ §9 要確認1）。

### 1-5. 内部リンク修正一覧（page routeの移設に伴うもの）

| ファイル | 現在 | 修正後 | 備考 |
|---|---|---|---|
| `components/layouts/AdminLayout.tsx` L10-13 | `/courses` `/videos` `/questions` `/exam-results` | `/admin/courses` `/admin/videos` `/admin/questions` `/admin/exam-results` | ナビ4本。§2のnav公開ルールに従う |
| `app/admin/users/page.tsx` L62 | `href={`/students/${user.id}`}` | `href={`/admin/students/${user.id}`}` | 受講生詳細への遷移 |

**修正不要（確認済み）**:
- `app/(admin)/students/[id]/page.tsx` L89,108 → 既に `/admin/students/${params.id}/review`・`/certificate` を使用（移設後も正しい）。
- `lib/api/*` の `fetch("/api/admin/...")` → API routeは移設しないため不変。
- E2E `e2e/pages/CourseDetailPage.ts` `VideoViewingPage.ts` → 受講生URL `/courses/[courseId]` を使用。移設対象外のため不変。

### 1-6. Phase 0 の条件

- **開始条件**: なし（最優先で着手可。Q4=A確定済み）。
- **完了条件**:
  1. 全page routeが `app/admin/*` に移設され `app/(admin)/` が空（layout含め削除）。
  2. `make build`（`next build`）が成功し、移設したURLが200を返す。
  3. 旧URL（`/courses`等）への直アクセスが、redirect採用時は301、非採用時は404になることを確認（意図通り）。
  4. `__tests__/lib/middlewareHelpers.test.ts` に新URL保護ケースを追加し緑。
  5. `__tests__/components/layouts/AdminLayout.test.tsx` のhref期待値を新URLへ更新し緑。
  6. `make test` 全緑、`make lint`・型チェック緑。
- **停止条件**: 移設後に既存E2E（特に受講生 `/courses/[courseId]` 系）が落ちた場合は即停止し、衝突原因を切り分けてから再開。
- **実行test**: `make build` / `make test` / `make lint` / 型チェック、middlewareHelpers.test、AdminLayout.test。

---

## 2. Admin ナビゲーション公開ルール（404リンクを出さない）

- **AdminLayout の `NAVIGATION_LINKS` には、対応page が完成・公開済みのリンクのみを追加する。** 未完成画面へのリンクは追加しない（404リンクを管理者に見せない）。
- 各新規画面タスクの**完了時にセットで**該当navリンクを追加する（画面とリンクを同一PR/同一タスクで扱う）。
- Phase 0直後のAdminLayoutは、移設4本のURL付け替え（§1-5）のみ行い、新規画面リンク（ダッシュボード・台帳・規約・講師）は**各画面完成時に逐次追加**する。
- ⚠️ 既存の潜在404: `app/student/page.tsx` L102 `href="/courses"` は、Phase 0で `/courses` が消えると dangling になる。受講生に正しいリンク先が不明なため**推測で修正しない**（→ §9 要確認2）。

---

## 3. Phase 1: デザインシステム統一（ブロッカーなし）

### 3-1. Tailwind トークン定義（token方針を統一）

- **`primary` は値・名称とも変更しない**（全画面に波及するため）。`accent` と `pageBackground` を**新規追加**する。
  - `accent: "#2563eb"`（Tailwind blue-600相当、デザインのアクセント）
  - `pageBackground: "#f4f6fa"`（グレーブルー系の画面背景）
- **フォント: 既存の `@fontsource/noto-sans-jp`（package.json に導入済み・未使用）を再利用する。`next/font/google` は重複導入しない。**
  - 実装: `app/layout.tsx` で `import "@fontsource/noto-sans-jp"`（必要weightのサブパスも可）し、`tailwind.config.ts` の `fontFamily.sans` 先頭に `"Noto Sans JP"` を追加、`<body>` に適用。
- `app/globals.css`: 背景CSS変数を `#f4f6fa` に整合（既存変数があれば値のみ更新、なければ追加）。
- **変更ファイル**: `tailwind.config.ts`, `app/layout.tsx`, `app/globals.css`
- **テスト**: `__tests__/config/tailwind-tokens.test.ts` に `accent`/`pageBackground` の存在アサーションを追加。`primary` が不変であることのアサーションも追加（regression防止）。
- **開始条件**: なし。 **完了条件**: token test緑・`make build`緑。 **停止条件**: `primary` 参照が壊れたら即停止。

### 3-2. 共通UIコンポーネントへのトークン適用

- `Button`/`Card`/`Badge`/`Input`/`Table`/`Modal`/`LoadingSpinner`/`AppLayout` のハードコード色を新トークンへ置換。**Propsシグネチャ不変**（API変更なし）。
- **前提**: 3-1。 **完了条件**: 既存UI testが全緑のまま。 **停止条件**: 既存testのsnapshot/role崩れ。

### 3-3. ログイン画面の独自レイアウト再設計

- DOROBYを参照しない独自レイアウト、`pageBackground` 背景。`LoginForm` のロジック不変。
- **禁止**: DOROBYのロゴ・文言・配色・画面構成のコピー。
- **注意**: E2E `e2e/specs/auth.spec.ts` のrole/labelベースセレクタを壊さない。
- **前提**: 3-1, 3-2。 **完了条件**: auth E2E緑。 **停止条件**: auth E2Eのセレクタ破壊。

### 3-4. StudentLayout ナビリンクバグ修正

- 壊れているナビリンクを実在routeへ修正（調査済みの不一致を是正）。
- **注意**: `href="/courses"`（→受講生の正しい遷移先が不明な箇所）は §9 要確認2の回答後に確定。それ以外の明確な不一致のみ先行修正。
- **変更ファイル**: `components/layouts/StudentLayout.tsx`
- **テスト**: `__tests__/components/layouts/StudentLayout.test.tsx` のリンク先アサーション更新。
- **前提**: 3-2。 **完了条件**: StudentLayout test緑。 **停止条件**: 受講生E2E破壊。

### 3-5. その他LMS管理・受講生画面のトークン統一

- 既存画面のハードコード色をトークンへ置換。マークアップ・ロジック不変。
- 対象は移設後の `app/admin/courses|videos|questions|exam-results`, `app/(student)/*`, `app/student/page.tsx`, `app/admin/qa`。
- **前提**: 3-1, 3-2, **Phase 0完了**（移設後のパスに対して作業するため）。

---

## 4. Phase 2: 基盤後に最初に完成させる画面 = 管理者ダッシュボード

> **基盤作業（Phase 0 + Phase 1のtoken/UI）完了後、最初に完成させる画面を「管理者ダッシュボード」に変更した。** v1では受講生一覧が先行していたが、ダッシュボードを起点に変更。

### 4-1.（最優先画面）管理者ダッシュボード — アラートタイル型

- **デザイン: A案「アラートタイル型」で確定。**
- **データ方針（厳守）: 未実装領域の数値を架空表示しない。** 講習管理・請求管理・監査管理は今回スコープ外であり、これらの集計タイルは**作らない**（プレースホルダのダミー数値も置かない）。
- 表示するのは**既存テーブルから実際に集計できる値のみ**:
  - 受講生数 / ステータス別内訳（User.status の実数）
  - 入学申請の未処理件数（EnrollmentApplication）
  - 未回答Q&A件数（QARecord）
  - （Q1実装後）書類未確認の申請件数
- 「アラートタイル」= 要対応のしきい値超過（例: 未処理申請 > 0、未回答Q&A > 0）を強調表示。しきい値は定数化しコメントで根拠を記載（マジックナンバー禁止）。
- **変更/作成ファイル**:
  - `app/admin/dashboard/page.tsx`（新規・Server Component）
  - `app/api/admin/dashboard/route.ts`（新規・ADMIN認可）
  - `services/dashboardService.ts`（新規）
  - `repositories/dashboardRepository.ts`（新規・`$transaction`で並列count、N+1回避）
  - `components/admin/dashboard/AlertTile.tsx`（新規）
  - `app/admin/page.tsx` → `redirect("/admin/dashboard")` に変更
  - `lib/serviceFactory.ts` に dashboardService 登録
  - `components/layouts/AdminLayout.tsx` に「ダッシュボード」navリンク追加（**画面完成と同時**、§2準拠）
- **APIレスポンス型（実データのみ）**:
  ```typescript
  {
    totalStudents: number
    studentsByStatus: Record<UserStatus, number>
    pendingApplications: number
    pendingQaCount: number
    uncheckedDocumentCount: number  // Q1実装後に追加。未実装時は省略
  }
  ```
- **テスト**: `__tests__/services/dashboardService.test.ts`, `__tests__/app/api/admin/dashboard/route.test.ts`（認可・集計正常系）。
- **前提**: Phase 0完了, 3-1, 3-2。 **開始条件**: 基盤緑。 **完了条件**: ダッシュボードtest緑 + navリンク追加 + `/admin`→`/admin/dashboard`リダイレクト動作。 **停止条件**: スコープ外データの混入を検知したら停止。

### 4-2. 受講生一覧（#3）

- スタブ（`app/admin/students/page.tsx`）を進捗・修了審査状況の列を持つ一覧へ。
- `services/studentLedgerService.ts`（新規・集計専用）、`repositories/` に集計クエリ1本（N+1回避）、`lib/serviceFactory.ts` 登録。
- **前提**: 4-1。 DB変更なし。

### 4-3. 受講生詳細のタブ追加（#4）

- 既存詳細（移設後 `app/admin/students/[id]/page.tsx`）に「書類」「監査資料」タブ追加。監査資料は**既存ログの単純表示のみ**（新規監査ロジックは作らない／§5参照）。
- **前提**: Phase 0完了, 4-2。

### 4-4. 書類確認ステータス（#5）【Q1=A 確定】

- 申込一覧/詳細で書類確認ステータスを管理。
- **DB変更 M1**（§6で安全手順）: `EnrollmentApplication` に nullable 2列追加。設計詳細は §6-1。
- **変更/作成ファイル**:
  - `prisma/schema.prisma`（M1）
  - `repositories/enrollmentApplicationRepository.ts`（型拡張）
  - `services/documentCheckService.ts`（新規・単一責任）
  - `app/api/admin/applications/[id]/document-check/route.ts`（新規・ADMIN認可+zod）
  - `app/admin/applications/page.tsx`（列・ボタン追加）
  - `components/admin/applications/DocumentCheckButton.tsx`（Client Component）
- **確認者名の取得**: APIハンドラ内でセッションのadmin表示名（`session.user.name`）を取得し `documentCheckedBy` にスナップショット保存（§6-1の設計に従う）。
- **テスト**: `__tests__/services/documentCheckService.test.ts`。
- **前提**: 4-1, M1適用。 **停止条件**: M1適用がstagingで失敗したら停止。

### 4-5. 入学者管理UI整備（#6）

- 受理済み入学者の管理ビュー。`app/admin/applications/page.tsx` にフィルタ追加。 **前提**: 4-4。

### 4-6. 受講生進捗管理（管理者向け）（#33）

- 科目別進捗の管理者一覧（DB変更なし）。`app/admin/progress/page.tsx`（新規）+ studentLedgerService に集計メソッド。 **前提**: 4-2。

### 4-7. 修了証明書台帳 一覧（#15）

- 発行済み修了証明書の一覧（DB変更なし）。`app/admin/ledger/page.tsx` + `app/api/admin/ledger/route.ts`（GET・ページネーション）+ `services/ledgerService.ts` + `completionCertificateRepository.findAllPaginated()`。
- nav「修了証明書台帳」追加は画面完成時（§2）。 **前提**: 3-2。

### 4-8. 受講規約のDB管理化（#18）【Q2 確定】

- 規約本文をDB管理に。**テーブルが空なら既存定数フォールバック**（後方互換）。
- **DB変更 M2**（§6で安全手順）: `AgreementText` 新設。設計詳細は §6-2。
- **変更/作成ファイル**:
  - `prisma/schema.prisma`（M2）
  - `repositories/agreementTextRepository.ts`（新規）
  - `services/agreementTextService.ts`（新規・active切替は§6-2のtransaction方式）
  - `services/setupService.ts`（規約取得を新serviceへ委譲・フォールバック付き）
  - `app/admin/agreement/page.tsx`（新規・一覧+作成+有効化）
  - `app/api/admin/agreement/route.ts`（GET/POST）, `app/api/admin/agreement/[id]/activate/route.ts`（PATCH）
  - `components/admin/agreement/AgreementTextForm.tsx`（Client Component）
  - `lib/serviceFactory.ts`, `services/errors.ts`（`AgreementTextNotFoundError`）
- **注意**: SetupServiceは認証フローの中核。`__tests__/services/setupService.test.ts` を緑のまま維持。
- **テスト**: `agreementTextService.test.ts`, `agreementTextRepository.test.ts`, setupService回帰。
- **前提**: 3-2, M2適用。 **停止条件**: setupService回帰testが落ちたら即停止。

---

## 5. Phase 3〜5: 新規機能・監査ログ・帳票

### 5-1. 講師管理 CRUD（#24）

- **DB変更 M3**（§6）: `Instructor` 新設（`VideoSupervisor` への外部キーは設けない・YAGNI）。
- `repositories/instructorRepository.ts`, `services/instructorService.ts`（deactivate=論理削除）, `app/api/admin/instructors/route.ts`・`[id]/route.ts`, `app/admin/instructors/page.tsx`, `components/admin/instructors/InstructorFormModal.tsx`, serviceFactory, errors追加。
- **前提**: 3-2, Phase 0完了, M3適用。

### 5-2. LMS管理ダッシュボード集計（#30）

- 動画数・科目別問題数等のLMS側集計（DB変更なし、実データのみ／架空表示しない）。`app/admin/lms/page.tsx` + dashboardService にLMS集計メソッド。 **前提**: 4-1。

### 5-3.（除外）DIPS CSV 出力（#16）【Q3 未確定 → 今回スコープ外】

- **今回は着手しない。** Q3（列定義・列順・文字コード・改行コード）が未確定のため、推測実装は外部取り込み失敗のリスク。仕様確定後に別計画で扱う。
- 既存 `DIPSExportLog` モデルは温存（変更しない）。

### 5-4. Phase 4: 操作ログ記録（operational logging のみ）

- 書類確認・規約公開・講師CRUD等の管理者変更操作を `lib/logger.ts` で記録。
- **重要な位置づけ（明記）**: `lib/logger.ts` は **operational logging（運用ログ）** であり、開発時は `console.error`、本番は Sentry 等へ転送する抽象に過ぎない。**法令対応の改ざん防止監査証跡（tamper-proof audit trail）ではない。**
- **永続的な改ざん防止監査証跡（追記専用テーブル・ハッシュチェーン・署名等）は今回スコープ外。** 新規監査テーブルは作らない（本格監査機能 #20-22 はスコープ外）。
- **前提**: 対象タスク完了後。 DB変更なし。

### 5-5. Phase 5: 帳票

- PDF: 新規PDFなし。既存 `CertificatePDF`/`CertificateLedgerPDF` を再利用。
- CSV: DIPS（5-3）がスコープ外のため、今回CSV出力の新規実装なし。

### 5-6. Phase 6: テスト方針

TDD（Red→Green→Refactor）を各実装タスクと並走。

| テスト種別 | カバレッジ目標 | ツール |
|----------|-------------|-------|
| ユニット（Service層） | **90%以上** | Vitest |
| インテグレーション（API Route） | 認可・バリデーション・正常系を最低1本 | Vitest |
| E2E | ログイン・ダッシュボード・受講生一覧のゴールデンパス | Playwright |

**E2E 禁止事項**: 既存 `auth.spec.ts` のrole/labelベースセレクタを壊さない。

---

## 6. Prisma マイグレーション安全手順（M1〜M3共通）

> 全マイグレーションはADD ONLY（非破壊）だが、本番DBへの適用は以下の手順を厳守する。**いずれもユーザーの明示承認後に実行（§8）。**

### 6-0. 共通の適用フロー

1. **create-only生成**: `prisma migrate dev --create-only --name <name>` でSQLを生成のみ（自動適用しない）。
2. **SQL review**: 生成された `migration.sql` を人間がレビュー。`DROP`/`ALTER ... DROP`/`NOT NULL`追加（既存行がある列）など破壊的操作が混入していないことを確認。本計画のM1〜M3はすべて `ADD COLUMN ... NULL` または `CREATE TABLE` のみであるべき。
3. **backup**: 適用前に `drone_school` のバックアップを取得（`pg_dump`）。
4. **staging適用**: staging相当環境で `prisma migrate deploy` → アプリ起動 → 関連testを実行し回帰がないことを確認。
5. **本番適用**: 承認後 `prisma migrate deploy`。
6. **rollback手順**: 各マイグレーションの逆操作SQLを事前に用意（§6-1〜6-3）。問題時はrollback SQL適用 + `pg_dump`バックアップからの復旧を選択肢として保持。Prismaのmigration履歴も合わせて戻す。

### 6-1. M1: EnrollmentApplication への列追加（書類確認）

```prisma
model EnrollmentApplication {
  // ... 既存フィールド ...
  documentCheckedAt DateTime? // 書類確認完了日時（未確認は null）
  documentCheckedBy String?   // 確認した管理者の表示名スナップショット（FKではない）
}
```

**設計判断（Q9: 型・User関係・index・削除時の扱い）**:

- **型**: `documentCheckedBy` は `String?`（確認者の**表示名スナップショット**）。Q1=Aの「確認者名」に忠実。
- **User関係**: **外部キー（リレーション）を設けない。** 理由:
  - (a) 監査用途では「確認した時点の確認者名」を**不変スナップショット**として残すべきで、後からUser.nameが変わっても確認記録は当時の名前を保持したい。
  - (b) FKにすると確認者Userの削除時に挙動（Cascade/SetNull/Restrict）を決める必要が生じ、既存Userモデルへ影響する。スナップショットなら影響ゼロ。
- **index**: **不要。** この列で検索・絞り込みする要件はない（YAGNI）。将来「確認者で絞り込む」要件が出たらその時に追加。
- **削除時の扱い**: FKがないため、確認者Userが削除されても `documentCheckedBy` の文字列は残る（監査上望ましい）。`EnrollmentApplication` 自体は既存どおり `user` リレーションの `onDelete: Cascade`（受講生User削除で申請も削除）を**変更しない**。
- **代替案（不採用）**: `documentCheckedBy String?` + `@relation` でUser FK化。確認者の最新情報を辿れる利点はあるが、スナップショット性とUserモデル非干渉を優先し不採用。
- **rollback SQL**: `ALTER TABLE enrollment_applications DROP COLUMN "documentCheckedAt", DROP COLUMN "documentCheckedBy";`（nullable列の追加なので安全に戻せる）。

### 6-2. M2: AgreementText 新設（規約DB管理）

```prisma
model AgreementText {
  id        String   @id @default(cuid())
  version   String   @unique          // 規約バージョン（例 "1.0"）
  body      String                    // 規約本文
  isActive  Boolean  @default(false)  // 現行版フラグ（有効は常に高々1件）
  updatedBy String?                   // 最終更新した管理者の表示名スナップショット
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("agreement_texts")
}
```

**設計判断（Q10）**:

- **`updatedBy` を含める**: 作成・有効化を行った管理者の表示名スナップショット（M1と同様、FKなし）。誰が現行版を切り替えたか追える。
- **AgreementLog との関係（同意version追跡）**:
  - 既存 `AgreementLog.version`（String）は「受講生が同意した時点の規約バージョン文字列」を記録する。現状は `repositories/agreementLogRepository.ts` の定数 `CURRENT_AGREEMENT_VERSION = "1.0"` を書き込んでいる。
  - DB管理化後は、**同意記録時に `AgreementText` の現行（`isActive=true`）版の `version` を読み取り、その文字列を `AgreementLog.version` に保存**する。これにより「どの版に同意したか」が版テキストと突き合わせ可能になる。
  - `AgreementLog` のスキーマは変更しない（version文字列を保持する現設計のまま）。`CURRENT_AGREEMENT_VERSION` 定数はフォールバック用に残す（下記）。
- **active version の一意性をtransactionで保証**:
  - 「有効版は高々1件」を保つため、有効化APIは**1つの `$transaction`** で次を実行する:
    1. `updateMany({ where: { isActive: true }, data: { isActive: false } })`
    2. `update({ where: { id: targetId }, data: { isActive: true, updatedBy } })`
  - これにより「全て false 化 → 対象のみ true」が原子的に成立し、同時実行でも有効版が複数残らない。
  - （Prismaで部分ユニーク制約 `WHERE isActive` を直接表現するのは難しいため、transaction方式を採用。必要なら生SQLの partial unique index を後日検討。）
- **既存定数フォールバック（後方互換）**:
  - `agreementTextService.getActive()` は `AgreementText` の `isActive=true` を返す。**該当なし（テーブル空）の場合は、既存定数 `lib/constants/agreementText.ts` の `AGREEMENT_TEXT` と `CURRENT_AGREEMENT_VERSION = "1.0"` を合成したフォールバック値を返す。**
  - `setupService` は規約取得をこの `getActive()` に委譲。DB未投入でも従来どおり規約表示・同意フローが動作する。
  - 同意記録時の version も `getActive().version`（フォールバック時は `"1.0"`）を使うため、移行前後で `AgreementLog.version` の連続性が保たれる。
- **rollback SQL**: `DROP TABLE agreement_texts;`（新規テーブルのみ。既存データへ影響なし）。

### 6-3. M3: Instructor 新設（講師管理）

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

- `VideoSupervisor` への外部キーは設けない（既存への影響回避・YAGNI）。
- **rollback SQL**: `DROP TABLE instructors;`（新規テーブルのみ）。

### 6-4. DB変更サマリ

| # | 変更 | 方式 | 破壊的 | rollback |
|---|------|------|------|------|
| M1 | EnrollmentApplication に nullable 2列 | ADD COLUMN NULL | なし | DROP COLUMN ×2 |
| M2 | AgreementText 新設 | CREATE TABLE | なし | DROP TABLE |
| M3 | Instructor 新設 | CREATE TABLE | なし | DROP TABLE |

---

## 7. リスク・注意事項

| # | リスク | 対策 |
|---|-------|------|
| R1 | **ルーティング統一に伴う移設漏れ・リンク切れ** | §1の影響表に沿って機械的に移設。`make build` + middlewareHelpers/AdminLayout testで検証。（v1にあった「今回は(B)案」は撤回・Q4=Aで統一） |
| R2 | `/courses` redirectが受講生 `/courses/[courseId]` を巻き込む | redirectは**完全一致のみ**（§1-4）。前方一致禁止 |
| R3 | SetupService改修（4-8）が認証フローを破壊 | フォールバック必須。`setupService.test.ts` を緑で維持 |
| R4 | ダッシュボードにスコープ外（講習/請求/監査）の架空数値が混入 | 実テーブル集計のみ。未実装領域のタイルは作らない（§4-1） |
| R5 | N+1クエリ（一覧・集計系） | repositoryで集計/`$transaction`を1本化 |
| R6 | ログイン再設計でE2Eセレクタ破壊 | role/labelベースのまま維持 |
| R7 | `primary` トークンのリネーム/値変更による全画面波及 | `primary` は不変。`accent`/`pageBackground` のみ追加（§3-1） |
| R8 | font重複導入（fontsource + next/font） | `@fontsource/noto-sans-jp` を再利用、`next/font/google` 不使用（§3-1） |
| R9 | 操作ログを法令監査証跡と誤認 | operational loggingと明記。改ざん防止監査はスコープ外（§5-4） |
| R10 | Prisma適用の事故 | create-only + SQL review + backup + staging + rollback（§6） |

---

## 8. 実行制御（明示承認が必要な操作）

以下は**ユーザーの明示承認なしに実行しない**:

- `git commit` / `git push`
- Pull Request の作成・更新
- 本番／staging への deploy
- **本番DBへのマイグレーション適用**（`prisma migrate deploy`、§6）

実装中のローカル作業（コード編集、ローカルでの `make build`/`make test`/`make lint`、create-onlyでのSQL生成）は計画承認の範囲で進めるが、上記の外部影響操作は都度承認を取る。

---

## 9. 要確認事項（推測せず確認）

1. **旧URL redirect の採否**: §1-4のとおり、管理者内部URLのため省略しても機能影響はない。`/courses`等の完全一致redirectを `next.config.js` に入れるか、入れずに旧URLは404とするか。
2. **`app/student/page.tsx` L102 `href="/courses"` の正しい遷移先**: Phase 0で `/courses`（管理者リスト）が消えると、この受講生ダッシュボードのリンクがdanglingになる。受講生向けのコース一覧画面は現状存在しない（`/courses/[courseId]` のみ）。正しい遷移先（受講生のコース一覧を新設するのか、別URLへ向けるのか）が不明なため、推測せず確認したい。

---

## 10. 依存関係グラフ（Q1/Q2/Q4 反映・Q3除外）

```
Q4=A（統一・確定）─► Phase 0（page route移設 / layout削除 / 内部link修正 / middleware検証）
                                  │
3-1（token: accent/pageBackground追加・primary不変・fontsource再利用）
  └─ 3-2（共通UI）
        ├─ 3-3（ログイン再設計）
        ├─ 3-4（学生nav修正 ※href="/courses"は要確認2）
        └─ 3-5（各画面token統一）← Phase 0完了が前提
                                  │
[基盤完了] ─► 4-1（管理者ダッシュボード／アラートタイル型・実データのみ）★最初に完成
                 ├─ 4-2（受講生一覧）─ 4-3（詳細タブ）
                 │                   └ 4-6（進捗一覧）
                 ├─ 4-7（台帳一覧）
                 ├─ 4-4（書類確認 / M1）─ 4-5（入学者管理）   [Q1=A]
                 ├─ 4-8（規約DB化 / M2）                       [Q2]
                 ├─ 5-1（講師管理 / M3）
                 └─ 5-2（LMS集計・実データのみ）

4-4, 4-8, 5-1 ─► 5-4（操作ログ = operational logging のみ）
（5-3 DIPS CSV は Q3未確定のため今回除外）
全実装タスク ─► Phase 6（テスト並走）
```

**クリティカルパス**: Phase 0 → 3-1 → 3-2 → 4-1（ダッシュボード）→ Phase 2残 / Phase 3
**最初に着手**: Phase 0（Q4=A確定済み）
**スコープ外**: 5-3 DIPS（Q3）、電子講習記録簿/講習カレンダー/請求/本格監査/会場・機体・審査員/キャンペーン

---

## 11. スコープ外（今回は手を付けない）

- DIPS CSV出力（#16）— Q3未確定
- 電子講習記録簿（#8-11）/ 四半期実施計画・実施状況報告（#12,13）/ 講習カレンダー（#7）— 法令・依存マスタ未整備
- 請求・収受記録（#17）— 法令確認必要
- 本格監査機能・改ざん防止監査証跡（#20-22）— 法令確認必要、operational loggingとは別物
- 会場・機体・審査員管理（#25-27）/ キャンペーン管理（#19）— 依存・要件未確定
```
