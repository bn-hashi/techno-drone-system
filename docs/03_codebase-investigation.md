# コードベース全体調査レポート

> 作成日: 2026-06-20  
> ブランチ: feature/claude-design-integration  
> 調査範囲: URL・画面、共通コンポーネント、API、DB、認証・権限、状態管理、帳票、CSV、監査ログ、ファイル保存、テスト、現在未完成の機能、要件38画面の分類

---

## 1. URL・画面一覧

### 認証・セットアップ
| URL | ファイル | 機能 |
|-----|---------|------|
| `/` | `app/page.tsx` | ランディング（/loginリンクのみ） |
| `/login` | `app/(auth)/login/page.tsx` | ログイン（LoginForm） |
| `/auth/role-redirect` | `app/auth/role-redirect/route.ts` | JWT roleに応じて/admin or /studentへ転送 |
| `/setup/password` | `app/setup/password/page.tsx` | 招待トークン検証→パスワード設定 |
| `/setup/agreement` | `app/setup/agreement/page.tsx` | 受講規約同意 |

### 管理者系
| URL | ファイル | 機能 | 状態 |
|-----|---------|------|------|
| `/admin` | `app/admin/page.tsx` | 管理者ダッシュボード | **スタブ（h1のみ）** |
| `/admin/students` | `app/admin/students/page.tsx` | 受講者一覧 | **スタブ（h1のみ）** |
| `/admin/users` | `app/admin/users/page.tsx` | ユーザー一覧（実際の一覧はここ） | 実装済み |
| `/admin/users/new` | `app/admin/users/new/page.tsx` | ユーザー新規作成 | 実装済み |
| `/admin/applications` | `app/admin/applications/page.tsx` | 入学申請一覧 | 実装済み |
| `/admin/enrollment/new` | `app/admin/enrollment/new/page.tsx` | 入学登録フォーム | 実装済み |
| `/admin/students/[id]/review` | | 審査・不正フラグ・判定 | 実装済み |
| `/admin/students/[id]/certificate` | | 修了証明書発行 | 実装済み |
| `/admin/qa` | `app/admin/qa/page.tsx` | Q&A管理 | 実装済み |
| `/courses` | `app/(admin)/courses/page.tsx` | コース管理（route group） | 実装済み |
| `/videos` | `app/(admin)/videos/page.tsx` | 動画管理（route group） | 実装済み |
| `/questions` | `app/(admin)/questions/page.tsx` | 問題バンク | 実装済み |
| `/exam-results` | `app/(admin)/exam-results/page.tsx` | 試験結果一覧 | 実装済み |
| `/students/[id]` | `app/(admin)/students/[id]/page.tsx` | 受講者詳細 | 実装済み |

### 受講生系
| URL | ファイル | 機能 |
|-----|---------|------|
| `/student` | `app/student/page.tsx` | 受講生ダッシュボード（進捗バー） |
| `/courses/[courseId]` | `app/(student)/courses/[courseId]/page.tsx` | コース内動画一覧 |
| `/courses/[courseId]/videos/[videoId]` | | 動画プレーヤー（シーク制限・視聴ログ） |
| `/exams` | `app/(student)/exams/page.tsx` | 受験資格確認・受験履歴 |
| `/exams/[examId]` | | 試験実施（ExamRunner） |
| `/exams/[examId]/result` | | 試験結果 |
| `/qa` | `app/(student)/qa/page.tsx` | 質問フォーム・履歴 |
| `/certificate` | `app/(student)/certificate/page.tsx` | 修了証明書・PDFダウンロード |

> ⚠️ **バグ**: `StudentLayout.tsx` のナビリンクが `/student/dashboard`・`/student/courses` を指しているが、これらのURLは存在しない（実際は `/student`・`/courses/[courseId]`）。

---

## 2. 共通コンポーネント一覧

### UIプリミティブ (`components/ui/`)
| コンポーネント | Props概要 |
|--------------|---------|
| `Button` | variant: primary/secondary/danger, isLoading |
| `Input` | label, error（useIdでアクセシビリティ対応） |
| `Card` | title?, className? |
| `Table<T>` | ジェネリクス: columns, data, ページネーション |
| `Badge` | variant: active/pending/danger |
| `Modal` | isOpen, onClose, title or ariaLabel |
| `LoadingSpinner` | なし |

