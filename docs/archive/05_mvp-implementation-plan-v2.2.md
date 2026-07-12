# 事務管理MVP 実装計画 v2.2

> 作成日: 2026-06-21
> ブランチ: feature/claude-design-integration
> 入力: docs/05_mvp-implementation-plan-v2.1.md（v2.1は削除・上書きしない）
> 承認状態: **承認待ち（コード未変更）**
> 位置づけ: 「Phase 1〜3の20画面」のうち今回実装するMVP subset。基礎コース＋限定解除コースの認可・割当を含むよう scope を更新。

---

## A. v2.1からの変更一覧

| # | 変更 | 種別 |
|---|------|------|
| 1 | `Course.type === user.courseType` を「唯一のアクセス信号」から **「基礎コースの正式な業務認可ルール」** へ表現訂正。限定解除は type一致ではなく**管理者の個別割当**が必要と明記（§B, §D） | 表現訂正＋確定要件 |
| 2 | 限定解除コース（夜間＋目視外の1コース・個別割当）を**今回scopeに追加**。提供条件（時間/日数/費用）を業務要件として記録（外部確認済みとは書かない）（§G） | scope拡大 |
| 3 | **Q6（学生動画API認可ギャップ）を今回是正**。局所修正せず共通 `canAccessCourse` policyを正本化（§C, §D） | 方針確定 |
| 4 | **M4を今回実装へ昇格**（v2.1「見送り」を撤回）。ただし `CourseEnrollment` 候補をそのまま確定せず、3案比較のうえ **`CourseAssignment`（個別割当特化）を推奨**（§E） | 設計判断 |
| 5 | 限定解除の**進捗・試験・修了の分離**を実測。**既存modelでは分離不可**と判明。M5+候補として具体化。`CompletionCertificate.userId @unique` の変更は**非add-only**として停止条件＋確認事項に（§F） | 調査＋設計判断 |
| 6 | `/student/courses` を**「基礎」「限定解除」2セクション**仕様に更新（§I） | 確定要件 |
| 7 | **Phase 0を8サブタスクへ再構成**（調査→migration gate→割当model→共通policy→一覧→link→移設→role別E2E）（§J） | 確定要件 |
| 8 | AgreementText同時実行testの期待値訂正（「必ず片方失敗」を必須にしない）（§L） | 訂正 |
| 9 | 「中間commit」→「**各サブタスク完了時点の作業ツリー**でもdangling link 0件」。git statusで作成者/時刻まで証明できると書かない。redirectは自動削除しない・Q7はPhase 0ブロッカーから除外（§M） | 訂正 |
| 10 | DB変更を**確定・候補・見送り**に3分類（§K）。backfill/cutover/forward fix/停止条件を明記（§H, §J, §K） | 構成変更 |

---

## B. 事実 / ユーザー確定要件 / 設計判断 / 未確認事項

### B-1. 事実（コードベース実測。§C/§F に根拠）
- 全student route（12本）は `role===STUDENT && status===ACTIVE` のみで認可。**`Course.type` 一致もリソースownership検証も一切していない**。`courseType` は進捗/試験の**計算引数**として使われるのみ（§C）。
- `Exam`（`userId`、courseIdなし）/ `CompletionCertificate`（`userId @unique`）/ `SubjectProgress`（`userId, subjectId`）/ `Question`（`subjectId`のみ）は**すべてUser単位またはSubject単位で、courseIdを持たない**（§F）。
- `Course.type` は enum `{BEGINNER, EXPERIENCED}` のみ。限定解除を表す値・列・modelは**存在しない**。
- 料金・費用・時間・日数を保持するmodelは**存在しない**（`Subject.requiredMinutesBeginner/Experienced` を除く）。
- コース削除API（`DELETE /api/admin/courses/[id]` → `courseService.deleteCourse` → `courseRepo.delete`）は**物理削除**。
- 限定解除受講を示す永続データは schema 上に存在しない（痕跡は `prisma/seed-data.ts` のみ）。

### B-2. ユーザー確定要件
- **基礎コース**: 同一 `CourseType` のコースは、その type の受講生なら**全コース受講可能**。初学者と経験者の同時受講はない。
- **限定解除コース**: 1コース（夜間＋目視外を内包）。**管理者が受講生ごとに個別割当**。割当判断ロジックは推測自動化せず、MVPは管理者の明示割当を正本。基礎と同時受講あり。進捗・試験・修了は基礎と**別管理**。
- **提供条件**（業務要件として記録・外部確認済みとは表現しない）:

  | 受講生区分 | 座学 | シミュレーター | 実技 | 受講日数 | 費用 |
  |---|---:|---:|---:|---:|---:|
  | 初学者 | 2時間 | 2時間 | 4時間 | 2日間 | 123,200円 |
  | 経験者 | 0時間 | 0時間 | 4時間 | 1日間 | 96,800円 |

