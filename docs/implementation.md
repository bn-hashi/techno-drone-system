# 実装計画: 二等無人航空機操縦士 学科オンライン化システム (MVP)

> `/tdd`, `/code-review`, `/plan` 参照用ドキュメント。変更時は本ファイルも更新する。

---

## 1. システム概要

### 1.1 目的

テクノドローン株式会社 (登録講習機関コード: 0515) が提供する二等無人航空機操縦士の学科講習をオンライン化する。航空法第132条の50 および 告示別表第三の4要件に準拠。

### 1.2 技術スタック

| 項目 | 採用技術 | 備考 |
|---|---|---|
| フロントエンド | Next.js 14 (App Router) + TypeScript + Tailwind CSS | strict モード必須 |
| バックエンド | Next.js API Routes | FastAPI 不使用。1プロセス統合 |
| DB | PostgreSQL (drone_school) + Prisma | ローカルインストール済み |
| 認証 | NextAuth.js (Credentials Provider) | JWT セッション |
| 動画配信 | nginx 直接配信 (`/home/ubuntu/videos/`) | ブラウザアップロード不使用 |
| PDF 生成 | @react-pdf/renderer + NotoSansJP | Puppeteer 不使用 (RAM制約) |
| ファイル保存 | ローカル SSD (`/home/ubuntu/uploads/`) | |
| メール | Resend (RESEND_API_KEY) | |
| テスト | Vitest + RTL + Playwright | |

### 1.3 インフラ制約

- Lightsail Ubuntu 24.04 / RAM 1GB / SSD 40GB / 単一サーバー
- `next build` はローカルで実行し、ビルド済みをデプロイ
- 動画は 720p / H.264 / 合計 10GB 以内

---

## 2. アーキテクチャ

### 2.1 レイヤー構成

```
app/api/*        ← Controller (リクエスト受取・レスポンス返却のみ)
    ↓
services/        ← Service (ビジネスロジック全集約)
    ↓
repositories/    ← Repository (DB アクセスのみ)
    ↓
prisma/          ← ORM (PostgreSQL)
```

**厳守事項**:
- Controller にビジネスロジックを書かない
- Service から Prisma を直接呼ばない (Repository 経由必須)
- `any` 禁止。`unknown` + 型ガードを使う

### 2.2 ディレクトリ構成

```
app/
  (auth)/login/           ← 認証ページ
  (admin)/                ← 管理者ページ群 (ADMIN ロールのみ)
  (student)/              ← 受講者ページ群 (STUDENT ロールのみ)
  api/                    ← API Routes
components/
  layouts/                ← AdminLayout, StudentLayout
  ui/                     ← Button, Input, Card, Modal, Table, Badge 等
  pdf/                    ← @react-pdf/renderer コンポーネント
  VideoPlayer.tsx
hooks/
  useViewingLog.ts
  useVisibilityDetection.ts
  useFraudDetection.ts
lib/
  db.ts                   ← Prisma Client シングルトン
  auth.ts                 ← NextAuth 設定
  fileUpload.ts
  csvParser.ts
  csvGenerator.ts
  certificateNumbering.ts
  token.ts
services/                 ← ビジネスロジック層
repositories/             ← DB アクセス層
types/
prisma/
  schema.prisma
  migrations/
  seed.ts
e2e/                      ← Playwright テスト
```

### 2.3 認証・認可

- ロール: `ADMIN`, `STUDENT`
- `middleware.ts` で `/admin/*` → ADMIN, `/student/*` → STUDENT のルートガード
- セッション: JWT (NextAuth.js)
- 同時ログイン防止: セッション ID 管理で検知

---

## 3. データモデル

### 3.1 受講者状態遷移

```
PENDING_REGISTRATION (仮登録)
    ↓ 入学申請受理・本人確認資料確認
PENDING_ACTIVATION (本登録待ち)
    ↓ 本登録案内メール送信・パスワード設定・規約同意
ACTIVE (受講中)
    ↓ 全科目受講時間充足 + 試験合格
EXAM_PASSED (試験合格)
    ↓ 管理者による受講確認判定
COMPLETED (受講成立)
    ↓ 修了証明書発行
CERTIFIED (修了証明書発行済)
    ↓ DIPS 連携済みマーク
DIPS_LINKED (DIPS 連携済)
```

### 3.2 主要テーブル (Prisma スキーマ)

**User**: id, email, name, passwordHash, role(ADMIN/STUDENT), courseType(BEGINNER/EXPERIENCED), status, expiresAt

**EnrollmentApplication**: 入学申請・本人確認資料パス

**Subject** (4科目マスタ): code, name, requiredMinutesBeginner, requiredMinutesExperienced
- `SUBJECT_01`: 無人航空機に関する規則 / 心構え
- `SUBJECT_02`: 無人航空機のシステム
- `SUBJECT_03`: 無人航空機の操縦者・運航体制
- `SUBJECT_04`: 運航上のリスク管理

**Video**: filePath (`/home/ubuntu/videos/` 相対パス), duration, sortOrder, isPublished

**ViewingLog**: userId, videoId, watchedSeconds, rawLog(JSON), startedAt, endedAt

**SubjectProgress**: userId, subjectId, totalWatchedMinutes, isFulfilled

