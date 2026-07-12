# Phase 0-1 追加検証 完了報告（Codex レビュー用）

> 本書は Claude Code が作成した Phase 0-1 追加検証の完了報告です。
> Codex は `docs/claude-code-complete-handoff.md` の §C「Codex側の今後のレビュー観点」に従い、
> 本書と実 git 状態（コミット `2aeb0f9`、親 `bd8f9b6`）の両方を参照してレビューしてください。

## 整合事項（ユーザー承認済み・重要）

- 本コミット `2aeb0f9` は、資料が想定する「実装3ファイルのみ」ではなく、
  **実装3 ＋ docs10 ＋ pr-description1 ＝ 計14ファイルを束ねたもの**。
- コミットは取り消さず**維持する**方針（ユーザー判断）。Codex はこの前提でレビューすること。

## 1. git status / stash

- `git status --short`: 未追跡は `docs/claude-code-complete-handoff.md` と本報告ファイルのみ。作業ツリーはクリーン。
- `git stash list`: `stash@{0}: WIP on dev: edf952f chore: ハーネス一式を初期セットアップ`。
  - apply/pop/drop は未実施。新規 stash も未作成。既存ユーザー変更は `2aeb0f9` に取り込み済みで喪失なし。

## 2. Phase 0-1 の変更ファイル（コミット 2aeb0f9・14ファイル）

| 区分 | ファイル | 役割 |
|---|---|---|
| 実装本体 | `services/courseAccessService.ts` | `canAccessCourse` 実装 |
| 実装本体 | `__tests__/services/courseAccessService.test.ts` | unit test 13件 |
| 実装本体 | `lib/serviceFactory.ts` | `getCourseAccessService()` 追加 |
| 付随 | `.claude/commands/pr-description.md` | ベースブランチ判定改善 |
| docs(10) | `docs/01〜05_*`, `docs/requirements/...` | MVP計画v1〜v2.3・要件・調査資料 |

## 3. git diff --check

- 作業ツリー: エラーなし。
- コミット差分 `bd8f9b6..2aeb0f9`: 行末空白の指摘は**全て docs の markdown**（Markdown 改行記法の意図的ダブルスペース）。
  **実装3ファイルには空白エラーなし**。

実装3ファイル diff の自己点検（資料 §C-3 の懸念項目）:
- 大規模 refactor / debug 出力 / 型逃げ `any`: いずれもなし
- 認可条件の重複・不整合: なし（early return で一方向）
- repository 例外の握り潰し: なし（伝播。testで検証済み）
- User/Course 存在情報の漏洩: なし（不存在は一律 `false`）
- `Course.type` nullable 化時の `null === null` 誤認可: 防御済み（`if (!courseType) return false`）

## 4. canAccessCourse 判定順序（実装）

1. User 存在チェック（なければ false、courseRepo 未呼出）
2. `role === STUDENT`
3. `status === ACTIVE`
4. `user.courseType != null`
5. Course 存在チェック（なければ false）
6. `course.type != null`（M4 で nullable 化予定の防御）
7. `course.type === user.courseType`

## 5. 検証コマンド結果

| # | コマンド | exit | 結果 |
|---|---|---|---|
| 1 | `npx vitest run __tests__/services/courseAccessService.test.ts` | 0 | 13 passed / 13 |
| 2 | `npx tsc --noEmit` | 0 | エラー 0 |
| 3 | `npx next lint` | 0 | warning/error 0 |
| 4 | `npx vitest run`（full） | 1 | 1298 passed / 1299（123ファイル中122パス）。失敗は `AdminLayout.test.tsx` 1件のみ |

## 6. AdminLayout 既存失敗の詳細

- test名: `AdminLayout > test_AdminLayout_on_render_navigation_link_student_list_is_displayed`
- 期待値: `getByText("受講者一覧")` が存在
- 実際値: 該当なし（実体ラベルは `AdminLayout.tsx:8` で **「受講者管理」**）
- 原因: ナビラベルのリネーム漏れ（テスト未更新）
- Phase 0-1 の3ファイルとの依存: **なし**（`2aeb0f9` は AdminLayout に未接触）
- 既存失敗の根拠（git log のみ。stash/checkout/reset 不使用）:
  - `AdminLayout.tsx` 最終変更 = `247269d`（2026-06-12「管理者UIナビ改善」）でラベル変更
  - `AdminLayout.test.tsx` 最終変更 = `f2d78eb`（2026-06-09）で旧ラベルのまま
  - → Phase 0-1（本日）より前に発生した stale test
- Phase 0-5 対応: 実装計画 v2.3 §E の 0-5 行 test 列に `AdminLayout.test.tsx` 記載。ナビ/route 整理で是正予定

## 7. Phase 0-2 対象入口の4分類（実コード精査）

### 分類1: Course/Video ID を受け取り `canAccessCourse` が必要

