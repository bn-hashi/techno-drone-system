# 事務管理MVP 実装計画 v2.1

> 作成日: 2026-06-21
> ブランチ: feature/claude-design-integration
> 入力: docs/05_mvp-implementation-plan-v2.md（v2は削除・上書きしない）
> 承認状態: **承認待ち（コード未変更）**
> 位置づけ: 「Phase 1〜3の20画面」全体のうち、**今回実装するMVP subset**。スコープ外画面は削除ではなく後続計画へ延期（§12）。

---

## A. v2からの変更一覧

| # | 変更 | 種別 |
|---|------|------|
| 1 | 旧URL redirectを採用。`next.config.mjs` の `redirects()` で `permanent: false`（**307**）。source patternは完全一致/単一segmentのみ（`:path*`禁止）。検証testを計画に追加 | 確定要件反映 |
| 2 | §1-6の完了条件を「200」だけでなく**307確認**へ訂正。Phase 0検証をbuildだけでなくtest server起動+E2E/HTTP testへ拡張 | 確定要件反映 |
| 3 | 受講生コースリンク問題を**複数コース対応**の業務要件として再定義。`/student/courses` 新設、ボタン「コース一覧を見る」、`StudentLayout` も `/student/courses` に統一 | 業務要件反映 |
| 4 | **複数コース対応を実測調査**（§D）。結論: 既存modelでは表現不可。**M4候補（add-only中間table）を設計したが段階導入を推奨**。backfillは一意決定不可のため追加確認事項に | 調査+設計判断 |
| 5 | **Phase 0を 0-A / 0-B / 0-C に分割**。dangling link 0件を完了条件に。実行順を 0-B→0-C→0-A に明示（中間状態でもlink切れを出さない） | 確定要件反映 |
| 6 | AgreementText の active一意性を**PostgreSQL partial unique index**第一候補に変更。`$transaction`単体では不十分と訂正。手動SQL追記手順・競合エラーtestを追加（§6-2） | 追加レビュー反映 |
| 7 | Migration表現を訂正: ADD ONLYでも「無リスク/安全に戻せる」と書かない。**forward fix優先**、down SQLは緊急候補（データ損失確認+backup+再承認必須）（§6） | 追加レビュー反映 |
| 8 | create-onlyは**専用local dev DB限定**。実行前に `DATABASE_URL` のhost/db名をpassword伏せて表示し人間確認gateを追加（§6-0） | 追加レビュー反映 |
| 9 | 潜在認可ギャップを記載: 学生動画API（`/api/student/courses/[courseId]/videos`）が `courseType` を検証していない事実（§D-4）。MVP対応範囲と後続課題を分離 | 調査結果 |
| 10 | 20画面計画との関係を明記。本書を実装順・依存の正本とする（§12） | 確定要件反映 |

---

## B. 事実 / 業務確定要件 / 設計判断 / 未確認事項 の区分

### B-1. 事実（コードベース実測。§Dに根拠）
- User↔Course の直接リレーションは存在しない。User は単一 `courseType: CourseType?` を持つ。
- `courseType` は「表示ラベル」＋「必要視聴分数の計算入力」であり、**コースアクセスのフィルタには使われていない**。
- 進捗は **Subject単位**（`SubjectProgress @@unique([userId, subjectId])`）。Course単位の進捗は存在しない。
- 学生コースのlist API（`GET /api/student/courses`）は**存在しない**。`[courseId]/videos` のみ。
- `next.config.mjs` に `redirects()` は未定義。Next.js `14.2.35`。

### B-2. 業務確定要件（ユーザー回答）
- 旧管理URLは307 redirectで救済（保持1〜2リリース、削除は別途判断）。
- 1人の受講生が現在/将来、**複数コースを同時受講**しうる。
- 受講生UXは「コース一覧を見る」。`/student/courses` で受講権限のあるコースのみ表示、0件はempty state。架空ID/固定ID/先頭コース転送は禁止。
- ADMIN `/admin/courses` と STUDENT `/student/courses` は責務・認可を分離。
- 管理者ダッシュボードは基盤後の最初の管理画面、A案「アラートタイル型」を維持。

### B-3. 設計判断（本書で決定。理由つき）
- Phase 0実行順を 0-B→0-C→0-A とし、中間commitでもdangling linkを出さない（§1）。
- `/student/courses` のMVPは**既存modelの唯一のアクセス信号 `Course.type === user.courseType` で実装**（実データのみ・新model不要）（§E）。
- 真の複数コース割当は **M4候補（`CourseEnrollment` 中間table）として設計するが、今回MVPには含めず段階導入**（§D-7 / §6-4）。
- AgreementText の active一意性は **partial unique index** を第一候補（§6-2）。
- M1/M2 の `*By` 列はFKなしの**表示名スナップショット**（v2 §6-1/6-2を踏襲）。

### B-4. 未確認事項（推測しない。回答後に確定）→ §11
- (Q5) M4の今回採用可否と、既存ユーザーのコースbackfill方法。
- (Q6) 学生動画APIの認可ギャップ（courseType未検証）を今回是正するか、後続にするか。
- (Q7) 旧URL redirectの保持期間と削除トリガの運用判断。