### レイアウト (`components/layouts/`)
- `AppLayout` ← `AdminLayout` / `StudentLayout` が使用
- `QueryProvider` (TanStack Query) + `SessionProvider` はrootレイアウトに配置

### PDF (`components/pdf/`)
- `CertificatePDF` — 様式1（修了証明書）
- `CertificateLedgerPDF` — 様式5（発行台帳）

---

## 3. API Route 全一覧

### 認証系
| エンドポイント | Method | 備考 |
|--------------|--------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth（CredentialsProvider、IP別レート制限） |
| `/api/setup/password` | POST | 招待トークン検証（IP: 10回/15分） |
| `/api/setup/agreement` | POST | 同上 |

### 管理者API（全てADMINロール必須）
| エンドポイント | Method | サービス |
|--------------|--------|---------|
| `/api/admin/users` | GET/POST | UserManagementService |
| `/api/admin/users/[id]/status` | PATCH | updateStatus |
| `/api/admin/students/[id]/invite` | POST | SetupService.sendInviteEmail |
| `/api/admin/students/[id]/review` | GET | JudgmentService.getReviewData |
| `/api/admin/students/[id]/judge` | POST | JudgmentService.judgeAccepted/Rejected |
| `/api/admin/students/[id]/certificate` | POST | CertificateService.issueCertificate |
| `/api/admin/students/[id]/certificate/download` | GET | PDF stream (runtime=nodejs) |
| `/api/admin/students/[id]/certificate/ledger` | GET | 様式5 PDF stream (runtime=nodejs) |
| `/api/admin/enrollment` | GET/POST | EnrollmentService |
| `/api/admin/exam-results` | GET | ExamService.listAllResults |
| `/api/admin/questions` | GET/POST | QuestionService |
| `/api/admin/questions/[id]` | PATCH/DELETE | QuestionService |
| `/api/admin/questions/import` | POST | CSV一括インポート (text/csv) |
| `/api/admin/qa` | GET | QAService.listAll |
| `/api/admin/qa/[id]` | POST | QAService.answerQuestion |
| `/api/admin/subjects` | GET | SubjectService |
| `/api/admin/courses` | GET/POST | CourseService |
| `/api/admin/courses/[id]` | PATCH/DELETE | CourseService |
| `/api/admin/videos` | GET/POST | VideoService |
| `/api/admin/videos/[id]` | PATCH/DELETE | VideoService |
| `/api/admin/videos/[id]/supervisors` | POST/DELETE | VideoSupervisor CRUD |

### 受講生API（STUDENTロール + ACTIVE以上必須）
| エンドポイント | 認可条件 |
|--------------|---------|
| `/api/student/progress` | ACTIVE |
| `/api/student/courses/[courseId]/videos` | ACTIVE |
| `/api/student/videos/[id]` | ACTIVE |
| `/api/student/viewing-log` | ACTIVE |
| `/api/student/fraud-flag` | ACTIVE |
| `/api/student/exams/eligibility` | ACTIVE |
| `/api/student/exams` | ACTIVE (POST: 試験開始) |
| `/api/student/exams/[id]` | ACTIVE |
| `/api/student/exams/[id]/submit` | ACTIVE |
| `/api/student/exams/[id]/result` | ACTIVE〜DIPS_LINKED |
| `/api/student/qa` | GET/POST | ACTIVE〜DIPS_LINKED |
| `/api/student/certificate/download` | CERTIFIED/DIPS_LINKED |
| `/api/enrollment/documents` | STUDENT (status不問) |

---

## 4. DB（Prismaスキーマ）