| file | method/page | 呼出 service | 現認可 | Phase 0-2 扱い案 |
|---|---|---|---|---|
| `app/(student)/courses/[courseId]/page.tsx` | page | `getProgressService().getVideosWithLockStatus` | role/status のみ（type未検証） | `canAccessCourse(userId, courseId)` → false は `notFound()` |
| `app/api/student/courses/[courseId]/videos/route.ts` | GET | 同上 | role/status のみ | 同上、false は 404 |
| `app/api/student/videos/[id]/route.ts` | GET | `getVideoService().getVideo` | role/status＋`canWatch`（type未検証） | video取得後 `canAccessCourse(userId, video.courseId)` |
| `app/(student)/courses/[courseId]/videos/[videoId]/page.tsx` | page | `getVideoService().getVideo` | role/status＋`courseId`一致（type未検証） | `canAccessCourse(userId, courseId)` |
| `app/api/student/viewing-log/route.ts` | POST | `getViewingLogService().recordSession` | role/status のみ（任意 videoId 書込＝IDOR） | video解決後 `canAccessCourse(userId, video.courseId)` |

### 分類2: 自分の User ID のみ・ownership 検証済み（変更不要）

- `app/api/student/exams/[id]/route.ts`(GET) `getExam(id, userId)` / `submit`(`submitExam(userId, id,…)`) / `result`(`getExam(id, userId)`)
- `app/api/student/exams/eligibility/route.ts`・`exams/route.ts`（`session.user.id`＋`courseType` で self-scope）
- `app/api/student/progress/route.ts`（`user.courseType` 派生で self-scope）
- `app/api/student/qa/route.ts`・`certificate/download/route.ts`（`session.user.id` で self-scope）

### 分類3: Course scope だが将来 M5/M6 対象、今は一般化しない

- exam系・progress の「基礎 vs 限定解除」分離。現状 `User.courseType`（単一）派生で `courseId` を受け取らないため、Phase 0-2 で `canAccessCourse` 接続対象外。M5（進捗/試験分離）・M6（修了/証明書分離）で再設計。

### 分類4: Course 非依存（変更不要）

- `app/api/student/fraud-flag/route.ts`(POST): 資料 §7 は videoId 経由 IDOR 候補に挙げるが、
  **実コードは `type`＋`durationSeconds` のみ受け取り `session.user.id` に記録。videoId/courseId を一切受け取らない**。
  よって分類1ではなく分類4。Phase 0-2 で無理に接続しない。

## 8. policy を置く推奨境界

- **推奨: 各入口（page/route = controller 境界）で `getCourseAccessService().canAccessCourse()` を呼ぶ**。
  `getVideosWithLockStatus` は page と API が共有するため service 内 guard で双方を守れるが、
  データ取得 service に認可責務が混ざり層分離（レイヤード規約）に反する。policy ロジックは
  `canAccessCourse` に一本化済みのため、呼出を各境界に置いてもロジック重複は発生しない。
- **videoId 入口（videos/[id]・viewing-log）は route 側 guard 必須**: videoId→courseId 解決
  （`getVideo` で `video.courseId` 取得）が必要なため service 共有では守れない。
- **循環依存**: `CourseAccessService` は `UserRepository`＋`CourseRepository` のみ依存。
  Progress/Video service へ依存しないため、route 注入でも service 注入でも循環なし。
- **404変換の既存 pattern**: page=`notFound()`、API=`NextResponse.json({error},{status:404})`。
  資料 Q12（別CourseType・未割当・不存在は秘匿404）に従い、`canAccessCourse=false` は
  403 ではなく **404** へ変換し存在秘匿するのが既存方針と整合。

## 9. 検証中の追加修正

なし。全コマンド green（full test の AdminLayout は文書化済み既存失敗）のため、実装3ファイルへの修正は不要だった。

## 10. Phase 0-2 へ進めるか（Claude Code の自己評価）

- 技術面は green。full test の唯一の失敗は Phase 0-1 無関係の既存 stale test と確定。
- 資料の運用ルールに従い、Phase 0-2 実装には未着手。Codex の §C レビュー後に Phase 0-2 計画へ進む。
- Codex への判断依頼: ①14ファイル束ねの維持可否 ②policy 配置の最終決定（controller 境界 vs service）③404 秘匿の適用範囲。

## 11. 未実施操作の確認

- 本検証中: commit / push / PR / deploy / DB操作 / schema変更 / migration / package追加 / 限定解除実装 / routing移設 / design変更 / 既存ユーザー変更revert / 新規stash / stash操作 / checkout / reset は**すべて未実施**。
- 開示（資料受領前の操作）: ① Phase 0-1 を `2aeb0f9` として既にコミット（整合方針で維持）② `feature/claude-design-integration` へ checkout し dev を fast-forward マージ済み（現作業ブランチ＝計画書記載のブランチ）。