---

## C. 確認事項の最終回答（v2 §0更新）

| 質問 | 回答 | 状態 | 影響 |
|-----|------|------|------|
| Q1 書類確認列 | (A) `documentCheckedAt` + `documentCheckedBy` | 回答済み | M1 |
| Q2 規約バージョン管理 | 複数版保持 + `isActive` + `updatedBy` | 回答済み | M2（active一意性は§6-2で強化） |
| Q3 DIPS CSV仕様 | 未確定 | 今回除外 | 着手しない |
| Q4 ルーティング統一 | (A) 全管理画面を `/admin/*` へ | 回答済み | Phase 0（0-A/0-B/0-C） |
| §9-1 旧URL redirect | 採用（307・完全一致） | 回答済み | §1-4 |
| §9-2 受講生コースリンク | `/student/courses` 新設 | 回答済み | Phase 0-B/0-C, §E |

---

## D. 複数コース対応の実測調査（根拠つき）

### D-1. 調査したファイルと現状

| 調査対象 | ファイル / symbol | 現状 |
|---|---|---|
| User model | `prisma/schema.prisma` L64-88（`model User`） | `courseType CourseType?`（L70・単一nullable enum）。Courseへのrelationフィールドは**ない** |
| Course model | `prisma/schema.prisma` L141-149（`model Course`） | `id, name, type CourseType, videos Video[]`。`userId`なし・Userへのrelationなし・join tableなし |
| Video model | `prisma/schema.prisma` L152-171 | `subjectId`(L156) と `courseId`(L157) の両方を持つ |
| 進捗 model | `prisma/schema.prisma` L203-216（`SubjectProgress`） | `@@unique([userId, subjectId])`（L214）。**Subject単位**。Course単位の進捗なし |
| 視聴ログ | `prisma/schema.prisma` L186-200（`ViewingLog`） | `userId, videoId` |
| 申込 | `prisma/schema.prisma` L91-110（`EnrollmentApplication`） | `userId @unique`。コース情報を持たない（本人確認資料のみ） |
| course list取得 | `repositories/courseRepository.ts` L28-31 | `findAll` は `prisma.course.findMany({ take: limit })`。**user/courseTypeで絞っていない（全件）** |
| 学生コースAPI | `app/api/student/courses/[courseId]/videos/route.ts` L7-33 | listは無し。`[courseId]/videos` のGETのみ |

### D-2. `courseType` は表示分類か受講権限か

**結論: 表示ラベル ＋ 必要視聴分数の計算入力。コースアクセスのフィルタではない。**

- `services/progressService.ts` `getProgressByUser` L25-44: `courseType` で `requiredMinutesBeginner`/`requiredMinutesExperienced` を選ぶ（L31-34）。→ **計算入力**。
- `app/student/page.tsx` L43: ラベル表示。`app/(student)/exams/page.tsx` L47: `checkEligibility(userId, courseType)`。
- `app/student/page.tsx` L27 / `app/api/student/progress/route.ts` L23: 「courseTypeが無ければ先へ進めない」存在チェック（gate）であって、**どのコースを見られるかの絞り込みではない**。

### D-3. 複数コース割当のrelationは存在するか

**存在しない。** User は単一 `courseType` enum のみ。per-userのCourse割当（join table / userId on Course）は無い。User↔Course の唯一の関連は「`CourseType` enum の一致」という暗黙の型一致のみ。

### D-4. 学生動画APIの認可条件（重要・潜在ギャップ）

`app/api/student/courses/[courseId]/videos/route.ts`:
- L13-22: `session`存在 / `role===STUDENT` / `status===ACTIVE` のみ検証。
- L25: 任意の `courseId` について `getProgressService().getVideosWithLockStatus(userId, courseId)` を呼ぶ。
- `services/progressService.ts` `getVideosWithLockStatus` L71-76 → `videoRepo.findAll({ courseId, isPublished: true })`。
- **どこでも `Course.type === user.courseType` を検証していない。**

→ **事実: ACTIVEな受講生は、自分のcourseTypeと異なるコースを含め、任意の `courseId` の公開動画一覧を取得できる。** これは現状の挙動。今回これを是正するかは §11 Q6（推測で挙動を変えない）。

### D-5. 進捗データの粒度

**Subject単位。** `getProgressByUser`（L25-44）が Subject を反復し ViewingLog 秒数を合算、必要分数は courseType で決定。`SubjectProgress` table も `(userId, subjectId)` キー。Course単位・CourseType単位の進捗テーブルは無い。

### D-6. 既存データから「本人が受講可能なコース一覧」を安全に取得できるか

- 既存の唯一のアクセス信号は `Course.type === user.courseType`。
- したがって**今すぐ安全に出せる一覧** = `prisma.course.findMany({ where: { type: user.courseType } })`。実在Courseのみ・架空ID無し・先頭転送無し。
- ただしこれは**型一致**であって per-user割当ではない。「同型の全コース」が出る。特定ユーザーが同型の一部コースだけ受講する、または別型コースも受講する、という要件は表現できない。

