# 事務管理MVP 実装計画 v2.3

> 作成日: 2026-06-21
> ブランチ: feature/claude-design-integration
> 入力: docs/05_mvp-implementation-plan-v2.2.md（v2.2以前は削除・上書きしない）
> 承認状態: **承認待ち（コード未変更）**
> 位置づけ: Phase 0（基礎機能の安全化＋routing）→ Phase 1（design基盤）→ Phase 2（管理者ダッシュボード）→ 後続feature（限定解除の完全実装）。限定解除は全構成要素が揃うまで学生へ非公開。

---

## A. v2.2からの変更一覧

| # | 変更 | 種別 |
|---|------|------|
| 1 | **限定解除を半完成で学生公開しない**方針を確定。8要素（割当/policy分岐/進捗/試験/修了/料金snapshot/Excel backfill/E2E）が揃うまで非公開。「準備中」表示案を不採用。最小公開gate（nav非表示・route拒否・seed未投入）を比較（§J） | 方針確定 |
| 2 | **Phase 0からDB変更（M4・限定解除UI）を除外**。Phase 0はDB変更なしで基礎コースの認可是正・一覧・link・移設のみ（§E） | 構成変更 |
| 3 | 管理者ダッシュボードA案を**最初の新規管理画面**として維持。`app/admin/course-assignments/page.tsx` をダッシュボードより先に公開しない（§F） | 順序固定 |
| 4 | **限定解除を独立した「後続feature phase」へ集約**（M4以降、料金、Excel backfill、公開gate）（§G〜§L） | 構成変更 |
| 5 | Course表現を再設計。推奨 = **`Course.category`追加＋`Course.type` nullable化＋CHECK制約**（非add-only）。`Course.type` 参照を全件調査し影響範囲を特定（§G） | 設計判断＋調査 |
| 6 | CourseAssignment修正: **ACTIVE一意性（partial unique index）**、**attempt競合対策**、**assignedBy（nullable FK＋SetNull＋snapshot）**、**User削除の実態調査**（物理削除APIなし）（§H） | 設計判断＋調査 |
| 7 | M5/M6を後続候補から**限定解除公開前の必須作業**へ格上げ（進捗/試験/修了の完全分離）（§I） | 格上げ |
| 8 | 料金**version＋申込/割当時snapshot＋支払期限（受講7暦日前）**を設計。現行legacy版の `effectiveFrom` は不明＝null/明示unknownで保持（§K） | 確定要件＋設計 |
| 9 | **Excel backfill gate**（受領前/受領後research/dry-run/import/cutover）。Excel未受領のためmapping未確定。「受領後にmapping仕様書作成」を開始条件に（§L） | 確定要件＋設計 |
| 10 | 認可失敗 status 対応表（400/401/403/404、未割当・別type・不存在は秘匿404）（§M）。feature flag機構が**存在しない**ことを実測（§B-1, §J） | 調査＋設計 |

---

## B. 事実 / ユーザー確定要件 / 設計判断 / 未確認事項

### B-1. 事実（追加調査・既存§C/§F含む）
- **feature flag機構は存在しない**（`rg` で `feature.?flag|isEnabled|FEATURE_|toggle` 該当なし。`review/page.tsx` の一致は誤検出）。
- **User物理削除APIは存在しない**。`app/api/admin/users/` は `route.ts`（一覧/作成）と `[id]/status/route.ts`（status変更）のみ。`UserStatus` に DELETED/退校等の soft-delete値もない（7値: PENDING_REGISTRATION〜DIPS_LINKED）。→ schema上の `onDelete: Cascade` は**アプリ経路では発火しない**（理論値）。
- **日程・請求・支払・スケジュールのmodel/列は存在しない**（schema該当なし）。`scheduledTrainingStartAt`/`paymentDueAt` の置き場は現状なし。
- 証明書番号は `lib/certificateNumbering.ts` `formatCertificateNumber`：`第TC{institutionCode}{year}{month}{seq}号`（JST基準、採番は `certificateService` L113-147 でtransaction原子化）。`CompletionCertificate.userId @unique`（L287）= **1ユーザー1通**。
- 全student route（12本）は `role===STUDENT && status===ACTIVE` のみ認可（v2.2 §C）。Course.type一致・ownership・割当検証なし。
- `Course.type` は必須 enum `{BEGINNER, EXPERIENCED}`。`Exam`/`SubjectProgress`/`Question`/`CompletionCertificate` は courseId を持たない（v2.2 §F）。