**Question**: subjectId, body, choices(JSON配列), correctIndex(0-2), explanation

**Exam**: userId, score, passed, status

**ExamAnswer**: examId, questionId, selectedIndex, isCorrect (採点解答用紙)

**CompletionCertificate**: userId, certificateNumber, issuedAt, expiresAt, pdfPath

**DIPSExportLog**: certificateId, exportedAt, csvPath, status(PENDING/EXPORTED/CONFIRMED)

**FraudFlag**: userId, type(TAB_LEAVE/CONCURRENT_LOGIN/SPEED_VIOLATION), detectedAt, resolvedAt

---

## 4. 機能仕様

### 4.1 修了証明書 (様式1)

**採番ルール**: `第TC{機関コード4桁}{年2桁}{月2桁}{連番4桁}号`
- 機関コード: `0515` (固定)
- 連番: 同月内の発行件数でインクリメント (4桁ゼロ埋め)
- 例: `第TC051524091142号`

**有効期限**: 修了日から1年後の前日 (例: 2024/09/25 修了 → 2025/09/24 まで有効)

**記載項目** (様式1 D検様式240302-01):
- 証明書番号・修了日・有効期限
- 受講者氏名 (〇〇 殿)・技能証明申請者番号
- 修了審査員氏名
- 登録講習機関名・スクール名・機関コード・講習事務所コード
- 区分表: 二等・回転翼航空機（マルチローター）・基本 に印

**発行台帳** (様式5): 証明書番号・修了日・有効期限・氏名・技能証明申請者番号・機体種別・区分

### 4.2 動画視聴・不正防止

| 機能 | 実装方法 |
|---|---|
| 初回シークバー制限 | `ViewingLog` の視聴済み最大位置まで制限 |
| バックグラウンド再生禁止 | `Page Visibility API` (`visibilitychange` イベント) |
| タブ離脱検知 | 60秒以上で `FraudFlag` 記録 |
| 秒単位視聴ログ | クライアント 10秒バッファ → `POST /api/viewing-log` |
| 再生速度上限 | 1.5x (HTML5 video の `playbackRate` 監視) |

### 4.3 修了確認試験

| 項目 | 仕様 |
|---|---|
| 出題形式 | 三肢択一 |
| 出題数 | 設定可能 (デフォルト 30問) |
| 出題方法 | ランダム・科目均等配分 |
| 合格基準 | 正答率 80% 以上 |
| 受験資格 | 全科目の最低受講時間充足 |
| 採点解答用紙 | `ExamAnswer` テーブルに全回答・正誤を保存 |

### 4.4 DIPS2.0 連携

CSV の正確なカラム定義は Phase 6 着手時にユーザーから受領する。
`DIPSExportService` はカラム定義を差し替え可能な構造で実装する。

---

## 5. フェーズ別スコープ

### Phase 1: 基盤構築 (Issue #1-4)

Next.js 初期化・Prisma スキーマ・認証・共通 UI

### Phase 2: ユーザー管理・入学申請 (Issue #5-7)

受講者 CRUD・入学申請書類保管・本登録フロー・規約同意

### Phase 3: 教材管理・動画視聴 (Issue #8-10)

コース/動画メタデータ管理・視聴プレーヤー・進捗管理

### Phase 4: 修了確認試験 (Issue #11-12)

問題バンク (シード 5問)・試験実施・採点・採点解答用紙保存

### Phase 5: 質疑応答・受講確認 (Issue #13-14)

QA フォーム・受講確認判定

### Phase 6: 修了証明書・DIPS 連携・監査資料 (Issue #15-17)

証明書 PDF 生成・DIPS CSV・10 種類の帳簿 CSV

### Phase 7: 仕上げ (Issue #18-21)

管理者ダッシュボード・不正検知・E2E テスト・本番デプロイ

---

## 6. テスト戦略

| 種別 | ツール | 対象 | 目標カバレッジ |
|---|---|---|---|
| 単体テスト | Vitest | services/ (全ビジネスロジック) | 90% 以上 |
| 単体テスト | Vitest + RTL | 主要コンポーネント | 80% 以上 |
| 統合テスト | Vitest | API Routes | 80% 以上 |
| E2E テスト | Playwright | 受講フロー全体・管理者フロー | 主要 5 シナリオ |

**優先テスト対象** (法的必須):
1. `ProgressService`: 科目別充足判定
2. `ExamService`: 採点・合否判定
3. `CertificateService`: 採番・有効期限計算
4. `DIPSExportService`: CSV カラム定義
5. 受講者状態遷移の整合性

---

## 7. 完成基準

- [ ] 入学申請 → 受講 → 試験 → 修了証明書ダウンロードまで一連フロー完走
- [ ] 4科目の受講時間が個別トラッキングされ充足判定が正しく動作
- [ ] 試験が正答率 80% で合否判定・採点解答用紙が電子保存
- [ ] 修了証明書 PDF が様式1に準拠して生成
- [ ] DIPS 連携 CSV が指定様式で出力
- [ ] 10 種類の帳簿 CSV が出力可能
- [ ] Service 層のテストカバレッジ 90% 以上
- [ ] 1GB RAM 環境で安定動作