### D-7. 分岐の結論

**既存modelでは「複数コースを per-user で表現」できない**（型一致のみ）。よってユーザー指示の「表現できない場合」分岐に従う:

- `user.courseType` だけで複数コース対応済みとは見なさない（§D-2/D-3）。
- **M4候補（add-only中間table `CourseEnrollment`）を設計**（§6-4）。
- ただし**今回MVPには含めず段階導入を推奨**（理由は下記）。
- backfillは一意決定不可（同型に複数コースがある場合、本人がどれを受講するか既存データから機械的に決められない）→ **推測割当しない。§11 Q5で確認**。

**今回採用 vs 段階導入の比較**

| 観点 | M4を今回採用 | M4を段階導入（推奨） |
|---|---|---|
| `/student/courses`（Phase 0-B） | enrollmentベースで実装 | `Course.type===courseType` で実装（実データ） |
| dangling link解消 | 可 | 可（同等にPhase 0で解消） |
| backfill | 一意決定不可→確認待ちでPhase 0が停止 | 不要（Phase 0を止めない） |
| 認可の厳密化 | 動画APIもenrollment検証へ要変更（挙動変更・要test） | 現状維持＋ギャップは§11 Q6で別途 |
| リスク | DB+認可+移行が同時、影響大 | 影響を分離、段階的に検証可能 |

**推奨: 段階導入。** Phase 0-B は型一致で実データのコース一覧を出してdangling linkを解消し、M4は本書に設計を残してQ5回答後に別フェーズで導入する。これにより「schemaを推測で確定しない」「Phase 0を止めない」を両立する。

---

## E. Phase 0-B: 受講生コース一覧 `/student/courses`（今回実装・M4なし）

### E-1. 仕様
- 新規 `app/student/courses/page.tsx`（Server Component、STUDENT認可）。
- 表示対象 = **`Course.type === user.courseType` のコースのみ**（§D-6の安全な導出）。`user.courseType` が null の場合は「コース未割当」案内（既存ダッシュボードと同文言方針）。
- 0件時: 「受講可能なコースがありません。管理者にお問い合わせください」のempty state。
- 各コースカードから既存 `/courses/[courseId]` へ遷移（既存の受講生コース詳細を再利用）。
- 架空ID・固定ID・先頭コース無条件転送は使わない。

### E-2. ADMIN/STUDENT の責務・認可分離
- ADMIN `/admin/courses`（移設後）= コースマスタのCRUD管理（全コース対象）。
- STUDENT `/student/courses`（新規）= 自分の受講権限（現状は型一致）のコース閲覧のみ。書込み不可。
- ルートも認可も別系統（middlewareの `/admin/*` と `/student/*`、各layoutの `requireAdminSession` / 学生session検証）。

### E-3. 変更/新規ファイル
| ファイル | 種別 | 内容 |
|---|---|---|
| `app/student/courses/page.tsx` | 新規 | 受講生コース一覧（Server Component） |
| `services/studentCourseService.ts` | 新規 | `listAccessibleCourses(userId)`：userの`courseType`取得→型一致Courseを返す。単一責任 |
| `repositories/courseRepository.ts` | 変更 | `findByType(type: CourseType)` を追加（既存`findAll`は不変） |
| `lib/serviceFactory.ts` | 変更 | `studentCourseService` 登録 |
| `components/student/CourseListItem.tsx` | 新規 | コースカード（Client不要なら純表示） |
| `__tests__/services/studentCourseService.test.ts` | 新規 | 型一致のみ返す/0件/null courseType の各ケース |
| `__tests__/app/student/courses/page.test.tsx`（or RTL） | 新規 | empty state・遷移先href=`/courses/[id]` |

> 注: API route（`GET /api/student/courses`）はServer Componentで直接serviceを呼べば必須ではない。TanStack Query等でClient取得する場合のみ追加。MVPはServer Component直呼びを既定とする。

### E-4. 条件
- **開始条件**: なし（Phase 0-Aより先に着手＝§1の実行順）。
- **完了条件**: `studentCourseService` test緑、empty state表示、`/courses/[id]` への遷移確認、`make build`緑。
- **停止条件**: 型一致以外の不明な絞り込みが必要と判明したら停止し §11 Q5/Q6 を確認。

---

## 1. Phase 0: ルーティング統一（Q4=A・最優先・分割実行）

> v2の単一Phase 0を **0-A / 0-B / 0-C** に分割。**実行順は 0-B → 0-C → 0-A**（リンク先pageを用意してからlinkを張替え、最後に旧routeを移設＝中間状態でもdangling linkを出さない）。

### 1-1. 構成

| サブ | 内容 | 依存 |
|---|---|---|
| 0-B | `/student/courses` 新設（§E。実データ・M4なし） | なし（最初に実施） |
| 0-C | `app/student/page.tsx`・`StudentLayout` のコースlinkを `/student/courses` へ、ボタン文言「コース一覧を見る」 | 0-B完了 |
| 0-A | 管理page routeを `/admin/*` へ移設＋旧管理URLの307 redirect | 0-C完了（学生linkが`/courses`を指さなくなった後） |