### B-2. ユーザー確定要件（今回追加分）
- 限定解除料金は**税込**: 初学者 123,200円 / 経験者 96,800円。現行適用中だが**適用開始日不明（架空日付を登録しない）**。料金変更後も申込・割当時点の料金を履歴保持。
- 支払期限 = **受講日の7日前**（暦日で計画。営業日補正/休日/日程変更時の再計算規則は要調査、なければ「受講開始予定日時から7暦日前」を候補＋未確認明示）。請求・決済機能を今回作らない場合も料金snapshotと支払期限を失わない設計。
- 既存の限定解除受講者（受講中/修了済）が存在。記録はExcel。**Excel未提供**（列名・型・件数・重複・欠損・照合キー未確認）。Excel確認まで安全なbackfill不可。
- 限定解除は8要素が揃うまで学生非公開。「準備中」公開不採用。

### B-3. 設計判断（本書で決定）
- Phase 0 はDB変更なし・基礎コースのみ（§E）。限定解除は後続feature phaseへ集約（§G〜§L）。
- 管理者ダッシュボードを最初の新規管理画面に固定。限定解除管理UIはダッシュボード後（§F）。
- Course表現は **`category`追加＋`type` nullable＋CHECK** を推奨（§G）。
- CourseAssignment は ACTIVE一意=partial unique index、attempt競合=競合検出retry、assignedBy=nullable FK＋SetNull＋name snapshot、User削除=Restrict相当（物理削除APIなしのため実害なしだが防御的）（§H）。
- M5/M6 は限定解除公開前の必須作業（§I）。
- 料金は version＋snapshot、legacy版 `effectiveFrom=null/unknown`（§K）。
- 認可失敗は秘匿404既定（§M）。

### B-4. 未確認事項（推測しない）→ §N
Q8〜Q12（v2.2）に加え Q13（支払期限の営業日/再計算規則）、Q14（限定解除料金の適用開始日）、Q15（Excel列mapping・照合キー）、Q16（User削除/保存期間の法令要件）。

---

## C. 認可入口の実測表（v2.2 §C 継承・再掲要点）

全入口が `role===STUDENT && status===ACTIVE` のみ。Phase 0で基礎コースに `canAccessCourse`（type分岐）を適用する対象:
- `app/(student)/courses/[courseId]/page.tsx`（CourseVideosPage L20-34）
- `app/api/student/courses/[courseId]/videos/route.ts`（GET）
- `app/api/student/videos/[id]/route.ts`（GET。`canWatchVideo` 順序制御はあるがtype/割当未検証）
- `app/api/student/viewing-log/route.ts`（POST。任意videoId書込＝IDOR）
- `app/api/student/fraud-flag/route.ts`（POST）
- Server Component直呼出し（`app/student/page.tsx` L36, `(student)/exams/page.tsx` L47）

exam系（`exams/[id]` submit/result）は `exam.userId !== userId` で所有権検証済み（examService L137）。progress/eligibility は自分のcourseType単位。

---

## D. 基礎 vs 限定解除 認可（policy正本）

| 観点 | 基礎コース | 限定解除コース |
|---|---|---|
| 認可 | ACTIVEなSTUDENT かつ `Course.type === User.courseType` | ACTIVEなSTUDENT かつ 有効なCourseAssignmentが存在 |
| 実装時期 | **Phase 0**（DB変更なし） | **後続feature**（M4後） |
| 公開 | 即時 | 8要素完成後にgate解除 |