### モデル一覧
| モデル | 状態 | 備考 |
|--------|------|------|
| `User` | 実装済み | role(ADMIN/STUDENT), status(7種), courseType |
| `EnrollmentApplication` | 実装済み | `applicantNumber`は未実装フィールド |
| `AgreementLog` | 実装済み | 同意時にatomicでACTIVE化 |
| `Subject` | 実装済み | BEGINNER/EXPERIENCED別の必要時間 |
| `Course` | 実装済み | |
| `Video` | 実装済み | filePath = nginxが配信 |
| `VideoSupervisor` | 実装済み | 様式1 PDF用（講師名・登録番号） |
| `ViewingLog` | 実装済み | 10秒間隔POST + sendBeacon |
| `SubjectProgress` | 実装済み | upsertでatomicに更新 |
| `Question` | 実装済み | 選択肢4択、correctIndexは0始まり |
| `Exam` | 実装済み | Fisher-Yatesシャッフル、タイムアウト対応 |
| `ExamAnswer` | 実装済み | |
| `QARecord` | 実装済み | |
| `CompletionCertificate` | 実装済み | JST月別連番採番 |
| `DIPSExportLog` | **モデルのみ** | Service/Repository/API全て未実装 |
| `FraudFlag` | 一部実装 | TAB_LEAVEのみ。CONCURRENT_LOGIN/SPEED_VIOLATIONはenumのみ、resolvedAtは未使用 |
| `JudgmentRecord` | 実装済み | ACCEPTED/REJECTEDをatomicにUserStatusと更新 |

**UserStatus 7種:** PENDING_REGISTRATION → PENDING_ACTIVATION → ACTIVE → EXAM_PASSED → COMPLETED → CERTIFIED → DIPS_LINKED

---

## 5. 認証・権限

- **Provider**: CredentialsProvider のみ（NextAuth.js）
- **JWT payload**: `id`, `role`(ADMIN/STUDENT), `status`(7種)
- **Middleware** (Edge): `/admin/*`はADMIN、`/student/*`はSTUDENT必須
- **ステータス制御**: `isLoginAllowed` = ACTIVE/EXAM_PASSED/COMPLETED/CERTIFIED/DIPS_LINKED。PENDING_*はログイン自体をブロック
- **状態機械**: `statusTransitions.ts` — 許可された遷移のみ実行可能
- **レート制限**: IPベースのインメモリ実装（10回/15分）。マルチプロセス非対応

---

## 6. 状態管理

- **Server Components優先**: データ取得は全てServer Componentの`await fetch`
- **TanStack Query**: `useMutation`のみ使用（`useQuery`は使わない）。更新後は`router.refresh()`でServer Component再フェッチ
- **ローカルstate**: `useState`でフォーム入力・loading・error管理
- **カスタムフック**: `useViewingLog`（10秒ごとPOST + sendBeacon）、`useVisibilityDetection`（60秒超タブ離脱で不正フラグ）
- **セッションストレージ**: 試験中の回答を一時保存（`lib/exam/storage.ts`）

---

## 7. 帳票（PDF生成）

| 帳票 | ジェネレーター | 保存場所 | API |
|------|-------------|---------|-----|
| 様式1：修了証明書 | `lib/certificate/pdfGenerator.ts` | `/home/ubuntu/uploads/certificates/` | `/api/admin/students/[id]/certificate/download` |
| 様式5：修了証明書発行台帳 | `lib/certificate/ledgerPdfGenerator.ts` | **ディスク保存なし**（都度生成） | `/api/admin/students/[id]/certificate/ledger` |

- `@react-pdf/renderer` + `NotoSansJP`フォント（`@fontsource/noto-sans-jp`）
- `runtime = "nodejs"` 必須（EdgeランタイムはfsとreactPDF非対応）
- ⚠️ `CertificatePDF.tsx` の取扱区分（「二等・回転翼マルチ・基本」）がハードコード。コメントに「props化検討」あり

---

## 8. CSV

| 機能 | 実装状況 |
|------|---------|
| 問題インポート（CSV→DB） | **実装済み** — `lib/csvParser.ts`、RFC 4180サブセット、BOM除去、冪等 |
| DIPSエクスポート（DB→CSV） | **未実装** — `DIPSExportLog`モデルのみ。`lib/csvExporter.ts`が必要 |

---

## 9. 監査ログ

| ログ | 書き込み処理 | 実装状況 |
|------|------------|---------|
| `AgreementLog` | 規約同意時（AtomicでACTIVE化） | ✓ |
| `ViewingLog` | 視聴セッション記録 | ✓ |
| `SubjectProgress` | 視聴ログと同トランザクション | ✓ |
| `FraudFlag` | タブ離脱（TAB_LEAVE）のみ | 一部 |
| `JudgmentRecord` | 管理者審査（合否問わず） | ✓ |
| `DIPSExportLog` | **未実装** | ✗ |