### 1-2. 移設の基本原則（v2踏襲）
- **移設対象は page route のみ**（`app/(admin)/.../page.tsx`）。
- **API route（`app/api/admin/...`）は移設しない**。`lib/api/*` の `fetch("/api/admin/...")` は変更不要。
- 受講生 route（`app/(student)/courses/[courseId]` 等、URL `/courses/[courseId]`）は**移設対象外**。

### 1-3. ルーティング影響表（page routeのみ）

| 現route（ファイル） | 現URL | 移設先 | 新URL | 旧URL redirect（307・完全一致） | middleware | 内部link修正 | test影響 |
|---|---|---|---|---|---|---|---|
| `app/(admin)/courses/page.tsx` | `/courses` | `app/admin/courses/page.tsx` | `/admin/courses` | `source:"/courses"`→`/admin/courses` | 変更不要 | AdminLayout L10 | AdminLayout.test, redirect検証 |
| `app/(admin)/videos/page.tsx` | `/videos` | `app/admin/videos/page.tsx` | `/admin/videos` | `source:"/videos"`→`/admin/videos` | 変更不要 | AdminLayout L11 | AdminLayout.test |
| `app/(admin)/questions/page.tsx` | `/questions` | `app/admin/questions/page.tsx` | `/admin/questions` | `source:"/questions"`→`/admin/questions` | 変更不要 | AdminLayout L12 | AdminLayout.test |
| `app/(admin)/exam-results/page.tsx` | `/exam-results` | `app/admin/exam-results/page.tsx` | `/admin/exam-results` | `source:"/exam-results"`→`/admin/exam-results` | 変更不要 | AdminLayout L13 | AdminLayout.test |
| `app/(admin)/students/[id]/page.tsx` | `/students/[id]` | `app/admin/students/[id]/page.tsx`（既存folderへ統合） | `/admin/students/[id]` | `source:"/students/:id"`→`/admin/students/:id`（**単一segment**） | 変更不要 | `app/admin/users/page.tsx` L62 | （URL直書きtest要再grep） |
| `app/(admin)/students/[id]/InviteButton.tsx` | component | `app/admin/students/[id]/InviteButton.tsx` | — | 不要 | — | import相対のみ | InviteButton test |
| `app/(admin)/layout.tsx` | layout | **削除**（`app/admin/layout.tsx` が同一の `requireAdminSession`+`AdminLayout` を提供） | — | — | — | — | — |

**移設先の既存状況**: `app/admin/students/[id]/` に既に `certificate/page.tsx`・`review/page.tsx` が存在。`page.tsx` と `InviteButton.tsx` を同folderへ統合（同名衝突なし）。

### 1-4. 旧URL redirect 設計（307・完全一致・`:path*`禁止）

`next.config.mjs` に `async redirects()` を追加（現状未定義・§D-1）。`permanent: false` → **HTTP 307**。

```js
async redirects() {
  return [
    { source: "/courses",       destination: "/admin/courses",       permanent: false },
    { source: "/videos",        destination: "/admin/videos",        permanent: false },
    { source: "/questions",     destination: "/admin/questions",     permanent: false },
    { source: "/exam-results",  destination: "/admin/exam-results",  permanent: false },
    { source: "/students/:id",  destination: "/admin/students/:id",  permanent: false },
  ];
}
```

- ⚠️ `/courses` は**パラメータなしの完全一致のみ**。受講生 `/courses/[courseId]` と `/courses/[courseId]/videos/[videoId]` は `source:"/courses"` にマッチしない（Next.jsの `source` は完全パス一致。`/courses/:path*` は使わない）。
- `/students/:id` は**単一segment**。`/students/abc/review` のような2segmentにはマッチしない（`:id` は1セグメント。`:id*`/`:path*` 禁止）。
- redirectは管理者内部URLのブックマーク救済目的。保持1〜2リリース、削除はアクセス実績を見て別途判断（§11 Q7）。

### 1-5. middleware（変更不要・要検証。v2踏襲）
- `middleware.ts` matcher `"/(admin|student)/:path*"` は既に `/admin/*` を包含。
- `lib/middlewareHelpers.ts` `determineRedirect` は `/^\/admin(\/|$)/`・`/^\/student(\/|$)/` で判定。
- **ロジック変更不要。** `__tests__/lib/middlewareHelpers.test.ts` に新URL（`/admin/courses` 等）と `/student/courses` の保護ケースを追加して検証。

### 1-6. 内部リンク修正一覧

| ファイル | 現在 | 修正後 | フェーズ |
|---|---|---|---|
| `app/student/page.tsx` L101-106 | `href="/courses"` / 「受講ページへ」 | `href="/student/courses"` / 「コース一覧を見る」 | 0-C |
| `components/layouts/StudentLayout.tsx` L7 | `{ href: "/student/courses", label: "受講" }`（※現状確認: 既に`/student/courses`表記。実在化はE） | `/student/courses`（ラベル統一・実在page化） | 0-C |
| `components/layouts/AdminLayout.tsx` L10-13 | `/courses` `/videos` `/questions` `/exam-results` | `/admin/courses` `/admin/videos` `/admin/questions` `/admin/exam-results` | 0-A |
| `app/admin/users/page.tsx` L62 | `href={`/students/${user.id}`}` | `href={`/admin/students/${user.id}`}` | 0-A |