- 金額/時間/日数をUI・serviceにマジックナンバーで散在させない。金額は浮動小数点でなく整数の円単位候補。
- `/student/courses` は基礎＋限定解除を区別表示。限定解除未割当なら申込断定CTAや架空データを出さない。
- 旧URL redirectは307・当面保持・自動削除しない。ダッシュボードボタンは「コース一覧を見る」→ `/student/courses`。

### B-3. 設計判断（本書で決定・理由つき）
- 共通認可policy `canAccessCourse(userId, courseId)` を page/一覧/動画一覧/動画詳細/視聴ログ更新で**正本化**。Client側で隠すだけにしない（§D）。
- 割当modelは **`CourseAssignment`（個別割当特化）を推奨**（過剰汎用化しない・履歴保持を壊さない最小設計）（§E）。命名は `EnrollmentApplication` と混同しないよう "Enrollment" を避ける。
- 限定解除の進捗/試験/修了分離（M5+）は**段階導入**。`CompletionCertificate.userId @unique` 変更が非add-onlyになるため、本MVPでは**割当・アクセス制御・一覧表示まで**を確定し、別管理の実体（進捗/試験/修了の分離）は確認後に実装（§F, §K）。
- 限定解除コースの Course 表現（enum値追加 vs `category` 判別列）は候補提示にとどめ確定しない（§E-4 / §R Q9）。

### B-4. 未確認事項（推測しない）→ §R
- Q8: 限定解除コースの Course 表現方法（CourseType enum拡張 / Course.category判別列 / 別model）。
- Q9: 進捗/試験/修了の分離設計（特に `CompletionCertificate.userId @unique` の扱い＝非add-only変更の可否）。
- Q10: 提供条件（料金/時間）の税込税別・料金改定・適用開始日・過去申込価格スナップショット。
- Q11: 既存限定解除受講生のbackfill情報源（現状は信頼できる源なし）。
- Q12: 認可失敗時の 403/404 統一方針（情報漏洩観点で未割当は404偽装か403明示か）。

---

## C. 認可入口の実測表（Q6是正の対象範囲）

> 結論: **全student入口が `role===STUDENT && status===ACTIVE` のみ**。Course.type一致・リソースownership・割当検証は**どこにも無い**。`courseType` は値の計算引数としてのみ登場。

| 入口（file:symbol） | 現在の認可条件 | 想定される直接アクセス手段 | 是正方針 |
|---|---|---|---|
| `app/(student)/courses/[courseId]/page.tsx`（CourseVideosPage L20-34） | role/status のみ。`getVideosWithLockStatus(userId, courseId)` を任意courseIdで呼ぶ。0件で `notFound()` | URLで他type/未割当courseIdを直打ち | `canAccessCourse` を呼び、不可なら `notFound()`（§Q12でstatus確定） |
| `app/api/student/courses/[courseId]/videos/route.ts`（GET L16-28） | role/status のみ | 任意courseIdへGET | `canAccessCourse` 必須化 |
| `app/api/student/videos/[id]/route.ts`（GET L17-39） | role/status＋`isPublished`＋`canWatchVideo`（順序制御）。**course-type/割当は未検証** | 任意videoIdへGET（videoのcourseId経由でcourse判定） | videoのcourseIdに対し `canAccessCourse` |
| `app/api/student/viewing-log/route.ts`（POST L27-56） | role/status のみ。`recordSession({userId, videoId,...})`。VideoNotFoundのみ検証 | 任意videoIdに視聴ログ書込（IDOR書込） | videoのcourseIdに対し `canAccessCourse` |
| `app/api/student/fraud-flag/route.ts`（POST L18-21〜） | role/status のみ | videoId/相当を直接指定 | アクセス可能リソースに限定（policy適用） |
| `app/api/student/progress/route.ts`（GET L15-28） | role/status＋自分の`courseType`存在チェック | 自分の進捗のみ（userId=session）。**ただしSubject単位で基礎/限定解除を分離不可（§F）** | M5+で course/割当 scope を付与 |
| `app/api/student/exams/eligibility/route.ts`（GET L13-26） | role/status＋自分の`courseType` | 自分のみ。courseType単位 | M5+で限定解除eligibilityを分離 |
| `app/api/student/exams/route.ts`（POST startExam L16-27） | role/status＋自分の`courseType` | 自分のみ | 同上 |
| `app/api/student/exams/[id]/route.ts` / `submit` / `result` | role/status＋`exam.userId !== userId` で**所有権検証あり**（examService submitExam L137） | 他人のexamIdは403 | 既存ownership維持。course分離はM5+ |
| `app/api/student/certificate/download/route.ts`（L23-32） | role/status＋自分の証明書（userId） | 自分のみ。User単位1通（`@unique`） | 限定解除証明書分離はM5+（@unique論点） |
| `app/api/student/qa/route.ts` | role/status のみ（自分のQA） | 自分のQA | 影響小（course非依存） |
| Server Component直呼出し（`app/student/page.tsx` L36 `getProgressByUser`、`(student)/exams/page.tsx` L47 `checkEligibility`） | role/status＋自分のcourseType | 自分のみ | 一覧・page描画も `canAccessCourse` を共有 |