```text
canAccessCourse(userId, courseId):
  前提: ACTIVE な STUDENT
  基礎(category=BASIC): Course.type === User.courseType
  限定解除(category=LIMITED_REMOVAL): 有効(status=ACTIVE)な CourseAssignment(userId, courseId) が存在  ← 後続feature
  どちらにも該当しなければ false
```
共通service（`services/courseAccessService.ts` 等）に集約。Phase 0では**基礎分岐のみ実装**し、限定解除分岐は後続featureで同policyに追加。`Course.type` がnullable化されると `course.type === user.courseType` は null（限定解除）で自然にfalse＝**型アクセスから自動除外**され安全。

---

## E. Phase 0（DB変更なし・基礎コースのみ）

| # | サブタスク | 完了条件 | 停止条件 | test |
|---|---|---|---|---|
| 0-1 | 共通 `canAccessCourse`（基礎分岐のみ） | 全§C入口がpolicy経由 | 既存視聴/試験E2E回帰 | 認可unit/IDOR |
| 0-2 | 基礎コースのIDOR是正（page/動画一覧/動画詳細/viewing-log/fraud-flag） | 直接URL/API指定で迂回不可 | 回帰 | §M対応表のtest |
| 0-3 | `/student/courses`（基礎コースのみ・type一致） | 一覧/empty state/遷移 | — | 一覧test |
| 0-4 | dashboard/StudentLayout link修正（→`/student/courses`、「コース一覧を見る」） | 各サブタスク完了時点の作業ツリーでdangling 0件 | — | StudentLayout.test |
| 0-5 | 管理page route `/admin/*` 移設＋307 redirect（v2.1 §1踏襲・完全一致・`:path*`禁止） | `(admin)`空・redirect・middleware検証 | V6/V8回帰 | AdminLayout.test, redirect検証 |
| 0-6 | role別E2E・動画/試験/認証回帰 | 全pass | いずれか失敗 | §M test群 |

実行順は 0-1→0-2→0-3→0-4→0-5→0-6。**Phase 0はDB変更・限定解除を含まない。** redirectは当面保持・自動削除しない（Q7はブロッカー外）。

---

## F. Phase 1 / Phase 2（順序固定）

- **Phase 1 デザイン基盤**: token（`primary`不変・`accent`/`pageBackground`追加）、font（既存 `@fontsource/noto-sans-jp` 再利用・`next/font/google`不使用）、共通UI、既存画面の段階統合（v2.1 §3踏襲）。
- **Phase 2 最初の新規管理画面 = 管理者ダッシュボード A案「アラートタイル型」**。実データのみ・架空タイルなし（User.status別/未処理申請/未回答QA/書類未確認）。`app/admin/page.tsx`→`redirect("/admin/dashboard")`。
- **限定解除管理UI（`app/admin/course-assignments/page.tsx`）はダッシュボード完成後**の後続feature。先に公開しない。

---

## G. Course表現の再設計（4案比較・推奨確定）

### G-1. 比較

| 案 | 内容 | add-only | 評価 |
|---|---|---|---|
| 1. **category追加＋type nullable＋CHECK（推奨）** | `category: BASIC\|LIMITED_REMOVAL`、基礎=type必須、限定解除=type null | **no**（NOT NULL解除） | 1テーブルで明快。policy自然に安全。null対応の波及は限定的（§G-3） |
| 2. CourseType に限定解除値追加 | enumに `LIMITED_REMOVAL` | yes | `type===user.courseType` 判定が意味的に歪。誤type一致リスク |
| 3. Course本体と区分別Requirement/Offering分離 | Courseは共通、料金/時間は別table | 一部yes | 料金分離（§K）と整合だがCourse種別判定が別途必要 |
| 4. 限定解除専用model | 別table | yes | Video/進捗/policyの参照が二重化・複雑 |

### G-2. 推奨案（確定候補・schemaは未確定）
- `Course.category`: `BASIC | LIMITED_REMOVAL`（enum）。
- 基礎: `category=BASIC` かつ `type=BEGINNER|EXPERIENCED` **必須**。
- 限定解除: `category=LIMITED_REMOVAL` かつ `type=null`。
- **DB CHECK制約**で不正組合せ（BASICでtype null / LIMITED_REMOVALでtype非null）を防止。Prismaで表現できないためcreate-only migration SQLへ手動追記。
- ダミー値（限定解除にBEGINNER/EXPERIENCED）は**保存しない**。