> 注: `StudentLayout` L7 は既に `/student/courses` という表記だが、対応pageが無いため現状dangling。0-Bでpageを実在化し、0-Cでダッシュボードのlinkも揃える。**Phase 0完了時に `/student/courses` を指すlinkはすべて実在pageに着地**する。

**修正不要（確認済み）**: `app/(admin)/students/[id]/page.tsx` L89,108（既に `/admin/students/...`）、`lib/api/*` の `/api/admin/*`（API移設なし）、E2E `CourseDetailPage.ts`/`VideoViewingPage.ts`（受講生 `/courses/[courseId]`）。

### 1-7. Phase 0 検証（buildだけで200確認しない）

`next build` 成功後に **test server を起動**し、E2E（Playwright）またはHTTP testで次を確認:

| # | 検証項目 | 期待 |
|---|---|---|
| V1 | ADMINが新管理URL（`/admin/courses` 等）を開ける | 200 |
| V2 | 未認証で新管理URLへ | `/login` へ誘導 |
| V3 | STUDENTが新管理URLへ | 不可（login/forbidden） |
| V4 | STUDENTが `/student/courses` を開ける | 200・自分の権限コースのみ |
| V5 | ADMINが `/student/courses` へ | 不可 |
| V6 | 既存 `/courses/[courseId]` と動画視聴 | 従来どおり動作 |
| V7 | `/courses` へGET | **307** で `/admin/courses` |
| V8 | `/courses/[courseId]` がadmin redirectに**巻き込まれない** | 学生pageのまま（307しない） |
| V9 | `/students/:id` → `/admin/students/:id` の307、`/students/abc/review` は巻き込まれない | 期待どおり |
| V10 | 旧管理URL・内部linkの漏れ無し（grep + ナビ実クリック） | 0件 |

加えて **redirect設定の検証test**（`next.config.mjs` の redirects配列shape、または上記V7-V9のHTTP/E2E）で、現Next.js 14.2.35での source pattern挙動を担保。

### 1-8. Phase 0 条件
- **開始条件**: Q4=A確定済み（即着手可）。実行順 0-B→0-C→0-A厳守。
- **完了条件**:
  1. 全管理page routeが `app/admin/*` へ移設、`app/(admin)/` 空（layout削除）。
  2. `/student/courses` 実在、ダッシュボード/Studentナビが `/student/courses` を指す。
  3. **dangling link 0件**（grep + 実クリック、特に旧 `/courses` を指す学生linkが残っていない）。
  4. V1-V10 すべてpass。
  5. `make build` / `make test` / `make lint` / 型チェック緑。middlewareHelpers.test・AdminLayout.test 更新済み緑。
- **停止条件**: V6（受講生視聴）またはV8（redirect巻き込み）が落ちたら即停止し原因切り分け。

---

## 2. Admin ナビゲーション公開ルール（v2踏襲・404を出さない）
- `NAVIGATION_LINKS` には**完成・公開済みpageのリンクのみ**追加。未完成画面へのlinkは出さない。
- 各新規画面タスクの完了と同時に該当navリンクを追加。
- Phase 0-AのAdminLayoutは移設4本のURL付替え（§1-6）のみ。新規画面（ダッシュボード/台帳/規約/講師）は各完成時に逐次追加。

---

## 3. Phase 1: デザインシステム統一（v2踏襲）
- **3-1 token**: `primary` 不変、`accent:#2563eb`/`pageBackground:#f4f6fa` を追加。font は既存 `@fontsource/noto-sans-jp`（導入済み・未使用）を再利用、`next/font/google` 不使用。変更: `tailwind.config.ts`/`app/layout.tsx`/`app/globals.css`。test: `tailwind-tokens.test.ts`（accent/pageBackground追加＋primary不変regression）。
- **3-2 共通UI**: Button/Card/Badge/Input/Table/Modal/LoadingSpinner/AppLayout の色をtoken化。Props不変。
- **3-3 ログイン再設計**: DOROBY非参照。auth E2Eのrole/labelセレクタ維持。
- **3-4 StudentLayoutナビ**: §1-6/0-Cで `/student/courses` へ統一。その他不一致linkも是正。test更新。
- **3-5 各画面token統一**: Phase 0完了後のパス（`app/admin/courses|videos|questions|exam-results`, `app/(student)/*`, `app/student/*`, `app/admin/qa`）に適用。
- 各タスクの開始/完了/停止条件・testはv2 §3を踏襲。

---

## 4. Phase 2: 基盤後 最初の管理画面 = 管理者ダッシュボード（A案・アラートタイル型）

- **データ方針（厳守）**: 講習/請求/監査はスコープ外。**架空数値・ダミータイルを置かない**。実テーブル集計のみ:
  - User.status別実数 / 未処理EnrollmentApplication / 未回答QARecord /（Q1実装後）書類未確認件数。
