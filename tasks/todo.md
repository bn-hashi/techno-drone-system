# タスク一覧 (GitHub Issues)

> 1 タスク = 1 Issue。実装着手前に対応する Issue をオープンし、完了時にクローズする。
>
> **状態 (2026-07-12 更新)**: 本ファイルの Issue #1〜#21 (MVP 全 Phase) は実装完了済み。
> 以降の開発は飛行管理 (機体/飛行計画/飛行日誌)・DIPS 2.0 API 連携・品質ブラッシュアップ
> (CI 構築・E2E 拡充) として PR ベースで進行中。経緯は `docs/` と各 PR を参照。

---

## Phase 1: 基盤構築

---

### Issue #1: Next.js プロジェクト初期化・開発環境構築

**背景**
本システムのすべての実装はこのプロジェクト基盤に乗る。正しいディレクトリ構成・設定・ツールチェーンを最初に確立することで、後続フェーズの品質を保つ。

**受け入れ条件**
- [ ] `npx create-next-app@14` で Next.js 14 (App Router) プロジェクトを作成
- [ ] TypeScript strict モードが有効である
- [ ] ESLint (next/core-web-vitals)、Prettier が設定されている
- [ ] Tailwind CSS が設定され、`tailwind.config.ts` にデザイントークン (カラー・フォント) が定義されている
- [ ] ディレクトリ構成が存在する: `app/`, `components/`, `hooks/`, `lib/`, `types/`, `services/`, `repositories/`
- [ ] `Makefile` に `dev`, `test`, `lint`, `migrate`, `seed` コマンドが定義されている
- [ ] Vitest + React Testing Library が設定されている
- [ ] `make dev` でローカル起動できる