> ⚠️ 監査ダッシュボード用の集計APIは存在しない。

---

## 10. ファイル保存

| 種別 | パス | 処理 |
|------|------|------|
| 書類（本人確認・写真・経験証明） | `/home/ubuntu/uploads/{id-documents,photos,experience-certs}/` | `lib/upload.ts`、magic byte検証、10MB上限、UUIDファイル名 |
| 修了証明書PDF | `/home/ubuntu/uploads/certificates/` | `pdfGenerator.ts`経由 |
| 動画 | `/home/ubuntu/videos/` | アプリは書き込まない、nginx直接配信 |

セキュリティ: `file-type`でMIMEスプーフィング防止、パストラバーサル防止、0o600パーミッション

---

## 11. テスト

| 種別 | ファイル数 | テスト数 |
|------|----------|---------|
| ユニット/インテグレーション | 122ファイル | 1,600件以上 |
| E2E (Playwright) | 4ファイル | 68件（うち3件 `test.fixme`） |

| レイヤー | カバレッジ |
|---------|----------|
| services/ | 17ファイル、453件 |
| repositories/ | 16ファイル、276件 |
| app/api/ | 38ファイル、372件 |
| components/ | 24ファイル、201件 |
| lib/ | 20ファイル、207件 |

> ⚠️ `invitation-flow.spec.ts` の3テストが `test.fixme` — `.env.local`に`INVITE_TOKEN_SECRET`が未設定のため

---

## 12. 現在の未完成機能

| # | 未完成箇所 | 詳細 |
|---|-----------|------|
| 1 | **管理者ダッシュボード** | `app/admin/page.tsx` がスタブ（9行のみ） |
| 2 | **受講者一覧画面** | `app/admin/students/page.tsx` がスタブ。`/admin/users`に実装あり |
| 3 | **書類アップロードUI** | API（`/api/enrollment/documents`）はあるが受講生向け画面なし |
| 4 | **DIPSエクスポートCSV** | `DIPSExportLog`モデルのみ。Service/Repository/API/UI全て未実装 |
| 5 | **StudentLayoutナビリンク** | `/student/dashboard`・`/student/courses` は存在しないURL |
| 6 | **FraudFlag解消フロー** | `resolvedAt`フィールドはあるが書き込まない |
| 7 | **不正検知2種** | `CONCURRENT_LOGIN`・`SPEED_VIOLATION`はenumのみ |
| 8 | **受講規約テキスト** | `agreementText.ts`が仮テキスト（法務確認前のプレースホルダー） |
| 9 | **本番ロガー** | `lib/logger.ts:17` にTODO（Sentry/Datadog未接続） |
| 10 | **技能証明申請者番号** | `EnrollmentApplication.applicantNumber`は管理UI未実装 |
| 11 | **E2Eテスト3件** | `INVITE_TOKEN_SECRET`不一致で`test.fixme` |
| 12 | **CertificatePDF取扱区分** | 「二等・回転翼マルチ・基本」ハードコード（コメントにprops化検討と記載） |

---

## 13. 要件メモ38画面の実装分類

### ✅ 実装済み（9画面）

| # | 画面名 | 現在のURL | 備考 |
|---|--------|----------|------|
| 1 | ログイン画面 | `/login` | rate limit、E2E有 |
| 14 | 修了証明書発行 | `/admin/students/[id]/certificate` | 発行・PDF download完備 |
| 31 | eラーニングコース管理 | `/courses` | CRUD完備 |
| 32 | 動画教材管理 | `/videos` | CRUD完備 |
| 34 | 学科修了試験管理 | `/questions` | 問題CRUD + CSVインポート実装済み |
| 35 | 質問フォーム管理 | `/admin/qa` | 回答機能あり |
| 36 | 受講生マイページ | `/student` | 科目別進捗バー |
| 37 | 受講生用動画視聴画面 | `/courses/[courseId]/videos/[videoId]` | シーク制限・不正検知・視聴ログ完備 |
| 38 | 受講生用修了試験画面 | `/exams/[examId]` | タイムアウト・自動提出・結果表示 |