- アラート = しきい値超過（未処理>0等）を強調。しきい値は定数化＋根拠コメント。
- 変更/新規・APIレスポンス型・test・条件はv2 §4-1を踏襲（`app/admin/dashboard/page.tsx`, `app/api/admin/dashboard/route.ts`, `services/dashboardService.ts`, `repositories/dashboardRepository.ts`（`$transaction`並列count）, `components/admin/dashboard/AlertTile.tsx`, `app/admin/page.tsx`→`redirect("/admin/dashboard")`, serviceFactory）。完成時にnav追加。
- 続く 4-2受講生一覧 / 4-3詳細タブ / 4-4書類確認(M1) / 4-5入学者管理 / 4-6進捗 / 4-7台帳 / 4-8規約DB化(M2) はv2 §4を踏襲（条件・test含む）。

---

## 5. Phase 3〜5（v2踏襲・要点）
- **5-1 講師管理CRUD（M3）**: `Instructor` 新設。VideoSupervisorへのFKなし。
- **5-2 LMS集計**: 実データのみ・架空表示しない。
- **5-3 DIPS CSV（#16）**: Q3未確定→**今回除外**。`DIPSExportLog` は温存。
- **5-4 操作ログ**: `lib/logger.ts` は **operational logging**（dev=console.error、本番=Sentry等へ転送する抽象）。**法令対応の改ざん防止監査証跡ではない**。永続的tamper-proof監査（追記専用table/ハッシュチェーン/署名）は**今回スコープ外**。新規監査tableは作らない。
- **5-5 帳票**: 既存 `CertificatePDF`/`CertificateLedgerPDF` 再利用。新規CSVなし（DIPS除外）。
- **5-6 テスト**: Service 90%/API認可+正常系/E2Eゴールデンパス。auth.spec.ts セレクタ維持。

---

## 6. Prisma マイグレーション安全手順（訂正版）

> 全マイグレーションはADD ONLYだが、**「無リスク」「安全に戻せる」とは表現しない**。「既存schemaを削除しないが、**適用・回帰・データ損失リスクはある**」。**いずれもユーザーの明示承認後に実行（§8）。**

### 6-0. 共通フロー（環境確認gate追加）

1. **環境確認gate**: `prisma migrate dev --create-only` は**専用local development DB限定**。実行前に `DATABASE_URL` の **host名・database名を（passwordを伏せて）表示**し、人間が対象を確認してから実行。**staging/productionに `migrate dev` を実行しない。**
2. **create-only生成**: `prisma migrate dev --create-only --name <name>`（自動適用しない）。
3. **SQL review**: `migration.sql` を人間レビュー。`DROP`/`NOT NULL追加（既存行あり列）` 等の破壊的操作が無いことを確認。本書M1-M4は `ADD COLUMN ... NULL` / `CREATE TABLE` / `CREATE INDEX` のみであるべき。
4. **backup**: 適用前に `drone_school` を `pg_dump`。
5. **staging適用**: staging相当で `prisma migrate deploy` → アプリ起動 → 関連test → 回帰なし確認。
6. **本番適用**: 承認後 `prisma migrate deploy`。

### 6-1. 適用後の障害対応（forward fix優先）

- **原則 forward fix**: 適用後の不具合は**修正migrationで前進的に直す**。
- `DROP COLUMN`/`DROP TABLE` を含む down SQL は**適用後データを失う**ため、**通常rollbackとして自動実行しない**。
- down SQL は緊急時の候補として用意してよいが、**実行前にデータ損失確認・backup確認・ユーザー再承認を必須**にする。
- `_prisma_migrations` テーブルを直接編集しない。
- `prisma migrate resolve` は**公式手順に該当する失敗migration復旧時のみ**使用。

### 6-2. M2 active一意性の強化（partial unique index 第一候補）

> 訂正: Read Committed下で `updateMany(false)` + `update(true)` の `$transaction` **だけでは同時実行時に「activeは最大1件」を完全保証できない**（v2の記述を修正）。

- **第一候補: PostgreSQL partial unique index** で `isActive = true` を最大1件に制限。
  - Prisma schemaだけでは partial unique（`WHERE isActive`）を表現できないため、**M2のcreate-only migration SQLに手動で追記**する:
    ```sql
    -- 例（index名/table名/column名は生成SQLを確認して確定する）
    CREATE UNIQUE INDEX "agreement_texts_active_unique"
      ON "agreement_texts" ("isActive")
      WHERE "isActive" = true;
    ```
  - index名と実table/column名は**生成された migration.sql を見てから確定**（`@@map("agreement_texts")` 前提だが実列名を確認）。
- 有効化APIは引き続き `$transaction`（全false化→対象true化）で実行するが、**partial unique indexが最終防衛線**。競合時はDBがunique違反を返す。
- **test**:
  - 同時有効化test（2つの有効化を並行 → 片方がunique競合で失敗、最終的にactiveは1件）。
  - unique競合時に利用者へ適切なエラー（例: `409 Conflict` / `AgreementActivationConflictError`）を返すtest。