### G-3. `Course.type` nullable化の影響範囲（`rg` 全件調査）
`Course.type`（modelフィールド）に直接触れる箇所は限定的:
- `repositories/courseRepository.ts`（`CreateCourseInput.type` 必須、`UpdateCourseInput.type?`）— category対応＋type optional化。
- `app/api/admin/courses/route.ts` L8/L47（作成時 `VALID_COURSE_TYPES`、`type: body.type`）— category受領＋限定解除でtype null許容。
- `lib/api/adminCourses.ts`（DTO `type: CourseType`）— `type: CourseType | null` ＋ `category`。
- `components/admin/courses/*`（作成/編集フォーム）— category選択＋限定解除でtype非表示。
- 基礎access policy `course.type === user.courseType`（§D）— nullで自然にfalse（**安全**）。
> 多くの `CourseType` 参照は **`User.courseType`**（別フィールド・本変更の対象外）。`Course.type` 自体の参照は上記に限られ、null対応の波及は管理コース作成/編集系に集中。
- **計画**: migration（type nullable＋category追加＋CHECK、create-only）→ generated type再生成 → 上記箇所のnull/category対応 → typecheck → 回帰test。**停止条件**: type参照箇所でnull非対応の型エラーが残る／既存基礎コースのtypeが失われる兆候。

---

## H. CourseAssignment（M4）— 必要性は確定、schemaは未確定

> **M4の必要性=確定**（限定解除は個別割当が必須）。**schema=未確定**（§N Q8/Q11 と本節の論点解消後に確定）。

### H-1. ACTIVE割当の一意性
- 不変条件: 同一 user・course で **ACTIVEな割当は最大1件**。COMPLETED/CANCELLED等の過去attemptは複数保持可。
- **第一候補: PostgreSQL partial unique index**（`WHERE status='ACTIVE'`）でACTIVEのみ最大1件に制限。Prismaで表現不可→create-only migration SQLへ手動追記＋検証test。
  ```sql
  -- 例（index名/列名は生成SQL確認後に確定）
  CREATE UNIQUE INDEX "course_assignments_active_unique"
    ON "course_assignments" ("userId", "courseId")
    WHERE "status" = 'ACTIVE';
  ```

### H-2. attempt採番（同時割当競合）
- `MAX(attempt)+1` 単純実装は同時割当で競合。比較:
  - (a) Serializable transaction＋有限回retry。
  - (b) **unique競合を検出して有限回retry（推奨）** — partial uniqueとは別に `@@unique([userId, courseId, attempt])` を置き、競合時に attempt をインクリメントしてretry（有限回）。
  - (c) attemptを業務識別子にせず id＋履歴順で扱う。
- **推奨: (b)**。過剰複雑化を避けつつ、同時操作で重複・未処理500を放置しない（競合は409 or retry後成功）。

### H-3. assignedBy
- **第一候補**: `assignedById`（**nullable User FK、管理者削除時 `SetNull`**）＋ `assignedByName`（割当時表示名の不変snapshot）。
- FKなしID文字列案との違い: FKありなら**存在しないIDを保存できない**（参照整合）。表示名はsnapshotで管理者改名・削除後も保持。→ 整合性と履歴保持を両立。
- 注: User物理削除APIは現状なし（§B-1）ため SetNull は当面発火しないが、将来の削除導入に備え定義。

### H-4. User削除時の扱い（実態調査）
- **物理削除APIなし・soft-delete status なし**（§B-1）。既存 `onDelete: Cascade`（申込/exam/cert/viewinglog等）は理論値で未発火。
- 選択肢比較: Cascade（履歴消失・法令保存と矛盾の懸念）/ **Restrict（推奨・誤削除防止）** / soft delete / 匿名化。
- **未確認（法令保存期間）**: コード・資料に保存期間規定なし。**法令を推測せず、Q16を停止条件**とする。CourseAssignment は当面 `onDelete: Restrict` 相当（物理削除を増やさない方針＝既存のstatus運用に揃える）。