---

## D. 基礎コース認可 vs 限定解除コース認可（比較表＋共通policy）

### D-1. 比較表

| 観点 | 基礎コース | 限定解除コース |
|---|---|---|
| コード上の既存事実 | 動画API等はtype認可を**していない**（§C） | 該当コース/割当が**存在しない** |
| 今回確定の業務認可 | `ACTIVEなSTUDENT` かつ `Course.type === User.courseType` | `ACTIVEなSTUDENT` かつ **有効な個別割当が存在** |
| 割当row | 不要（type単位の権利） | 必要（管理者割当・M4） |
| 同時受講 | 初学者/経験者は排他 | 基礎と同時可 |
| 進捗/試験/修了 | 既存（User/Subject単位） | 基礎と別管理（M5+・現状分離不可） |
| Course表現 | 既存 `Course.type` | 未確定（§R Q8） |

### D-2. 共通認可policy（正本・名称は既存規則に合わせ確定）

page / 一覧 / 動画一覧 / 動画詳細 / 視聴ログ更新が**同一policy**を利用する。Client側で隠すだけにしない。IDOR対策として他人・未割当リソースの直接アクセスを拒否。ADMIN・管理APIには学生policyを適用しない。

```text
canAccessCourse(userId, courseId): boolean
  前提: ACTIVE な STUDENT（呼び出し側で role/status を確認済み、または policy 内で確認）
  基礎コース(category=BASIC 相当):
    Course.type === User.courseType
  限定解除コース(個別割当対象):
    有効(status=ACTIVE)な CourseAssignment(userId, courseId) が存在
  上記いずれにも該当しなければ false
```

- 配置案: `services/courseAccessService.ts`（または既存命名規則に合わせ `services/accessPolicy.ts`）＋ `repositories` 経由でCourse種別と割当を取得。`progressService.getVideosWithLockStatus` などは内部で本policyを先頭ガードに使う。
- 動画系入口は `video.courseId` を取得して `canAccessCourse(userId, video.courseId)` を評価。
- 認可失敗時のHTTP status（403 vs 404）は既存規約（§C: 動画は404偽装、exam所有権は403）を調査済み。**未割当/他type courseは「存在を秘匿」する 404 を既定**とし、§R Q12で最終確認。

---

## E. 割当model：3案比較と推奨

### E-1. 比較

| 案 | 内容 | 評価 |
|---|---|---|
| 1. Course単位の汎用割当table | 全Courseにper-user割当row | 基礎はtype単位で割当row不要のため**過剰**。基礎にも空rowが要るか曖昧化 |
| 2. **個別割当特化table（推奨）** | 管理者が個別割当するコース（＝今は限定解除）のみrowを持つ | 業務ルール（基礎=type、限定解除=割当）に一致。最小。将来別の個別割当コースにも `courseId` 参照で拡張可 |
| 3. 既存申込/進捗の拡張 | `EnrollmentApplication` 等を流用 | `EnrollmentApplication` は `userId @unique`（1行）で複数割当を持てない。形が合わず不可 |

→ **推奨: 案2。** 名称は `EnrollmentApplication` と混同しないよう **`CourseAssignment`** を推奨（"Enrollment" を避ける）。

### E-2. `CourseAssignment` 候補設計（確定ではない）

