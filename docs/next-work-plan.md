# 次の作業計画（2026-06-30 時点）

## 前提：PR #48 マージ待ち（進行中）
CodeRabbitのレビュー待ち。承認され次第マージを実施。

---

## Phase 0-2: 残存 IDOR 脆弱性の修正（最高優先度・セキュリティ）

PR #48 で `viewing-log/route.ts` と `courses/[courseId]/videos/route.ts` は修正済み。残り3エントリーが未対応：

| 対象ファイル | 問題 |
|---|---|
| `app/api/student/videos/[id]/route.ts` | `canAccessCourse` 未接続、コースタイプ違いの受講生がアクセス可能 |
| `app/(student)/courses/[courseId]/page.tsx` | `canAccessCourse` 未接続 |
| `app/(student)/courses/[courseId]/videos/[videoId]/page.tsx` | `canAccessCourse` 未接続 |

---

## Phase 1: 管理機能の穴埋め（高優先度）

| Issue | 内容 | 現状 |
|---|---|---|
| #19 | 不正フラグ管理 UI (`/admin/fraud-flags`) | APIは実装済み、UIページのみなし |
| #18 | 管理ダッシュボード実データ化 | 9行スタブのまま本番稼働 |

---

## Phase 2: 業務機能（中優先度）

| Issue | 内容 | 難度 |
|---|---|---|
| #16 | DIPS CSV 出力 | 高（Service・Repository・UI・CSVユーティリティすべてゼロから） |
| #17 | 監査証跡 CSV（10台帳種別） | 高（台帳の列定義が未受領） |

---

## Phase 3: DB マイグレーション（中優先度・後続機能の基盤）

M1〜M7（`CourseAssignment`・`AgreementText`・`Instructor`等）は、限定解除コース機能に必要。
ただしビジネス要件 Q8〜Q16 が未回答のため設計確定不可。

---

## ブロック中（着手不可）

- **限定解除コース機能全般** — Q8〜Q16（ビジネス側への確認事項）解消が先決
- **本番デプロイ設定（#21）** — 機能完成後

---

## 推奨着手順序

```
PR #48 マージ
    ↓
Phase 0-2: 残存 IDOR 修正（3エントリー）
    ↓
Issue #19: 不正フラグ管理 UI（即実装可能・APIあり）
    ↓
Issue #18: ダッシュボード実データ化
    ↓
Issue #16: DIPS CSV 出力
    ↓
Issue #17: 監査証跡 CSV（台帳仕様確定待ち）
```

---

## 各フェーズの作業手順

各フェーズを実施する際は以下の開発フローに従うこと：

1. `/plan` で詳細実装計画を立て、承認を得る
2. `/tdd` で TDD サイクルを実行
3. `/verify` でビルド・テスト・リント・型を一括チェック
4. `/smart-commit` でコミット
5. PR作成後 CodeRabbit レビューを待つ
6. マージ前に `/code-review` を実行

---

*生成日時: 2026-06-30*