### H-5. 割当根拠
- 自由記述noteだけを正本にしない。
- **構造化した割当根拠（enum/選択肢）を候補化**（例: 検定協会スクール受講歴あり/応用技能講習受講歴あり/初学者/経験者 等）。ただし**正式な選択肢が未確定なら推測でenum固定しない**（Q8相当の業務確認）。
- 自由記述は補足限定: 文字数制限、ADMINのみ閲覧、**ログへ本文を出さない**、不要な個人情報を記録しない方針を明記。

### H-6. CourseAssignment 候補schema（未確定）
```prisma
// 候補（後続feature・add-onlyのtable本体。partial unique等はSQL手動追記）
enum CourseAssignmentStatus { ACTIVE SUSPENDED CANCELLED COMPLETED }

model CourseAssignment {
  id             String   @id @default(cuid())
  userId         String
  courseId       String
  status         CourseAssignmentStatus @default(ACTIVE)
  attempt        Int      @default(1)
  assignedById   String?  // nullable User FK（SetNull）
  assignedByName String   // 表示名snapshot
  // 割当根拠: 構造化enumは確定後に追加（Q）。noteは補足
  note           String?
  assignedAt     DateTime @default(now())
  startedAt      DateTime?
  completedAt    DateTime?
  cancelledAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user      User   @relation("AssignmentUser", fields: [userId], references: [id], onDelete: Restrict)
  course    Course @relation(fields: [courseId], references: [id], onDelete: Restrict)
  assignedBy User? @relation("AssignmentAssigner", fields: [assignedById], references: [id], onDelete: SetNull)

  @@unique([userId, courseId, attempt])           // attempt重複防止
  // ACTIVE最大1件: partial unique index をSQLで追記（§H-1）
  @@index([courseId, status])
  @@map("course_assignments")
}
```
- コース物理削除APIとの整合: `course onDelete: Restrict` 導入で割当ありコース削除はFK違反→`courseService.deleteCourse` を事前チェック＋FK例外409化（v2.2 §M）。

---

## I. 進捗・試験・修了の完全分離（M5/M6＝限定解除公開前の必須作業）

> v2.2では後続候補だったが、限定解除を最終MVPに含めるため**公開前必須**へ格上げ。既存（基礎）を壊さず、基礎＋限定解除を複数保持できる設計を優先。

### I-1. 進捗scope（M5）
- 正本候補比較: `courseId` / `courseAssignmentId` / attempt ID。
  - 推奨: **`courseId` を一次scope**（コース単位の進捗）。再受講の区別が要れば `courseAssignmentId`（attempt含む）を併用。
- ViewingLog の Course単位集計: `Video.courseId` 経由で集計可能だが、現 `getProgressByUser`（Subject単位・courseType依存）は course を見ない。→ **course-scoped集計メソッドを追加**（既存は基礎用に温存）。
- `SubjectProgress @@unique([userId, subjectId])` の段階移行: `courseId` 追加→`@@unique([userId, subjectId, courseId])` へ。**既存行へ基礎courseIdをbackfill**（基礎は単一トラックのため一意に決まる場合のみ）。一意に決まらなければ停止・確認。

### I-2. 試験・問題scope（M5）
- `Question`（subjectIdのみ）/ `Exam`（userId・courseIdなし）を Course/assignment へscope。
  - 案: `Exam.courseId`（or `courseAssignmentId`）追加、`Question` に courseId or 限定解除専用Subject集合。
- 既存Exam/試験結果のbackfill: 既存はすべて基礎トラックとみなし基礎courseIdを付与（一意に決まる範囲のみ）。

### I-3. 修了判定・証明書分離（M6・非add-only）
- `CompletionCertificate.userId @unique`（1ユーザー1通）を**一般化**して基礎＋限定解除を複数保持。
  - 案A: 既存tableを段階拡張（`courseId`/`certificateType` 追加＋`@unique` を `@@unique([userId, courseId])` へ）。
  - 案B: 限定解除用の別証明書table新設（既存を温存）。