```prisma
// 候補（M4・add-only）。確定前に §R Q8/Q11 を解消する
enum CourseAssignmentStatus {
  ACTIVE
  SUSPENDED
  CANCELLED
  COMPLETED
}

model CourseAssignment {
  id             String   @id @default(cuid())
  userId         String
  courseId       String
  status         CourseAssignmentStatus @default(ACTIVE)
  attempt        Int      @default(1)   // 再受講を別rowで保持するための連番
  assignedByName String                  // 割当管理者の表示名スナップショット
  assignedById   String?                 // 割当管理者のUser.id（任意・監査用。FKは張らずスナップショットと役割分離）
  note           String?                 // 割当理由メモ（自由記述）。個人情報を含めない運用ルール（§E-3）
  assignedAt     DateTime @default(now())
  startedAt      DateTime?
  completedAt    DateTime?
  cancelledAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Restrict)

  @@unique([userId, courseId, attempt]) // 再受講(別attempt)を許容しつつ重複を防ぐ
  @@index([courseId, status])
  @@map("course_assignments")
}
```

設計メモ:
- **再受講履歴**: `@@unique([userId, courseId])` 単独では完了・取消後の再受講を別rowで保持できない。本案は **`attempt` 連番＋`@@unique([userId, courseId, attempt])`** で、row再利用せず履歴を別rowに残す（履歴table分離より最小）。「有効な割当」判定は `status=ACTIVE` の最新attemptで行う。
- **assignedBy の役割分離**: `assignedByName`（不変スナップショット・表示/監査用）と `assignedById`（任意・User参照だがFKは張らずUser削除の影響を受けない）を分離。
- **note**: 割当理由は自由記述。**個人情報・センシング情報を書かない運用ルールを明記**（自由記述のため監査証跡ではない）。
- **onDelete**: user=Cascade、course=Restrict（受講者のいるコース誤削除を防止）。→ §M でコース削除APIとの整合を是正（Restrict違反を409化）。
- **index**: `@@unique([userId, courseId, attempt])` が userId前方一致lookupを兼ねるため userId単独indexは不要。管理画面の「コース別割当一覧」用に `@@index([courseId, status])` を付与。
- **operational logging との区別**: 割当・解除操作は `lib/logger.ts`（operational logging）で記録するが、**法令監査証跡ではない**。改ざん防止証跡はスコープ外（§K）。
- **User/Course への追加**: `courseAssignments CourseAssignment[]` をUser・Courseへ追加（add-onlyのrelation field）。

### E-3. note のPII方針
`note` は管理者の自由記述。氏名以外の第三者個人情報・要配慮情報を書かない運用ガイドをUIに明記。将来構造化が必要なら別途設計（今回は自由記述・最小）。

### E-4. 限定解除コースの Course 表現（候補・未確定 §R Q8）
`Course.type` は `{BEGINNER, EXPERIENCED}` のみで限定解除を表せない。候補:
- (a) `CourseType` に `LIMITED_REMOVAL` 追加。利点: 既存型を流用。難点: `type === user.courseType` 判定で限定解除を誤って type アクセス対象にしない設計が必要（ユーザーの courseType は BEGINNER/EXPERIENCED のみなので自然に除外されるが意味的に歪）。
- (b) **`Course.category`（`BASIC` / `LIMITED_REMOVAL`）判別列を add-only（nullable・default BASIC相当）で追加**（推奨候補）。基礎=category=BASIC は type一致、限定解除=category=LIMITED_REMOVAL は割当ベース、と policy が明快。`type` は BASIC のみ意味を持つ。
- (c) 限定解除専用 model を別途新設。難点: Video/進捗の参照が複雑化。
- **推奨候補は(b)** だが、enum/seed/既存判定への影響があるため**確定しない**。Q8で決定後にM4へ織り込む。

---

## F. 限定解除の 進捗・試験・修了 分離可否（実測）

### F-1. 実測結果

| 対象 | model:キー（schema該当） | courseId保持 | 基礎/限定解除の分離 |
|---|---|---|---|
| 進捗 | `SubjectProgress`：`@@unique([userId, subjectId])`（L214） | なし | **不可**（Subject単位） |
| 進捗(動的集計) | `progressService.getProgressByUser`（L25-44）＝ViewingLog秒数をSubject別合算、必要分数はcourseTypeで選択 | なし | **不可** |
| 視聴ログ | `ViewingLog`：`userId, videoId`（L186-200） | videoId経由でcourseId到達可 | 集計時にcourse分離は未実装 |
| 試験 | `Exam`：`userId`（courseIdなし L235-252）、所有権は `exam.userId` で検証 | なし | **不可**（User単位） |
| 試験問題 | `Question`：`subjectId` のみ（courseIdなし L219-232） | なし | **不可**（Subject単位） |
| 修了証明書 | `CompletionCertificate`：`userId @unique`（L287） | なし | **不可・1ユーザー1通** |
| 科目 | `Subject`：4科目固定（L125-138）。Videoが `subjectId`＋`courseId` で科目を各コースに紐付け | — | Subjectは共有（コース横断） |