- **partial unique indexを採用しない場合の代替**（明記）: `Serializable` transaction + 競合時の**有限回retry** + 失敗時エラー、をセットで計画。**「transactionなので原子的に保証」とは書かない。**

### 6-3. M1 / M3（v2踏襲・表現のみ訂正）
- **M1**: `EnrollmentApplication` に `documentCheckedAt DateTime?` / `documentCheckedBy String?`（FKなし表示名スナップショット。index不要。確認者User削除でも文字列は残る）。down候補: `DROP COLUMN ×2`（§6-1の制約下でのみ）。
- **M3**: `Instructor` 新設（VideoSupervisorへのFKなし）。down候補: `DROP TABLE`（§6-1の制約下でのみ）。

### 6-4. M4候補: CourseEnrollment（**今回は導入しない・設計のみ**）

> §D-7の推奨に従い段階導入。**今回MVPでは作らない。** Q5回答後に別フェーズで導入。

```prisma
// 候補設計（確定ではない）
enum CourseEnrollmentStatus {
  ACTIVE
  SUSPENDED
  COMPLETED
  WITHDRAWN
}

model CourseEnrollment {
  id         String   @id @default(cuid())   // 主キー: cuid
  userId     String
  courseId   String
  status     CourseEnrollmentStatus @default(ACTIVE)
  assignedAt DateTime @default(now())          // 割当日時
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)   // user削除で割当も削除
  course Course @relation(fields: [courseId], references: [id], onDelete: Restrict) // 受講者のいるコースの誤削除を防止

  @@unique([userId, courseId])  // 同一コースの重複割当を禁止
  @@map("course_enrollments")
}
```

設計メモ:
- **主キー**: `id`（cuid）。
- **userId/courseId**: 必須。
- **status**: enum（最小ならMVPで `ACTIVE` のみ運用も可）。
- **assignedAt**: 割当日時。
- **unique制約**: `@@unique([userId, courseId])`。
- **index**: 上記composite uniqueが `where userId` の前方一致lookupに使えるため、**`userId` 単独indexは原則不要**（冗長を避ける）。必要が出れば追加。
- **onDelete**: user=Cascade、course=Restrict（マスタ保護）。Cascadeにしない理由はコース誤削除で受講履歴を失わないため。
- **User/Course への追加**: `courseEnrollments CourseEnrollment[]` をUser・Courseに追加（add-onlyのrelationフィールド・非破壊）。
- **既存 `user.courseType`**: **即時削除・変更しない**。進捗計算（必要分数）が依存（§D-2/D-5）。後方互換・段階移行（将来 enrollmentからtypeを導出する案は別途）。
- **backfill**: 既存ユーザーをどのCourseへ割当てるかは**一意決定不可**（同型に複数コースがある場合、本人の実受講コースを既存データから機械的に決められない）→ **推測しない。§11 Q5で確認**。
- **進捗との整合（要考慮）**: 真の複数コース（特に別type混在）は、Subject単位進捗＋courseType依存の必要分数（§D-5）と緊張関係。M4導入時は進捗モデルの扱いを併せて設計する必要があり、これも段階導入を推奨する根拠。
- **migration**: §6-0/6-1の対象（create-only・SQL review・backup・staging・明示承認・forward fix優先）。

### 6-5. DB変更サマリ

| # | 変更 | 方式 | 状態 | 適用後リスク | down候補（再承認必須） |
|---|------|------|------|------|------|
| M1 | EnrollmentApplication に nullable 2列 | ADD COLUMN NULL | 今回 | 適用/回帰リスクあり | DROP COLUMN ×2 |
| M2 | AgreementText 新設 ＋ partial unique index | CREATE TABLE + CREATE UNIQUE INDEX(partial) | 今回 | 同上＋index競合 | DROP TABLE |
| M3 | Instructor 新設 | CREATE TABLE | 今回 | 適用/回帰リスクあり | DROP TABLE |
| M4 | CourseEnrollment 新設（+enum, relation field） | CREATE TABLE | **今回見送り（設計のみ）** | backfill未確定 | DROP TABLE / DROP TYPE |

---

## 7. リスク・注意事項（更新）

| # | リスク | 対策 |
|---|-------|------|
| R1 | ルーティング統一の移設漏れ・dangling link | §1分割（0-B→0-C→0-A）、V1-V10検証、grep+実クリックでdangling 0件 |
| R2 | `/courses` redirectが受講生routeを巻き込む | 完全一致 `source:"/courses"`・`:path*`禁止（§1-4）。V8で検証 |
| R3 | SetupService改修が認証フロー破壊 | フォールバック必須・`setupService.test.ts` 緑維持 |
| R4 | ダッシュボードにスコープ外の架空数値混入 | 実テーブル集計のみ・未実装タイルを作らない |
| R5 | 学生動画APIの認可ギャップ（courseType未検証・§D-4） | 事実を記載。是正可否は §11 Q6（推測で挙動変更しない） |
| R6 | 複数コースschemaの推測確定 | M4は設計のみ・今回見送り。backfillは§11 Q5確認まで実装しない |
| R7 | M2 active一意性の取りこぼし | partial unique index第一候補（§6-2）。「transactionで原子保証」と書かない |
| R8 | migration適用事故 | create-only+環境gate+SQL review+backup+staging+forward fix優先（§6） |
| R9 | font重複/primary改変/E2Eセレクタ破壊 | fontsource再利用・primary不変・role/labelセレクタ維持 |