- 証明書番号体系（`第TC{機関コード}{年}{月}{連番}号`・`lib/certificateNumbering.ts`）と既存PDF（`CertificatePDF`/`CertificateLedgerPDF`）への影響を評価。限定解除証明書の番号採番・PDF様式が基礎と同一か別かを確認（業務未確定→§N）。
- **`@unique` 削除等の非add-only変更は停止gate**: create-only → SQL review → backup → staging → 件数照合 → **明示再承認**。

---

## J. 限定解除の公開gate（feature flag機構なし → 最小gate）

feature flag機構は存在しない（§B-1）。過剰な基盤を作らず、最小gateを比較:

| gate案 | 内容 | 評価 |
|---|---|---|
| nav非表示 | StudentLayout/一覧に限定解除を出さない | 必要だが単体では不十分（直URLで到達） |
| **route側拒否（推奨・必須）** | `canAccessCourse` の限定解除分岐＋未公開時は404。policyが正本 | IDOR含め堅牢 |
| seed未投入 | 限定解除Courseを本番に作らない | 移行前は有効。投入後はroute拒否が必須 |
| 環境変数1個の簡易flag | `LIMITED_REMOVAL_ENABLED` 等 | 過剰基盤化せず1フラグなら可。policy内で参照 |

**推奨**: route側拒否（policy）を主、nav非表示を従、本番seedは8要素完成・backfill照合後に投入。必要なら環境変数1個の公開フラグをpolicyに組み込む（over-engineeringしない）。**8要素（§本書冒頭の1〜8）が全て揃うまで学生公開しない。**

---

## K. 料金version・snapshot・支払期限

### K-1. 料金version model（候補 `CourseRequirement`・未確定 §N Q10/Q14）
```prisma
// 候補（後続feature）
model CourseRequirement {
  id                  String   @id @default(cuid())
  courseId            String
  applicantCategory   CourseType   // BEGINNER | EXPERIENCED（受講生区分）
  lectureMinutes      Int
  simulatorMinutes    Int
  practicalMinutes    Int
  trainingDays        Int
  feeYen              Int          // 税込・整数円（浮動小数点禁止）
  taxIncluded         Boolean  @default(true)
  paymentDueDaysBefore Int     @default(7)
  effectiveFrom       DateTime?    // 現行legacy版のみ null 許容（適用開始日不明）
  effectiveTo         DateTime?
  isCurrent           Boolean  @default(true)
  createdAt           DateTime @default(now())
  createdByName       String?
  course Course @relation(fields: [courseId], references: [id], onDelete: Restrict)
  @@index([courseId, isCurrent])
  @@map("course_requirements")
}
```
- 表の値（初学者: 座学2/シム2/実技4/2日/123,200円、経験者: 0/0/4/1日/96,800円）を**2行**で表現。マジックナンバー散在を防ぐ正本。
- **`effectiveFrom`**: 現行legacy版は**不明＝null**（または別途 `effectiveDateUnknown Boolean`）。**架空日付を入れない**。将来版は適用開始日**必須**にする制約を検討（不明の常態化を防ぐ）。
- 税: `taxIncluded=true`（税込）を明示。

### K-2. 申込・割当時snapshot
申込/割当時点に最低限を保持（料金改定後も当時の値を失わない）:
- `requirementId`（version参照）/ `feeYenSnapshot` / `taxIncludedSnapshot` / `paymentDueDaysBeforeSnapshot`。
- 必要なら各講習時間・日数snapshot。
- `scheduledTrainingStartAt`（受講開始予定日時）/ `paymentDueAt`（= 開始予定から**7暦日前**）。
- 配置: CourseAssignment に snapshot列を持たせる案 or 申込/割当snapshot専用table。**既存に日程・申込・請求modelは存在しない**（§B-1）ため責務重複なし。請求・決済は今回未実装でも、snapshotと `paymentDueAt` を**失わない境界**で設計（将来billing連携で参照可能に）。