### F-2. 結論
**既存modelでは基礎と限定解除を分離できない。** 進捗・試験・修了は User単位/Subject単位で、単一トラック前提。特に `CompletionCertificate.userId @unique` は**1ユーザー1通**を強制し、基礎修了と限定解除修了を別々に持てない。

### F-3. 分離に必要な変更（M5+候補・段階導入）
完了条件（基礎/限定解除で 進捗・試験・合否・修了判定を各々分離）を満たすには、最低限:
- 進捗・試験・修了記録へ **`courseId` または `courseAssignmentId` を関連付け**（scope付与）。
- 限定解除の試験問題を course-scope（`Question` に courseId 付与 or 限定解除専用Subject集合）。
- **`CompletionCertificate.userId @unique` の解除**（→ `@@unique([userId, courseId])` 等へ）。これは**非add-only（既存ユニーク制約の変更）**で、停止条件・確認事項（§R Q9）。
既存データを壊さない段階移行＋backfill（既存はすべて基礎トラックとみなす等）を併設計。**本MVPではM5+を実装せず、設計候補として確定保留。**

---

## G. 限定解除 提供条件（料金/時間）の正本

### G-1. 既存調査
料金・講習時間・日数を持つmodelは**存在しない**（`Subject.requiredMinutesBeginner/Experienced` のみ）。Course/申込/カリキュラムにも金額列なし。→ 提供条件の置き場が現状ない。

### G-2. 候補（未確定・§R Q10）
- (1) 設定table（key-value）: 柔軟だが型安全性低。
- (2) **`CourseRequirement`（推奨候補）**: `(courseId, applicantCategory: BEGINNER|EXPERIENCED)` をキーに `lectureMinutes`, `simulatorMinutes`, `practicalMinutes`, `days`, `feeYen Int`（**整数・円単位**、浮動小数点禁止）を保持。初学者/経験者の2行で表の値を表現。マジックナンバー散在を防ぎ正本化。
- (3) Course拡張: Courseは category 単位で費用が初学者/経験者に分岐するため単一行では表現できず不適。

### G-3. 未確認（推測実装しない・§R Q10）
税込/税別、料金改定、適用開始日、**過去申込時の価格スナップショット**が未確認。これらが未確定のため**今回は提供条件の永続実装をしない**。MVPでは値を business要件として本書に記録するにとどめ、UI表示が必要な場合も定数を1箇所（`lib/constants/`）に集約し散在させない案を別途確認。`feeYen` は整数・円単位を確定候補とする。

---

## H. backfill / cutover

- **基礎コースはtype単位の権利**のため、全基礎Courseに受講生ごとの割当rowは**作らない**（backfill不要）。
- **限定解除の既存受講生**: schema上に限定解除受講を示すfield/申込/進捗/試験/証明書/ログは**存在しない**（§B-1）。既存Courseから限定解除Courseを一意識別する手段も現状なし。→ **信頼できるbackfill情報源がない**。
- 一意判定できないため:
  - **推測backfillをしない。**
  - **管理者が対象者を確認して手動割当する移行手順**を正本とする。
  - cutover前に**既存対象者の割当確認リスト**（管理者作成）を用意。
  - 移行gate: 限定解除アクセス制御を有効化する前に、対象者の `CourseAssignment` 投入を完了。**未割当の既存対象者が突然アクセス不能にならないよう**、限定解除Course自体が新規（既存受講者ゼロ）であることを確認してから有効化（新規コースなら既存アクセス断は発生しない）。
  - 基礎コースのアクセスはtype単位で従来どおりのため、移行で**既存の基礎受講者がアクセスを失わない**（policyの基礎分岐は現挙動を業務ルール化したもの）。

---

## I. `/student/courses` 仕様更新（基礎＋限定解除の2セクション）

- **基礎コースセクション**: `Course.type === user.courseType` の全Course。`user.courseType` が null は「コース未割当」案内。
- **限定解除コースセクション**: **有効な `CourseAssignment` がある場合のみ表示**。未割当なら申込可能と断定するCTA・架空データを出さない（セクション非表示 or 「割当なし」明示）。
- 各コースの進捗は**対応する独立進捗データ**を表示（限定解除進捗はM5+実装まで「準備中」等の非断定表示。架空進捗を出さない）。
- 0件時（基礎も限定解除も無し）: 「受講可能なコースがありません。管理者にお問い合わせください」。
- 各Courseから既存 `/courses/[courseId]`（policyで保護）へ遷移。
- ダッシュボードボタン「コース一覧を見る」→ `/student/courses`（v2.1踏襲）。
- ADMIN `/admin/courses`（管理CRUD）と STUDENT `/student/courses`（閲覧）は責務・認可分離。