---

### ⚠️ 一部実装（8画面）

| # | 画面名 | 実装済み部分 | 不足している部分 |
|---|--------|------------|----------------|
| 2 | 管理者ダッシュボード | ルート存在（`/admin`） | **中身がスタブ**。KPI・今日の予定・要対応タスク等全て未実装 |
| 3 | 受講生一覧 | `/admin/users`（ステータス変更・詳細リンク） | 要件の列（電話・進捗・修了審査状況・支払状況等）なし。`/admin/students`はスタブ |
| 4 | 受講生詳細 | `/students/[id]`（基本情報・招待・判定・証明書） | 書類タブ・監査資料タブ・講習記録連携なし |
| 5 | 入学申込フォーム管理 | `/admin/applications`（一覧）、`/admin/enrollment/new` | 書類アップロードUIなし、本人確認ステータス管理なし |
| 6 | 入学者管理 | `/admin/applications` + `/admin/users` で部分カバー | 独立した入学者管理画面なし。承認フロー・書類確認UI未実装 |
| 15 | 修了証明書発行台帳 | `ledgerPdfGenerator.ts`（様式5PDF）、API有 | 一覧画面なし。台帳管理UI（検索・フィルタ・再発行申請）未実装 |
| 16 | CSV出力（DIPS連携） | `DIPSExportLog` DBモデルのみ | **Service/Repository/API/UI全て未実装** |
| 33 | 受講生進捗管理 | `ProgressService`・API・受講生側ダッシュボード | 管理者向け進捗一覧・フィルタ・期限アラートなし |

---

### ❌ 未実装（21画面）

| # | 画面名 | DBモデル有無 | 備考 |
|---|--------|------------|------|
| 7 | 講習カレンダー | なし | スケジューリング機能全般なし |
| 8 | 電子講習記録簿 | なし | **最重要の未実装機能**。法令上の核心 |
| 9 | 学科講習記録入力 | なし | 電子講習記録簿のサブ機能 |
| 10 | 実地講習記録入力 | なし | 同上 |
| 11 | 修了審査記録入力 | なし | 同上 |
| 12 | 四半期実施計画書 | なし | PDF出力機能含む |
| 13 | 実施状況報告書 | なし | 電子講習記録簿と連動する自動生成 |
| 17 | 請求・入金・収受記録 | なし | 収受記録は法令要件 |
| 18 | 受講規約管理 | なし | 現在はハードコード仮テキスト |
| 19 | キャンペーン管理 | なし | — |
| 20 | 監査ダッシュボード | なし | 集計APIもなし |
| 21 | 監査資料不足一覧 | なし | チェックロジック自体が未実装 |
| 22 | 監査報告書・是正措置管理 | なし | — |
| 23 | スクール設定 | なし | 会場・講師・機体等のマスタ管理 |
| 24 | 講師管理 | `VideoSupervisor`のみ（動画付き） | 独立した講師ロール・管理画面なし |
| 25 | 修了審査員管理 | なし | DBモデルもなし |
| 26 | 会場管理 | なし | — |
| 27 | 機体管理 | なし | — |
| 28 | 飛行許可承認書管理 | なし | 期限アラートも未実装 |
| 29 | 事務規程・登録申請書管理 | なし | — |
| 30 | LMS管理ダッシュボード | なし | `/admin`とは独立した専用ダッシュボード |

---

### 📊 サマリー

| 分類 | 件数 | 割合 |
|------|------|------|
| ✅ 実装済み | 9 | 24% |
| ⚠️ 一部実装 | 8 | 21% |
| ❌ 未実装 | 21 | 55% |
| 🚫 不要 | 0 | — |
| ❓ 要確認 | 0 | — |

---

## 所見

eラーニング部分（31〜38）は8画面中7画面が実装済みと成熟しています。一方、業務管理部分（1〜29）は29画面中17画面が未実装または部分実装の状態です。

特に「電子講習記録簿（8）」は法令要件の核心であり、かつ「実施状況報告書（13）」「四半期実施計画書（12）」「監査ダッシュボード（20）」と密接に連動するため、最優先の実装候補と考えられます。ただし、実装前に法令仕様の確認が必須です。