### K-3. 支払期限の算出（未確認 §N Q13）
- 候補: `paymentDueAt = scheduledTrainingStartAt − 7暦日`。
- 営業日補正・休日・**受講日変更時の再計算規則**は既存コード/資料になし（§B-1）→ 未確認。日程変更時は再計算履歴を残すか検討。確定まで暦日7日前を候補とし推測実装しない。

---

## L. Excel backfill計画（gate）

> Excel未提供。**列mappingを確定扱いにしない**。「Excel受領後にmapping仕様書を別途作成」を開始条件とする。

### L-1. Excel受領前（今）
- import実装・DB投入を**行わない**。
- 必要列の**テンプレート案**のみ作成（user照合キー候補: user ID/メール/受講者番号、受講status、受講日、支払額、進捗/試験/修了の有無 等）。
- PII保護: 保存場所・アクセス権・作業用copy・削除方針を確認。原本Excelを上書きしない。

### L-2. 受領後 research
- sheet名/header/件数/列型/日付形式/金額形式を確認。
- **氏名だけでUser自動照合しない**。一意キー（user ID/メール/受講者番号）を調査。
- 重複/欠損/表記揺れ/不正日付/不正金額をレポート。
- 受講中/修了/取消/再受講の区別可否、進捗・試験結果・修了証明書番号・受講日・支払額の存在範囲を確認。

### L-3. dry-run
- DBへ書かず matched/unmatched/ambiguous/invalid の件数と行一覧を出力。変換後preview作成。
- 元件数・対象件数・合計金額・status別件数を照合。**曖昧行は人が確認・自動推測しない**。

### L-4. import
- **ユーザー明示承認後にstaging投入**。transaction・idempotency・再実行時の重複防止。
- import batch ID / source row参照で原行追跡（原文PIIを不要に複製しない）。
- stagingで件数・金額・status・進捗・試験・修了を再照合。**本番importは別承認**。

### L-5. cutover
- 既存対象者全員が matched または人手確認済み・未解決行0（または明示除外承認）。
- 限定解除認可を有効化しても既存対象者がアクセス不能にならない。
- 公開前に role別E2E と代表ユーザー照合。

---

## M. 認可失敗 status 対応表

| ケース | status | 備考 |
|---|---|---|
| 入力形式不正 | 400 | zod等 |
| 未認証 | 401 / login誘導 | 既存挙動に合わせる |
| role/status不許可 | 403 | 既存規約（§C） |
| 不存在・別type・未割当のCourse/Video | **404（存在秘匿）** | IDOR対策。未割当を403で漏らさない |

page / API / service error で同一ケースの意味が入口ごとに変わらないよう統一（§N Q12で秘匿404既定の最終確認）。

---

## N. 残る未確認事項（推測しない・どの実装をブロックするか）

| Q | 内容 | ブロックする実装 |
|---|---|---|
| Q8 | 限定解除Course表現の最終決定（推奨=category＋type nullable＋CHECK） | M4b（Course変更）、限定解除全般 |
| Q9 | 進捗/試験/修了の分離設計、特に `CompletionCertificate.userId @unique` 解除・証明書番号/PDF様式 | M5/M6、限定解除修了・証明書 |
| Q10 | 料金の税区分運用・version切替の詳細 | M7（CourseRequirement）、snapshot |
| Q11 | 既存限定解除受講者のbackfill情報源（Excel） | backfill、限定解除公開 |
| Q12 | 認可失敗 403/404 統一（秘匿404既定で可か） | §M（Phase 0の基礎IDOR是正にも影響） |
| Q13 | 支払期限の営業日補正/休日/日程変更時の再計算規則 | `paymentDueAt` 算出 |
| Q14 | 限定解除料金の正確な適用開始日 | `effectiveFrom`（不明はnull保持） |
| Q15 | Excelの列名・型・照合キー（ファイル未受領） | Excel mapping仕様書、backfill |
| Q16 | User削除の有無・法令上の保存期間 | CourseAssignment等の `onDelete`、削除運用 |

**Phase 0（基礎コース）はQ12のstatus方針確認のみで進行可**（秘匿404を既定として実装し、最終確認で微修正可能）。**限定解除feature全体はQ8/Q9/Q11/Q15に依存しブロック**。