---

## J. Phase 0 再構成（8サブタスク・各条件＋test）

> 番号は計画全体と整合。**実行順は下記1→8**。DB migration適用は別途明示承認（計画承認だけでstaging/productionへ適用しない）。

| # | サブタスク | 開始条件 | 完了条件 | 停止条件 | 主要test |
|---|---|---|---|---|---|
| 0-1 | 認可面・関連modelの調査結果確定（本書 §C/§E/§F/§G が成果物） | なし | 本書レビュー承認 | 新たな不明点発見で確認待ち | — |
| 0-2 | DB変更のcreate-only計画とmigration gate確定（§K, §6方針） | 0-1 | `DATABASE_URL` host/db名確認gate手順・create-only手順を文書化 | 対象DBがlocal devでない | gate手順のdry-run |
| 0-3 | 限定解除の個別割当model（M4 `CourseAssignment`）＋管理者割当機能。**Q8/Q11解消後に着手** | 0-2＋Q8/Q11回答 | schema確定→create-only→staging適用→割当/解除API＋管理UI緑 | Q8/Q11未回答・@unique等の非add-only要求 | 割当CRUD/ADMIN認可test |
| 0-4 | 共通 `canAccessCourse` policy＋認可回帰test（**基礎分岐は先行実装可**） | 0-1（基礎分岐）/ 0-3（限定解除分岐） | §C全入口がpolicy経由・回帰test緑 | 既存視聴/試験E2E回帰 | §N の認可test群 |
| 0-5 | `/student/courses` 一覧（基礎＋限定解除2セクション・§I） | 0-4 | 2セクション表示・empty state・遷移・test緑 | policy未完成 | 一覧test |
| 0-6 | dashboard/StudentLayout の link修正（→ `/student/courses`、文言「コース一覧を見る」） | 0-5 | 該当link実在page着地・dangling 0件 | — | StudentLayout.test |
| 0-7 | 管理page route `/admin/*` 移設＋307 redirect（§v2.1 §1踏襲） | 0-6（学生linkが`/courses`非依存化後） | 移設完了・`(admin)`空・redirect設定・middleware検証 | V6/V8回帰 | AdminLayout.test, redirect検証 |
| 0-8 | role別E2E・直接URL/API・既存動画視聴・進捗/試験/修了の回帰検証 | 0-7 | §N の全項目pass・各サブタスク完了時点の作業ツリーでdangling 0件 | いずれか失敗で停止 | §N E2E/HTTP |

**実行順の要点**: 0-4の基礎分岐と0-5/0-6（学生link張替え）を、0-7（管理route移設）より先に行い、**各サブタスク完了時点の作業ツリーでもdangling linkを出さない**。限定解除分岐（0-3/0-4後半）はQ8/Q11解消が前提のため、未解消なら**基礎分岐までで一旦確定**し限定解除は後続。

---

## K. DB変更 M4以降（確定 / 候補 / 見送り）

| # | 変更 | 分類 | add-only | 備考 |
|---|------|------|------|------|
| M1 | EnrollmentApplication に nullable 2列（書類確認） | 今回確定 | yes | §v2.1 §6-3 |
| M2 | AgreementText 新設＋partial unique index | 今回確定 | yes | §L |
| M3 | Instructor 新設 | 今回確定 | yes | §v2.1 |
| **M4** | **CourseAssignment 新設（+enum, User/Course relation field）** | **今回確定（Q8/Q11解消後にschema確定）** | yes | §E。限定解除の個別割当・アクセス制御の基盤 |
| M4b | Course に `category`（BASIC/LIMITED_REMOVAL）判別列 | **候補（Q8）** | yes（nullable default） | 限定解除Course表現の推奨候補(b) |
| M5 | 進捗/試験へ courseId or courseAssignmentId scope付与、限定解除試験問題のcourse-scope | **候補（Q9）** | 一部yes | 基礎/限定解除の進捗・試験分離 |
| M6 | CompletionCertificate の `userId @unique` 解除＋course scope | **候補（Q9・停止条件）** | **no（非add-only）** | 修了証明書を基礎/限定解除で分離。要再承認・要backfill |
| M7 | CourseRequirement（料金/時間 正本） | **候補（Q10）** | yes | 税/改定/snapshot未確認のため保留 |
| — | DIPS CSV（DIPSExportLog活用） | 見送り（Q3） | — | 仕様未確定 |
| — | 改ざん防止監査証跡 | 見送り | — | operational loggingと別物 |