---

## 8. 実行制御（明示承認が必要な操作）
以下は**ユーザーの明示承認なしに実行しない**: `git commit` / `git push` / PR作成・更新 / staging・production deploy / **本番DBへの `prisma migrate deploy`**。
ローカル作業（コード編集、ローカル `make build`/`test`/`lint`、create-onlyでのSQL生成＝§6-0環境gate下）は計画承認の範囲で進めるが、上記の外部影響操作は都度承認。

---

## 9.（旧§9は解消済み）
v2 §9の要確認2点は本書 §C で回答反映済み（redirect=採用307、学生コース=`/student/courses`新設）。新たな未確認事項は §11。

---

## 10. 依存関係グラフ（v2.1）

```
Q4=A ─► Phase 0（分割・実行順 0-B→0-C→0-A）
        ├ 0-B: /student/courses 新設（Course.type一致・実データ・M4なし）★dangling解消の前提
        ├ 0-C: app/student/page.tsx + StudentLayout の link→/student/courses（文言「コース一覧を見る」）
        └ 0-A: 管理page route移設 + 307 redirect（完全一致）+ (admin)/layout削除 + middleware検証
                                  │  V1-V10検証 / dangling 0件
3-1 token（accent/pageBackground追加・primary不変・fontsource再利用）
  └ 3-2 共通UI
        ├ 3-3 ログイン再設計
        ├ 3-4 学生nav（0-Cで/student/coursesへ）
        └ 3-5 各画面token統一（Phase 0完了前提）
                                  │
[基盤完了] ─► 4-1 管理者ダッシュボード（アラートタイル型・実データのみ）★最初の管理画面
                 ├ 4-2 受講生一覧 ─ 4-3 詳細タブ / 4-6 進捗
                 ├ 4-7 台帳一覧
                 ├ 4-4 書類確認(M1) ─ 4-5 入学者管理     [Q1]
                 ├ 4-8 規約DB化(M2 + partial unique index) [Q2]
                 └ 5-1 講師管理(M3) / 5-2 LMS集計
4-4,4-8,5-1 ─► 5-4 操作ログ(operational logging のみ)
（5-3 DIPS=Q3除外、M4 CourseEnrollment=設計のみ・Q5後に別フェーズ）
全実装 ─► Phase 6 テスト並走
```
**クリティカルパス**: Phase 0(0-B→0-C→0-A) → 3-1 → 3-2 → 4-1 → Phase 2残/3
**最初に着手**: Phase 0-B（`/student/courses`）

---

## 11. 追加確認事項（推測しない。回答後に確定）

1. **(Q5) M4 CourseEnrollment の採用時期とbackfill**: 真の複数コース割当（per-user）はM4が必要（§D-7）。今回は段階導入を推奨（`/student/courses` は型一致で先行実装）。M4を (a)今回含める / (b)後続フェーズ のどちらにするか。また既存ユーザーの各コースへのbackfillは既存データから一意決定できない（同型に複数コースがある場合、本人の実受講コースが不明）。backfill方針（管理者が手動割当 / 別の正データ源 / 暫定で型一致を初期値とする等）を確認したい。**確定するまでM4のschemaは確定しない。**

2. **(Q6) 学生動画APIの認可ギャップ**: `GET /api/student/courses/[courseId]/videos` は `courseType` を検証せず、任意 `courseId` の公開動画一覧を返す（§D-4）。今回 `/student/courses` 導入に合わせて (a)この認可を `Course.type===user.courseType`（将来はenrollment）で是正する / (b)挙動を変えず後続課題にする、のどちらか。**推測で既存挙動を変えない。**

3. **(Q7) 旧URL redirectの保持期間と削除トリガ**: 「1〜2リリース保持・アクセス実績を見て削除」の運用で、削除判断の責任者・確認方法（アクセスログの参照先）を確認したい。

---

## 12. 20画面計画との関係 / スコープ

- 本書 v2.1 は「Phase 1〜3の20画面」全体のうち、**今回実装するMVP subset**。
- スコープ外画面は**削除ではなく後続計画へ延期**。既存の20画面プロンプトは各画面の受入条件資料として保持。
- **実装順・依存関係は本書 v2.1 を正本**とする。
- 管理者ダッシュボードは基盤完了後の最初の管理画面として **A案「アラートタイル型」を維持**。

**今回スコープ外（延期）**: DIPS CSV(#16・Q3) / M4 CourseEnrollment(Q5) / 学生動画認可の厳密化(Q6) / 電子講習記録簿(#8-11) / 四半期実施計画・実施状況報告(#12,13) / 講習カレンダー(#7) / 請求・収受(#17) / 本格監査・改ざん防止監査証跡(#20-22) / 会場・機体・審査員(#25-27) / キャンペーン(#19)。