---

## O. DB変更 一覧（確定 / 候補 / 見送り）

| # | 変更 | 分類 | add-only | フェーズ |
|---|------|------|------|------|
| M1 | EnrollmentApplication に nullable 2列（書類確認） | 確定 | yes | Phase 2 |
| M2 | AgreementText 新設＋partial unique index | 確定 | yes | Phase 2 |
| M3 | Instructor 新設 | 確定 | yes | 後続 |
| M4 | CourseAssignment 新設（必要性確定・schema未確定） | 確定(必要性)/未確定(schema) | yes（本体）＋partial unique（SQL追記） | 限定解除feature |
| M4b | Course に `category` 追加＋`type` nullable＋CHECK | 候補（Q8） | **no** | 限定解除feature |
| M5 | 進捗/試験へ courseId/assignmentId scope、問題scope | 候補（Q9）・**公開前必須** | 一部no | 限定解除feature |
| M6 | CompletionCertificate `userId @unique` 一般化 or 別table | 候補（Q9）・**公開前必須・非add-only停止gate** | no | 限定解除feature |
| M7 | CourseRequirement（料金version）＋申込/割当snapshot | 候補（Q10/Q14） | yes | 限定解除feature |
| — | DIPS CSV | 見送り（Q3） | — | — |
| — | 改ざん防止監査証跡 | 見送り | — | — |

**migration共通gate（強調）**: create-only → 環境確認gate（`DATABASE_URL` host/db名をpassword伏せ表示・人間確認、staging/prodに `migrate dev` 禁止）→ SQL review → backup → staging適用・回帰 → 明示承認 → `migrate deploy`。**ADD ONLYでも「無リスク/安全に戻せる」と書かない**。障害は**forward fix優先**。非add-only（M4b/M5/M6）は件数照合＋再承認の停止gate。`_prisma_migrations` 直接編集禁止。`migrate resolve` は公式失敗復旧のみ。

---

## P. route/API/service/repository/UI/test 変更一覧

**Phase 0（DB変更なし）**
- 新規: `services/courseAccessService.ts`（基礎分岐）、`app/student/courses/page.tsx`、`services/studentCourseService.ts`、`components/student/CourseListItem.tsx`
- 変更: `repositories/courseRepository.ts`（`findByType`）、`services/progressService.ts`（policyガード）、§C各入口にpolicy、`app/student/page.tsx`/`StudentLayout.tsx`（link）、`AdminLayout.tsx`（移設URL）、`next.config.mjs`（307 redirect）、管理page route移設群、`lib/serviceFactory.ts`
- test: `courseAccessService.test.ts`、`studentCourseService.test.ts`、§M対応、`middlewareHelpers.test.ts`、`AdminLayout.test.tsx`、redirect検証、既存student回帰

**Phase 2**: ダッシュボード（v2.1 §4-1）＋M1/M2

**限定解除feature（後続）**: M4/M4b/M5/M6/M7、`courseAssignmentService`、`courseAccessService` 限定解除分岐、`app/admin/course-assignments/*`（ダッシュボード後）、限定解除進捗/試験/証明書、料金snapshot、Excel import一式、`/student/courses` 限定解除セクション、公開gate

---

## Q. 20画面計画との関係 / scope

- 本書 v2.3 が実装順・依存の**正本**。
- **Phase 0/1/2**（基礎安全化・design・ダッシュボード）→ **限定解除feature**（独立phase・公開gate）。
- scope増（前回比）: 料金version/snapshot/支払期限、Excel backfill gate、Course category再設計、M5/M6を公開前必須化。
- 据置/後続: DIPS CSV、改ざん防止監査。
- 管理者ダッシュボード= 最初の新規管理画面（A案・実データのみ）を維持。限定解除途中状態は学生非公開。

---

## R. 実行制御
`git commit`/`push`/PR/deploy/**DB操作（`migrate deploy`含む）**/Excel import はユーザー明示承認なしに実行しない。本書は計画のみ。コード・設定・schema・migration・test・packageを一切変更していない。Excel未受領のため既存受講者データのimport/変換も未実施。