> **migration共通（§v2.1 §6踏襲・強調）**: create-only → 環境確認gate（`DATABASE_URL` のhost/db名をpassword伏せて表示・人間確認、staging/productionに `migrate dev` 実行禁止） → SQL review → backup → staging適用→回帰 → 明示承認 → `migrate deploy`。**ADD ONLYでも「無リスク/安全に戻せる」と表現しない**（適用・回帰・データ損失リスクあり）。障害は**forward fix優先**。`DROP COLUMN`/`DROP TABLE`/制約変更のdownは緊急候補のみ（データ損失確認＋backup確認＋再承認必須）。`_prisma_migrations` 直接編集禁止。`prisma migrate resolve` は公式手順の失敗復旧時のみ。

---

## L. AgreementText 同時実行test（訂正）

partial unique index 採用は維持（§v2.1 §6-2）。ただし「並行有効化で**必ず**片方がunique違反」を必須期待値にしない。test要件:
- 並行実行後も **active は最大1件**（2件にならない）。
- DBロック等で順に両方成功した場合も、**最終 active が1件**。
- unique競合が実際に発生した場合は **409等の既定エラー**へ変換。
- target ID不存在時は transaction が rollback され、**既存 active が維持**される。
- 「必ず片方が失敗する」を必須期待値にしない。
- partial unique index非採用時の代替（`Serializable`＋有限回retry＋失敗エラー）も同方針。「transactionなので原子的に保証」とは書かない。

---

## M. その他の訂正

- 「中間commitでもdangling linkを出さない」→「**各サブタスク完了時点の作業ツリーでもdangling linkを出さない**」。commitは明示承認制のまま。
- **git status だけで今回の作成者・変更時刻まで証明できるとは書かない**（git status は作業ツリーの差分一覧であり、authorship/timestampの証明ではない）。
- 旧URL redirect は当面保持・**自動削除しない**。アクセスログの参照先と責任者が決まった後、別タスク・別承認で削除判断。**Q7はPhase 0のブロッカーから除外**。
- 命名: **`CourseAssignment`** を採用候補とし、既存 `EnrollmentApplication` と混同しないことを確認（"Enrollment" を避けた）。
- **コース削除APIと `onDelete: Restrict` の整合**: `DELETE /api/admin/courses/[id]` は現状 `prisma.course.delete`（物理削除）。`CourseAssignment.course onDelete: Restrict` 導入後、割当のあるコース削除はFK違反で失敗する。`courseService.deleteCourse` を**事前チェック（割当存在なら拒否）＋FK例外を 409 へ変換**するよう是正（M4と同時）。

---

## N. test計画（最低限）

認可:
- BEGINNER → BEGINNER基礎Course全件アクセス可 / EXPERIENCED基礎Courseアクセス不可。
- EXPERIENCED → EXPERIENCED基礎Course全件可 / BEGINNER基礎不可。
- 限定解除割当ありの受講生のみ限定解除Courseアクセス可。
- 限定解除割当なし → 一覧・page・動画API・動画詳細・視聴ログ更新の**全入口で拒否**。
- inactive/suspended/cancelled の割当ではアクセス不可。
- URL/APIへID直接指定でpolicyを迂回できない（IDOR）。
- ADMINは学生Course認可の影響を受けず管理権限維持。

分離（M5+実装時）:
- 基礎と限定解除の進捗・試験・合否・修了結果が混ざらない。

回帰:
- 既存の学生動画視聴・試験・認証E2Eが回帰しない。
- `/courses` だけが307・`/courses/[courseId]` はadmin redirectに巻き込まれない（§v2.1 V7/V8）。

AgreementText: §L のtest群。

---

## O. route / API / service / repository / UI / test 変更一覧

**新規**
- `services/courseAccessService.ts`（`canAccessCourse`。命名は既存規則で最終確定）
- `services/courseAssignmentService.ts`（割当CRUD・ADMIN認可。M4）
- `repositories/courseAssignmentRepository.ts`（M4）
- `app/api/admin/course-assignments/route.ts`・`[id]/route.ts`（割当・解除。ADMIN）
- `app/admin/course-assignments/page.tsx`（管理者割当UI。完成時にnav追加）
- `app/student/courses/page.tsx`（基礎＋限定解除2セクション）
- `services/studentCourseService.ts`（一覧用。基礎=type一致、限定解除=有効割当）
- `components/student/CourseListItem.tsx`
- test: `courseAccessService.test.ts`, `courseAssignmentService.test.ts`, `studentCourseService.test.ts`, 各route test, `/student/courses` page test