**関連ファイル候補**
- `package.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `eslint.config.js` / `.eslintrc.json`
- `.prettierrc`
- `Makefile`
- `vitest.config.ts`

**工数見積もり**: 0.5日

**依存する他タスク**: なし

---

### Issue #2: Prisma スキーマ定義・初期マイグレーション

**背景**
全機能のデータ永続化基盤。法的必須項目を含む全テーブルを最初に正しく定義することで、後続フェーズでのスキーマ変更コストを最小化する。

**受け入れ条件**
- [ ] `prisma/schema.prisma` に以下の全テーブルが定義されている
  - `User` (id, email, name, passwordHash, role, courseType, status, expiresAt)
  - `EnrollmentApplication` (id, userId, applicationDate, idDocumentPath, photoPath, experienceCertPath, acceptedAt)
  - `AgreementLog` (id, userId, version, agreedAt)
  - `Subject` (id, name, code, requiredMinutesBeginner, requiredMinutesExperienced)
  - `Course` (id, name, type)
  - `Video` (id, title, description, subjectId, courseId, filePath, duration, sortOrder, isPublished)
  - `VideoSupervisor` (id, videoId, name, instructorRegistrationNumber)
  - `ViewingLog` (id, userId, videoId, startedAt, endedAt, watchedSeconds, rawLog)
  - `SubjectProgress` (id, userId, subjectId, totalWatchedMinutes, isFulfilled)
  - `Question` (id, subjectId, body, choices, correctIndex, explanation)
  - `Exam` (id, userId, startedAt, endedAt, score, totalQuestions, passed, status)
  - `ExamAnswer` (id, examId, questionId, selectedIndex, isCorrect)
  - `QARecord` (id, userId, question, answer, questionedAt, answeredAt, answeredBy)
  - `CompletionCertificate` (id, userId, certificateNumber, issuedAt, expiresAt, pdfPath)
  - `DIPSExportLog` (id, userId, certificateId, exportedAt, csvPath, status)
  - `FraudFlag` (id, userId, type, description, detectedAt, resolvedAt)
- [ ] 初期マイグレーションが成功する (`make migrate`)
- [ ] シードスクリプトで管理者アカウント・4科目マスタ・サンプルコース・5問の試験問題が投入できる
- [ ] `make seed` が冪等に実行できる (再実行してもエラーにならない)

**関連ファイル候補**
- `prisma/schema.prisma`
- `prisma/migrations/`
- `prisma/seed.ts`
- `lib/db.ts` (Prisma Client シングルトン)

**工数見積もり**: 1日

**依存する他タスク**: #1

---

### Issue #3: NextAuth.js 認証基盤・ルートガード

**背景**
受講者・管理者のロール分離はシステムの全機能に影響する。最初に正しく認証基盤を構築することで、後続フェーズで各ページの保護を確実に行える。

**受け入れ条件**
- [ ] NextAuth.js が Credentials Provider で設定されている
- [ ] パスワードは bcrypt でハッシュ化されて保存・検証される
- [ ] セッションは JWT ベース
- [ ] ロール: `ADMIN`, `STUDENT` の 2 種類
- [ ] `middleware.ts` でルートガードが実装されている
  - `/admin/*` は `ADMIN` のみアクセス可
  - `/student/*` は `STUDENT` のみアクセス可
  - 未認証は `/login` にリダイレクト
- [ ] ログイン画面 (`/login`) が実装されている
- [ ] ログアウト機能が実装されている
- [ ] 認証フロー (ログイン成功・失敗・ロール別リダイレクト) の単体テストがある

**関連ファイル候補**
- `app/api/auth/[...nextauth]/route.ts`
- `middleware.ts`
- `app/(auth)/login/page.tsx`
- `lib/auth.ts`
- `services/authService.ts`
- `repositories/userRepository.ts`

**工数見積もり**: 0.5日

**依存する他タスク**: #1, #2

---

### Issue #4: 共通レイアウト・UIコンポーネント

**背景**
全ページで使用する共通レイアウトとUIコンポーネントを先に整備することで、後続フェーズのUI実装を効率化する。

**受け入れ条件**
- [ ] 受講者用レイアウト (`components/layouts/StudentLayout.tsx`) が実装されている
- [ ] 管理者用レイアウト (`components/layouts/AdminLayout.tsx`) が実装されている
- [ ] 以下の共通UIコンポーネントが実装されている
  - `Button` (variant: primary/secondary/danger, loading状態)
  - `Input` (エラー表示対応)
  - `Card`
  - `Modal`
  - `Table` (ページネーション対応)
  - `Badge` (status表示用)
  - `LoadingSpinner`
- [ ] 全コンポーネントは TypeScript strict + 名前付き export
- [ ] Tailwind CSS のみ使用 (インラインスタイル・CSS Modules 禁止)

**関連ファイル候補**
- `components/layouts/`
- `components/ui/`
- `app/(admin)/layout.tsx`
- `app/(student)/layout.tsx`

**工数見積もり**: 0.5日

**依存する他タスク**: #1, #3

---

## Phase 2: ユーザー管理・入学申請

---

### Issue #5: 管理者による受講者アカウント管理

**背景**
受講者アカウントは管理者が作成・管理する。仮登録 → 本登録のステータス遷移が法的記録の起点となる。

**受け入れ条件**
- [ ] `UserRepository`: CRUD, ステータス別一覧取得が実装されている
- [ ] `UserService`: 受講者作成・ステータス変更・一覧取得が実装されている
- [ ] API `POST /api/admin/students` で受講者登録できる
- [ ] API `GET /api/admin/students` で受講者一覧取得できる (ページネーション対応)
- [ ] API `PATCH /api/admin/students/[id]` でステータス更新できる
- [ ] 管理者画面: 受講者一覧ページ (`/admin/students`)
- [ ] 管理者画面: 受講者新規登録フォーム (氏名・メール・コース区分: 初学者/経験者)
- [ ] アカウント有効期限設定ができる
- [ ] UserService の単体テスト (作成・重複メールエラー・ステータス遷移) がある

**関連ファイル候補**
- `repositories/userRepository.ts`
- `services/userService.ts`
- `app/api/admin/students/route.ts`
- `app/api/admin/students/[id]/route.ts`
- `app/(admin)/students/page.tsx`
- `app/(admin)/students/new/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #2, #3, #4

---

### Issue #6: 入学申請・本人確認資料の電子管理

**背景**
航空法の要件として入学申請情報と本人確認資料の電子保管が義務付けられている。受理帳簿の自動記録も必要。

**受け入れ条件**
- [ ] ファイルアップロードユーティリティが実装されている (`/home/ubuntu/uploads/` 保存)
- [ ] `EnrollmentApplicationRepository`: 申請 CRUD が実装されている
- [ ] `EnrollmentService`: 申請受理・資料アップロード・受理帳簿記録が実装されている
- [ ] API `POST /api/admin/enrollment` で入学申請を登録できる
- [ ] 管理者画面: 入学申請・本人確認フォーム
  - 氏名・生年月日・住所・連絡先
  - 本人確認資料アップロード (JPEG/PNG/PDF, 上限10MB)
  - 顔写真アップロード
  - 経験者コースの場合: 経験証明資料アップロード
- [ ] アップロードファイルのパスが DB に保存される
- [ ] EnrollmentService の単体テスト (申請受理・ファイルパス保存) がある

**関連ファイル候補**
- `repositories/enrollmentApplicationRepository.ts`
- `services/enrollmentService.ts`
- `lib/fileUpload.ts`
- `app/api/admin/enrollment/route.ts`
- `app/(admin)/enrollment/new/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #5

---

### Issue #7: 本登録フロー・受講規約同意

**背景**
受講者が本登録を完了し受講規約に同意したことの記録は法的必須。同意バージョン・日時の保存が必要。

**受け入れ条件**
- [ ] `EmailService`: Resend 経由で本登録案内メールを送信できる
- [ ] 本登録案内メールに一時トークン付きURLが含まれる (有効期限 72時間)
- [ ] 受講者画面: パスワード設定ページ (`/setup/password`)
- [ ] 受講者画面: 受講規約同意ページ (`/setup/agreement`)
  - 規約全文表示
  - チェックボックス + 同意ボタン
- [ ] 同意時に `AgreementLog` にバージョン・日時が保存される
- [ ] 規約同意なしでは受講ページにアクセスできない
- [ ] EmailService の単体テスト (メール送信成功・失敗時のエラー処理) がある

**関連ファイル候補**
- `services/emailService.ts`
- `lib/token.ts`
- `app/(student)/setup/password/page.tsx`
- `app/(student)/setup/agreement/page.tsx`
- `repositories/agreementLogRepository.ts`

**工数見積もり**: 1日

**依存する他タスク**: #5, #6

---

## Phase 3: 教材管理・動画視聴

---

### Issue #8: 教材・コース管理 (管理者)

**背景**
コース・科目・動画のメタデータ管理と監修者情報の記録は法的必須 (4.2)。管理者が動画配信の設定を行う基盤。

**受け入れ条件**
- [ ] `SubjectRepository`, `CourseRepository`, `VideoRepository`, `VideoSupervisorRepository` が実装されている
- [ ] `CourseService`: コース CRUD, 科目別必要時間設定 (初学者/経験者) が実装されている
- [ ] `VideoService`: 動画メタデータ CRUD, 監修者情報登録・編集が実装されている
- [ ] API: 科目・コース・動画の CRUD エンドポイント群
- [ ] 管理者画面: コース管理 (`/admin/courses`)
- [ ] 管理者画面: 動画メタデータ登録・編集
  - タイトル・説明・科目紐付け・視聴順序・公開/非公開
  - 監修者情報 (氏名・講師登録番号)
- [ ] VideoService の単体テスト (CRUD, 監修者登録) がある

**関連ファイル候補**
- `repositories/subjectRepository.ts`
- `repositories/courseRepository.ts`
- `repositories/videoRepository.ts`
- `services/courseService.ts`
- `services/videoService.ts`
- `app/api/admin/courses/route.ts`
- `app/api/admin/videos/route.ts`
- `app/(admin)/courses/page.tsx`
- `app/(admin)/videos/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #2, #4

---

### Issue #9: 動画視聴プレーヤー・不正防止機能

**背景**
受講時間の正確な計測と不正防止 (4.3, 4.4) は法的要件。初回視聴時のシークバー制限・タブ離脱検知・秒単位ログが必須。

**受け入れ条件**
- [ ] `VideoPlayer` コンポーネントが実装されている
  - HTML5 video 要素 + カスタムコントロール UI
  - nginx 配信URL (`/videos/{filename}`) を使用
  - 再生/停止/音量/フルスクリーン
  - 再生速度変更 (0.75x, 1x, 1.25x, 1.5x)
- [ ] 初回視聴時シークバー制限: 未視聴区間へのスキップを禁止
- [ ] 2回目以降は自由シーク可能
- [ ] `Page Visibility API` でバックグラウンド時に再生停止
- [ ] タブ離脱検知で `FraudFlag` を記録
- [ ] 視聴ログを 10秒間隔でバッチ送信 (`POST /api/viewing-log`)
- [ ] API `POST /api/viewing-log`: 受信した秒単位ログを `ViewingLog` に保存
- [ ] VideoPlayer コンポーネントのテスト (シーク制限, ログ送信) がある

**関連ファイル候補**
- `components/VideoPlayer.tsx`
- `hooks/useViewingLog.ts`
- `hooks/useVisibilityDetection.ts`
- `app/api/viewing-log/route.ts`
- `repositories/viewingLogRepository.ts`

**工数見積もり**: 1.5日

**依存する他タスク**: #8

---

### Issue #10: 科目別進捗管理・受講順序制御

**背景**
科目別受講時間の充足確認は法的必須 (4.5)。初学者・経験者で必要時間が異なるため、コース区分別の判定が必要。

**受け入れ条件**
- [ ] `ProgressService` が実装されている
  - 視聴ログから科目別累積時間を集計
  - コース区分 (初学者/経験者) に応じた必要時間で充足判定
  - 全科目充足で「受講成立可能」フラグを更新
- [ ] API `GET /api/student/progress`: 科目別進捗を取得できる
- [ ] 受講者画面: 受講ダッシュボード (`/student/dashboard`)
  - 科目別進捗バー (進捗時間/必要時間)
  - 全体進捗サマリー
- [ ] 受講順序制御: 前の動画が完了するまで次の動画がロック表示
- [ ] 受講者画面: 動画一覧 + 視聴ページ (`/student/courses/[courseId]/videos/[videoId]`)
- [ ] ProgressService の単体テスト (充足判定・初学者/経験者別) がある

**関連ファイル候補**
- `services/progressService.ts`
- `repositories/subjectProgressRepository.ts`
- `app/api/student/progress/route.ts`
- `app/(student)/dashboard/page.tsx`
- `app/(student)/courses/[courseId]/videos/[videoId]/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #9

---

## Phase 4: 修了確認試験

---

### Issue #11: 問題バンク管理・CSV 一括インポート

**背景**
問題は 230問以上を想定。管理者が問題を登録・編集できる必要がある。MVP 開発用に 5問のシードデータを提供する。

**受け入れ条件**
- [ ] `QuestionRepository`: CRUD, 科目別フィルタリングが実装されている
- [ ] `QuestionService`: CRUD, CSV 一括インポートが実装されている
- [ ] CSV フォーマット: `科目コード,問題文,選択肢1,選択肢2,選択肢3,正答番号(1-3),解説`
- [ ] API: 問題 CRUD + CSV インポートエンドポイント
- [ ] 管理者画面: 問題バンク管理 (`/admin/questions`)
  - 問題一覧 (科目別フィルタ)
  - 問題新規登録・編集フォーム
  - CSV 一括インポート
- [ ] シードデータに 5問の問題が含まれる (4科目均等)
- [ ] QuestionService の単体テスト (CRUD, CSV パース・インポート) がある

**関連ファイル候補**
- `repositories/questionRepository.ts`
- `services/questionService.ts`
- `lib/csvParser.ts`
- `app/api/admin/questions/route.ts`
- `app/(admin)/questions/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #2, #4

---

### Issue #12: 修了確認試験の実施・採点・解答用紙保存

**背景**
修了確認試験は法的必須 (4.6)。合否基準 (正答率80%) と採点解答用紙の電子保存が義務付けられている。

**受け入れ条件**
- [ ] `ExamService` が実装されている
  - 受験条件チェック: 全科目の最低受講時間が充足されているか
  - ランダム出題: 科目均等配分 (設定可能な出題数)
  - タイマー管理: 試験時間制限 (設定可能)
  - 採点: 各問の正誤判定
  - 合否判定: 正答率 80% 以上で合格
  - 再受験管理: 不合格時の再受験可否・間隔
- [ ] 試験結果と全設問の回答が `Exam`, `ExamAnswer` テーブルに保存される
- [ ] 受講者画面: 試験開始画面 (受験条件確認)
- [ ] 受講者画面: 試験 UI (問題表示・選択肢・残り時間・前へ/次へ・提出)
- [ ] 受講者画面: 試験結果表示 (合否・正答率・科目別成績)
- [ ] API: 試験開始/回答保存/結果取得 エンドポイント
- [ ] 管理者画面: 試験結果一覧 (`/admin/exam-results`)
- [ ] ExamService の単体テスト (採点・合否判定・受験条件チェック) がある

**関連ファイル候補**
- `repositories/examRepository.ts`
- `repositories/examAnswerRepository.ts`
- `services/examService.ts`
- `app/api/student/exam/route.ts`
- `app/(student)/exam/page.tsx`
- `app/(student)/exam/result/page.tsx`
- `app/(admin)/exam-results/page.tsx`

**工数見積もり**: 1.5日

**依存する他タスク**: #10, #11

---

## Phase 5: 質疑応答・受講確認

---

### Issue #13: 質疑応答機能

**背景**
質疑応答の導線・記録保存は法的必須 (4.7)。受講者からの質問と管理者の回答の全履歴を保存する。

**受け入れ条件**
- [ ] `QARepository`, `QAService` が実装されている
- [ ] 受講者画面: 質問投稿フォーム + 質問履歴 (`/student/qa`)
- [ ] 管理者画面: 質問一覧 + 回答フォーム (`/admin/qa`)
- [ ] 回答時に受講者へメール通知 (Resend)
- [ ] 全質疑応答が `QARecord` テーブルに保存される
- [ ] QAService の単体テスト (質問投稿・回答・履歴取得) がある

**関連ファイル候補**
- `repositories/qaRepository.ts`
- `services/qaService.ts`
- `app/api/student/qa/route.ts`
- `app/api/admin/qa/route.ts`
- `app/(student)/qa/page.tsx`
- `app/(admin)/qa/page.tsx`

**工数見積もり**: 0.5日

**依存する他タスク**: #5, #7

---

### Issue #14: 管理者による受講確認・成立判定

**背景**
管理者が科目別受講時間と視聴ログを確認した上で受講成立/不成立を判定する操作と履歴保存が必要。

**受け入れ条件**
- [ ] `JudgmentService`: 受講成立/不成立判定・受講者ステータス更新が実装されている
- [ ] 管理者画面: 受講確認ダッシュボード (`/admin/students/[id]/review`)
  - 科目別受講時間充足状況
  - 視聴ログサマリー (不正フラグを含む)
  - 受講成立/不成立 判定ボタン
- [ ] 判定結果と判定日時が DB に保存される
- [ ] 受講不成立の場合に受講者へ通知メールが送信される
- [ ] JudgmentService の単体テスト (判定処理・ステータス遷移) がある

**関連ファイル候補**
- `services/judgmentService.ts`
- `app/api/admin/students/[id]/judge/route.ts`
- `app/(admin)/students/[id]/review/page.tsx`

**工数見積もり**: 0.5日

**依存する他タスク**: #10, #12

---

## Phase 6: 修了証明書・DIPS 連携・監査資料

---

### Issue #15: 修了証明書 PDF 生成・発行

**背景**
修了証明書は様式1 (D検様式240302-01) に準拠した PDF の発行が法的必須 (4.10)。採番ルールと発行台帳の自動更新も必要。

**証明書番号採番ルール**
`第TC{機関コード4桁}{年2桁}{月2桁}{連番4桁}号`
例: `第TC051524091142号`
- 機関コード: `0515` (固定)
- 連番: 同月内の発行件数で自動採番

**PDF 記載事項 (様式1より)**
- 証明書番号、修了日、有効期限 (修了日から1年)
- 受講者氏名、技能証明申請者番号
- 修了審査員氏名
- 登録講習機関名・スクール名・登録講習機関コード・講習事務所コード
- 区分表 (一等/二等 × 機体種別 × 限定解除事項) ※今回は二等・回転翼マルチ・基本

**受け入れ条件**
- [ ] 採番ルール通りの証明書番号が自動生成される (同月内の重複なし)
- [ ] `@react-pdf/renderer` で様式1に準拠した PDF が生成される
- [ ] NotoSansJP フォントが埋め込まれ日本語が正常表示される
- [ ] 有効期限は修了日から 1年後の前日 (例: 9/25修了 → 翌年9/24まで有効)
- [ ] PDF が `/home/ubuntu/uploads/certificates/` に保存される
- [ ] `CompletionCertificate` テーブルに発行記録が保存される
- [ ] 発行台帳 (様式5) も PDF 生成できる
- [ ] 管理者画面: 修了証明書発行ページ (`/admin/students/[id]/certificate`)
- [ ] 受講者画面: 修了証明書ダウンロードページ (`/student/certificate`)
- [ ] 修了証明書交付通知メールが Resend 経由で送信される
- [ ] `CertificateService` の単体テスト (採番・有効期限計算・PDF生成) がある

**関連ファイル候補**
- `services/certificateService.ts`
- `repositories/completionCertificateRepository.ts`
- `components/pdf/CertificatePDF.tsx`
- `lib/certificateNumbering.ts`
- `app/api/admin/students/[id]/certificate/route.ts`
- `app/(admin)/students/[id]/certificate/page.tsx`
- `app/(student)/certificate/page.tsx`

**工数見積もり**: 1.5日

**依存する他タスク**: #12, #14

---

### Issue #16: DIPS2.0 連携 CSV 出力

**背景**
技能証明申請のための DIPS2.0 連携 CSV 出力は法的必須 (4.11)。連携ステータスの管理と未連携一覧の提供が必要。

**受け入れ条件**
- [ ] `DIPSExportService`: 航空局指定様式 CSV を生成できる
- [ ] CSV 出力時に `DIPSExportLog` テーブルに記録される
- [ ] 連携ステータス: `PENDING` → `EXPORTED` → `CONFIRMED` の遷移が管理できる
- [ ] 管理者画面: DIPS 連携管理 (`/admin/dips`)
  - 未連携の修了者一覧
  - CSV ダウンロードボタン
  - 連携済みステータス更新
- [ ] DIPSExportService の単体テスト (CSV 生成・カラム順序) がある
- [ ] ※CSV の正確なカラム定義は Phase 6 着手時にユーザーから受領する

**関連ファイル候補**
- `services/dipsExportService.ts`
- `repositories/dipsExportLogRepository.ts`
- `lib/csvGenerator.ts`
- `app/api/admin/dips/route.ts`
- `app/(admin)/dips/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #15

---

### Issue #17: 監査資料 CSV 出力 (10 種類の帳簿)

**背景**
帳簿の法定保存期間 3年間の遵守と、監査時の資料提出を容易にする (4.8)。10 種類の帳簿が CSV で出力できる必要がある。

**対象帳簿 (10種類)**
1. 受講者台帳
2. 受理帳簿 (入学申請)
3. 本人確認記録
4. 規約同意ログ
5. 科目別受講時間記録
6. 視聴ログ (科目別サマリー)
7. 修了確認試験結果一覧 (採点解答用紙)
8. 質疑応答記録
9. 修了証明書交付台帳
10. DIPS 連携状況台帳

**受け入れ条件**
- [ ] `AuditService`: 10 種類の帳簿 CSV を生成できる
- [ ] 出力日付フィルター (期間指定) が使用できる
- [ ] 管理者画面: 監査資料出力 (`/admin/audit`)
  - 帳簿種別選択
  - 期間指定フィルター
  - CSV ダウンロードボタン
- [ ] AuditService の単体テスト (各帳簿のカラム定義確認) がある

**関連ファイル候補**
- `services/auditService.ts`
- `app/api/admin/audit/route.ts`
- `app/(admin)/audit/page.tsx`

**工数見積もり**: 1日

**依存する他タスク**: #15

---

## Phase 7: 管理者ダッシュボード・仕上げ

---

### Issue #18: 管理者トップダッシュボード

**背景**
管理者が受講者の状況を一元把握し、対応が必要な案件にすぐアクセスできるダッシュボードが運用効率化に必要。

**受け入れ条件**
- [ ] 管理者ダッシュボード (`/admin`) に以下のウィジェットがある
  - 受講者ステータス別カウント (仮登録/受講中/合格済/修了証明書発行済 等)
  - 不正フラグ未対応一覧 (最新5件)
  - 受講確認待ち (判定未実施) 一覧
  - 修了証明書未発行一覧
  - DIPS 未連携一覧
- [ ] 各ウィジェットから対象ページへのリンクがある
- [ ] API `GET /api/admin/dashboard/summary` でサマリーデータを取得できる

**関連ファイル候補**
- `app/(admin)/page.tsx` (ダッシュボード)
- `app/api/admin/dashboard/summary/route.ts`
- `services/dashboardService.ts`

**工数見積もり**: 0.5日

**依存する他タスク**: #5, #10, #12, #15, #16

---

### Issue #19: 不正検知・警告・一時停止ロジック

**背景**
受講の正確性担保のため、長時間離脱・同時ログイン等の不正行為を検知し管理者に通知する必要がある (4.4)。

**受け入れ条件**
- [ ] 以下の不正パターンを検知して `FraudFlag` テーブルに記録する
  - タブ離脱が 60秒以上継続 (設定可能)
  - 同一アカウントの同時ログイン
  - 再生速度が上限 (1.5x) を超えた場合のログ改ざん試行
- [ ] 不正フラグが一定数を超えると受講者アカウントを一時停止できる (管理者手動)
- [ ] 受講中に警告モーダルを表示する (タブ離脱検知時)
- [ ] 管理者画面: 不正フラグ一覧 (`/admin/fraud-flags`)
  - フラグ種別・発生日時・受講者情報
  - 対応済みマーク

**関連ファイル候補**
- `services/fraudDetectionService.ts`
- `repositories/fraudFlagRepository.ts`
- `hooks/useFraudDetection.ts`
- `app/api/student/fraud-flag/route.ts`
- `app/(admin)/fraud-flags/page.tsx`

**工数見積もり**: 0.5日

**依存する他タスク**: #9, #18

---

### Issue #20: E2E テスト (Playwright)

**背景**
受講フロー全体が法的要件を満たして動作することを、デプロイ前に自動テストで保証する。

**テストシナリオ**
1. 管理者ログイン → 受講者登録 → 入学申請 → 本登録メール送信
2. 受講者ログイン → パスワード設定 → 規約同意 → 動画視聴 → 進捗確認
3. 全科目受講完了 → 試験受験 → 合格 → 合格通知
4. 管理者による受講確認判定 → 修了証明書発行 → 受講者ダウンロード
5. 管理者による DIPS 連携 CSV 出力 → 監査資料出力

**受け入れ条件**
- [ ] Playwright が設定されている
- [ ] 上記 5 シナリオの E2E テストが実装されている
- [ ] テスト用の DB シードが E2E 用に分離されている
- [ ] `make e2e` でテスト実行できる
- [ ] CI (GitHub Actions) で E2E テストが自動実行される

**関連ファイル候補**
- `e2e/`
- `playwright.config.ts`
- `.github/workflows/e2e.yml`

**工数見積もり**: 1日

**依存する他タスク**: #7, #10, #12, #15, #16, #17

---

### Issue #21: 本番デプロイ・パフォーマンス確認

**背景**
Lightsail Ubuntu (1GB RAM) という制約環境での本番動作確認。`next build` はメモリ超過のリスクがあるためローカルビルドが必要。

**受け入れ条件**
- [ ] `.env.production` テンプレートが整備されている (秘密情報は含まない)
- [ ] `next build` がローカル環境で成功する
- [ ] pm2 の設定ファイル (`ecosystem.config.js`) が作成されている
- [ ] nginx 設定が整備されている (Next.js プロキシ + `/videos/` 動画配信)
- [ ] デプロイ手順書 (`docs/deployment.md`) が作成されている
- [ ] 本番サーバーで `make dev` (または pm2) での起動が確認できる
- [ ] 1GB RAM 環境で動画視聴・試験・PDF 生成が正常動作することを確認
- [ ] 動画視聴中の nginx アクセスログを確認し帯域問題がないことを確認

**関連ファイル候補**
- `ecosystem.config.js`
- `nginx/drone-school.conf`
- `docs/deployment.md`
- `.env.production.example`

**工数見積もり**: 0.5日

**依存する他タスク**: #20

---

## 進捗サマリー

| Phase | Issue | タイトル | 状態 |
|---|---|---|---|
| 1 | #1 | プロジェクト初期化 | 完了 |
| 1 | #2 | Prisma スキーマ・マイグレーション | 完了 |
| 1 | #3 | NextAuth.js 認証基盤 | 完了 |
| 1 | #4 | 共通レイアウト・UI コンポーネント | 完了 |
| 2 | #5 | 受講者アカウント管理 | 完了 |
| 2 | #6 | 入学申請・本人確認資料管理 | 完了 |
| 2 | #7 | 本登録フロー・規約同意 | 完了 |
| 3 | #8 | 教材・コース管理 | 完了 |
| 3 | #9 | 動画視聴・不正防止 | 完了 |
| 3 | #10 | 科目別進捗管理 | 完了 |
| 4 | #11 | 問題バンク管理 | 完了 |
| 4 | #12 | 修了確認試験 | 完了 |
| 5 | #13 | 質疑応答機能 | 完了 |
| 5 | #14 | 受講確認・成立判定 | 完了 |
| 6 | #15 | 修了証明書 PDF 生成 | 完了 |
| 6 | #16 | DIPS2.0 連携 CSV | 完了 |
| 6 | #17 | 監査資料出力 | 完了 |
| 7 | #18 | 管理者ダッシュボード | 完了 |
| 7 | #19 | 不正検知ロジック | 完了 |
| 7 | #20 | E2E テスト | 完了 |
| 7 | #21 | 本番デプロイ確認 | 完了 |