**変更**
- `repositories/courseRepository.ts`（`findByType` 追加。既存 `findAll` 不変）
- `services/progressService.ts`（`getVideosWithLockStatus`/`canWatchVideo` 先頭に `canAccessCourse` ガード）
- `app/(student)/courses/[courseId]/page.tsx`・`app/api/student/courses/[courseId]/videos/route.ts`・`app/api/student/videos/[id]/route.ts`・`app/api/student/viewing-log/route.ts`・`app/api/student/fraud-flag/route.ts`（policy適用。§C）
- `services/courseService.ts`＋`app/api/admin/courses/[id]/route.ts`（削除時の割当チェック・FK例外409化。§M）
- `app/student/page.tsx`（link→`/student/courses`、文言「コース一覧を見る」）
- `components/layouts/StudentLayout.tsx`（`/student/courses` 実在化）
- `components/layouts/AdminLayout.tsx`（管理route移設URL・割当UIリンクは完成時）
- `lib/serviceFactory.ts`（新service登録）
- `prisma/schema.prisma`（M4。Q8でM4b、Q9でM5/M6、Q10でM7）
- `next.config.mjs`（307 redirect。§v2.1 §1-4）
- 管理page route移設群（§v2.1 §1-3）
- test更新: `middlewareHelpers.test.ts`, `AdminLayout.test.tsx`, 既存student系の回帰

**M5+（候補・今回未実装）**: 進捗/試験/修了へのcourse scope付与、`CompletionCertificate.userId @unique` 変更、限定解除試験問題のscope、`CourseRequirement`。

---

## P. 20画面計画との関係 / MVP scope増減

- 本書 v2.2 は20画面のMVP subset。**実装順・依存の正本は本書**。
- scope **増**: 限定解除コースのアクセス制御・個別割当（M4）・`/student/courses` 2セクション・共通認可policy・Q6是正。
- scope **据置（候補・後続）**: 限定解除の進捗/試験/修了分離（M5/M6）、提供条件の永続化（M7）、DIPS CSV、改ざん防止監査。
- 管理者ダッシュボードは基盤完了後の最初の管理画面として **A案「アラートタイル型」を維持**（実データのみ・架空表示なし）。
- スコープ外画面は削除でなく後続計画へ延期。20画面プロンプトは受入条件資料として保持。

---

## Q. リスク

| # | リスク | 対策 |
|---|---|---|
| R1 | systemicなIDOR/認可ギャップ（§C） | 共通 `canAccessCourse` を全入口に。回帰test（§N） |
| R2 | 限定解除Course表現の確定不足 | Q8解消までschema確定しない。M4bは候補 |
| R3 | 進捗/試験/修了が分離不可・`@unique` 非add-only変更 | M5/M6候補・停止条件・Q9確認。MVPは割当/アクセス/一覧まで |
| R4 | コース物理削除×割当Restrictの不整合 | 削除前チェック＋FK例外409化（§M） |
| R5 | backfill情報源なし | 推測しない・管理者手動割当・移行gate（§H） |
| R6 | 料金/時間の散在・税仕様未確認 | 正本table候補化・整数円・Q10まで永続実装しない |
| R7 | redirectの巻き込み | 完全一致・`:path*`禁止（§v2.1） |
| R8 | AgreementText active重複 | partial unique index＋§Lのtest |

---

## R. 残る未確認事項（推測しない。回答後に確定）

- **Q8**: 限定解除コースの Course 表現（(a)CourseType enum拡張 / (b)Course.category判別列＝推奨候補 / (c)別model）。
- **Q9**: 進捗・試験・修了の分離設計、特に `CompletionCertificate.userId @unique` の解除可否（**非add-only**）。限定解除試験問題のscope方法（Questionにcourseid付与 / 限定解除専用Subject）。
- **Q10**: 提供条件（料金/時間）の税込税別・料金改定・適用開始日・**過去申込時の価格スナップショット**。確定まで永続実装しない。
- **Q11**: 既存限定解除受講生のbackfill情報源（現状なし。手動割当で良いか）。
- **Q12**: 認可失敗時の 403/404 統一（未割当/他typeは存在秘匿の404を既定とする方針で良いか）。

---

## S. 実行制御（明示承認が必要）

`git commit` / `push` / PR / staging・production deploy / **DB操作（`prisma migrate deploy` 含む）** はユーザーの明示承認なしに実行しない。ローカル作業（編集、ローカル build/test/lint、create-only SQL生成＝環境gate下）は計画承認の範囲。本書は計画のみで、コード・設定・schema・migration・test・packageを一切変更していない。

---

## 報告（本指示の9項目）は別途チャットで回答。
