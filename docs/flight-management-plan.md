# ドローン飛行管理機能 実装計画

> 参考: https://naka4.com/drone/dronbo/ / https://naka4.com/drone/dronbo-use/
> 作成日: 2026-06-27 / 更新日: 2026-07-02

---

## 概要

スクールと関係のない**社内操縦者**および**管理者**が利用する飛行管理機能を追加する。  
受講生（STUDENT）はこの機能を使用しない。

| フェーズ | 機能概念 | 主な画面 |
|---------|---------|---------|
| Phase 0 | PILOT ロール追加 | — (DB + 認証のみ) |
| Phase 1 | 機体管理 | /flight/aircraft |
| Phase 2 | 飛行計画 + リスク情報スタブ | /flight/plans |
| Phase 3 | 飛行日誌 + 点検記録 + PDF出力 | /flight/logs |
| Phase 4 | DIPS 2.0 API 実連携 (検証環境) | — (バックエンド連携) |

---

## 権限設計

| ロール | 説明 | 飛行管理機能 |
|--------|------|------------|
| `ADMIN` | 管理者 | 全操作 + 全ユーザーの日誌閲覧 |
| `PILOT` | 社内操縦者（スクール無関係） | 自分の機体・計画・日誌のみ操作 |
| `STUDENT` | 受講生 | **アクセス不可** |

### 権限ヘルパー

```typescript
// lib/auth/flightPermissions.ts
export const FLIGHT_ROLES = [UserRole.ADMIN, UserRole.PILOT] as const;
export type FlightRole = (typeof FLIGHT_ROLES)[number];

export function hasFlightAccess(role: UserRole): role is FlightRole {
  return (FLIGHT_ROLES as readonly UserRole[]).includes(role);
}
```

API ルートのガード例：

```typescript
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
if (!hasFlightAccess(session.user.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

## DB設計（Prisma スキーマ追加分）

### UserRole enum への追加

```prisma
// 既存 enum に PILOT を追加
enum UserRole {
  ADMIN
  STUDENT
  PILOT   // ← 追加
}
```

> マイグレーション: `npx prisma migrate dev --name add_pilot_role`

### 新規 Enum

```prisma
enum FlightPlanStatus {
  DRAFT
  APPROVED
  REJECTED
  COMPLETED
}

enum InspectionPhase {
  PRE_FLIGHT
  POST_FLIGHT
}

enum InspectionResult {
  PASS
  FAIL
  NA
}
```

### 新規 Model

```prisma
model Aircraft {
  id                 String      @id @default(cuid())
  userId             String
  name               String
  manufacturer       String
  modelNumber        String
  serialNumber       String      @unique
  weightGrams        Int
  maxFlightTimeMin   Int
  registrationNumber String?
  isActive           Boolean     @default(true)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  user               User        @relation(fields: [userId], references: [id])
  flightPlans        FlightPlan[]
  flightLogs         FlightLog[]
}

model FlightPlan {
  id           String           @id @default(cuid())
  userId       String
  aircraftId   String
  title        String
  plannedDate  DateTime
  locationName String
  latitude     Float?
  longitude    Float?
  purposeNote  String?
  status       FlightPlanStatus @default(DRAFT)
  riskNote     String?
  weatherNote  String?          // 天気スタブ情報
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  user         User             @relation(fields: [userId], references: [id])
  aircraft     Aircraft         @relation(fields: [aircraftId], references: [id])
  flightLogs   FlightLog[]
}

model FlightLog {
  id            String      @id @default(cuid())
  userId        String
  aircraftId    String
  flightPlanId  String?
  startedAt     DateTime
  endedAt       DateTime
  durationMin   Int
  locationName  String
  pilotNote     String?
  incidentNote  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  user          User        @relation(fields: [userId], references: [id])
  aircraft      Aircraft    @relation(fields: [aircraftId], references: [id])
  flightPlan    FlightPlan? @relation(fields: [flightPlanId], references: [id])
  inspections   FlightInspection[]
}

model FlightInspection {
  id          String            @id @default(cuid())
  flightLogId String
  phase       InspectionPhase
  itemKey     String            // e.g. "battery", "propeller", "gps"
  result      InspectionResult
  note        String?
  createdAt   DateTime          @default(now())

  flightLog   FlightLog         @relation(fields: [flightLogId], references: [id])
}
```

### User モデルへのリレーション追加

```prisma
// User モデルに追記
aircrafts    Aircraft[]
flightPlans  FlightPlan[]
flightLogs   FlightLog[]
```

---

## Phase 0 — PILOT ロール追加

**目標**: PILOT ロールを UserRole enum に追加し、認証・ロールガードを対応させる。

| # | 対象 | 内容 |
|---|------|------|
| 1 | `prisma/schema.prisma` | `UserRole` に `PILOT` を追加 |
| 2 | マイグレーション | `npx prisma migrate dev --name add_pilot_role` |
| 3 | `types/prisma.ts` | `UserRole.PILOT` エクスポート確認 (Prisma 自動生成から再エクスポート) |
| 4 | `lib/auth/flightPermissions.ts` | `FLIGHT_ROLES`, `hasFlightAccess()` を新規作成 |
| 5 | `app/auth/role-redirect/route.ts` | PILOT ロール時のリダイレクト先 `/flight/aircraft` を追加 |

---

## Phase 1 — 機体管理

**目標**: 社内操縦者・管理者が自分の機体を登録・編集・一覧表示できる。

### 実装ステップ

| # | 対象 | 内容 |
|---|------|------|
| 1 | `prisma/schema.prisma` | Aircraft モデル + 関連 enum 追加。マイグレーション |
| 2 | `types/prisma.ts` | Aircraft 関連型をエクスポート |
| 3 | `services/errors.ts` | `AircraftNotFoundError`, `AircraftDuplicateSerialError` 追加 |
| 4 | `repositories/aircraftRepository.ts` | `IAircraftRepository` + `AircraftRepository` |
| 5 | `services/aircraftService.ts` | TDD: `list`, `findById`, `create`, `update`, `deactivate` |
| 6 | `lib/serviceFactory.ts` | `getAircraftService()` 追加 |
| 7 | `app/api/flight/aircraft/route.ts` | `GET` (一覧), `POST` (新規登録) — `hasFlightAccess` でガード |
| 8 | `app/api/flight/aircraft/[id]/route.ts` | `GET`, `PUT`, `DELETE` (論理削除) |
| 9 | `lib/api/aircraft.ts` | クライアント側 fetch ラッパー |
| 10 | UI ページ | `/flight/aircraft` (一覧), `/flight/aircraft/new`, `/flight/aircraft/[id]`, `/flight/aircraft/[id]/edit` |
| 11 | ナビゲーション | `(flight)` レイアウトのサイドバーに「機体管理」リンク追加 |

### 点検チェック項目 (Phase 3 先行定義)

```typescript
// lib/constants/inspectionItems.ts
export const INSPECTION_ITEMS = [
  { key: "battery", label: "バッテリー残量・外観" },
  { key: "propeller", label: "プロペラ取付・損傷" },
  { key: "gps", label: "GPS 受信確認" },
  { key: "motor", label: "モーター異音確認" },
  { key: "camera", label: "カメラ・ジンバル動作" },
  { key: "controller", label: "送信機電源・通信確認" },
] as const;
```

---

## Phase 2 — 飛行計画 + リスク情報スタブ

**目標**: 社内操縦者・管理者が飛行計画を事前に作成し、リスク情報（天気・障害物）をモック表示できる。

### 実装ステップ

| # | 対象 | 内容 |
|---|------|------|
| 1 | `prisma/schema.prisma` | FlightPlan モデル追加。マイグレーション |
| 2 | `lib/utils/fallDistance.ts` | `calcFallDistance(weightGrams, heightMeters): number` |
| 3 | `lib/stubs/weatherStub.ts` | 天気・ハザード情報モック (`WeatherInfo`, `HazardInfo` 型定義込み) |
| 4 | `repositories/flightPlanRepository.ts` | CRUD + ステータス変更 |
| 5 | `services/flightPlanService.ts` | TDD: `list`, `findById`, `create`, `updateStatus` |
| 6 | `lib/serviceFactory.ts` | `getFlightPlanService()` 追加 |
| 7 | `app/api/flight/plans/route.ts` | `GET`, `POST` |
| 8 | `app/api/flight/plans/[id]/route.ts` | `GET`, `PUT`, `PATCH` (ステータス変更) |
| 9 | `app/api/flight/plans/[id]/risk/route.ts` | `GET` — 天気・墜落リスクスタブ返却 |
| 10 | UI ページ | `/flight/plans` (一覧), `/flight/plans/new`, `/flight/plans/[id]` (詳細+リスクパネル) |

### リスクスタブ レスポンス例

```json
{
  "weather": { "condition": "晴れ", "windSpeedMs": 3.2, "temperatureCelsius": 22 },
  "hazard": { "fallDistanceM": 15.2, "nearAirport": false, "notamNote": "制限なし (モック)" }
}
```

---

## Phase 3 — 飛行日誌 + 点検記録 + PDF 出力

**目標**: 飛行実施後に日誌と点検記録を記録し、国交省様式1 PDF をダウンロードできる。

### 実装ステップ

| # | 対象 | 内容 |
|---|------|------|
| 1 | `prisma/schema.prisma` | FlightLog + FlightInspection + 残 enum 追加。マイグレーション |
| 2 | `lib/utils/flightDuration.ts` | `calcDurationMin(start: Date, end: Date): number` |
| 3 | `lib/zod/inspectionSchema.ts` | Zod スキーマ: 点検チェックリスト入力バリデーション |
| 4 | `repositories/flightLogRepository.ts` | FlightLog + FlightInspection CRUD |
| 5 | `services/flightLogService.ts` | TDD: `list`, `findById`, `create` (日誌+点検一括)、ADMIN は全件取得可 |
| 6 | `lib/serviceFactory.ts` | `getFlightLogService()` 追加 |
| 7 | `app/api/flight/logs/route.ts` | `GET`, `POST` |
| 8 | `app/api/flight/logs/[id]/route.ts` | `GET` |
| 9 | `components/pdf/FlightLogPdf.tsx` | `@react-pdf/renderer` + NotoSansJP: 様式1レイアウト |
| 10 | `lib/pdf/generateFlightLogPdf.ts` | PDF バイナリ生成関数 (`runtime="nodejs"`) |
| 11 | `app/api/flight/logs/[id]/pdf/route.ts` | `GET` — PDF ストリーム返却 |
| 12 | UI ページ | `/flight/logs` (一覧), `/flight/logs/new`, `/flight/logs/[id]` (詳細+PDF DLボタン) |
| 13 | 管理画面 | `/admin/flight-logs` — ADMIN のみ。全操縦者の日誌一覧 |

### PDF 様式1 フィールド定義

```text
- 飛行年月日
- 操縦者氏名
- 機体名称・登録番号
- 飛行場所
- 飛行目的
- 飛行時間 (分)
- 飛行前点検結果
- 飛行後点検結果
- 特記事項
```

---

## Phase 4 — DIPS 2.0 API 実連携 (検証環境)

**目標**: 検証環境で承認済みの DIPS 2.0 API 6種と実連携し、動作確認完了報告まで行う。

> 一次資料: `docs/R08-DRS-0005_高蜂様_検証新規_設定通知.xlsx`
> （検証環境の ClientSecret・パスワードを含むため **.gitignore 済み・コミット禁止**。
> クレデンシャルは `.env` で管理し、リポジトリには一切含めない）

### 承認済み API と払い出し情報 (R08-DRS-0005)

| API | Client ID グループ | 申請者ID |
|---|---|---|
| 機体情報一覧取得 | `utm-app-*` | 別紙1の検証用4アカウント |
| 許可・承認情報取得 | `req-app-*` (共通) | USR063011 |
| 許可・承認申請受付 | 〃 | USR063021 |
| 飛行計画情報取得 | `fpl-app-*` (共通) | USR063031 |
| 飛行禁止エリア情報取得 | 〃 | USR063031 |
| 飛行計画通報受付 | 〃 | USR063041 |

### 制約事項 (設定通知書より)

1. **IP 制限**: アクセス元 IP は `57.181.4.59` のみ許可。**ローカル Mac から検証 API は叩けない**
   → 実行は本番サーバー経由。ローカル開発は既存スタブ (`lib/stubs/weatherStub.ts` 等) で継続
2. **OIDC 認証**: リダイレクト URL は `https://techno-drone-system.com/redirect` で登録済み
3. **動作確認完了報告の義務**: 検証完了後に当局へ報告。一定期間経過後クレデンシャルは削除される
4. **許可・承認申請 (検証) は東京航空局宛のみ** (大阪宛はエラー)
5. **飛行計画情報取得はデータ未投入** — 先に飛行計画通報受付 API でデータ投入が必要
6. **検証環境 DB は他事業者と共用** — 通報データは他事業者から参照され得る

### 実装ステップ (概要)

| # | 対象 | 内容 |
|---|------|------|
| 1 | `.env` | API グループ別 Client ID/Secret・申請者 ID を環境変数化 (設定通知書から転記) |
| 2 | `lib/dips/client.ts` | OIDC 認証 + API グループ別クライアント。`lib/dips/types.ts` (Phase 3 で整備済み) を使用 |
| 3 | `lib/dips/` 各 API | 6 API のリクエスト/レスポンス実装。ガイドラインと `types.ts` の突合・修正 |
| 4 | 機体連携 | 機体情報一覧取得 API で登録記号を検証し `Aircraft.registrationNumber` と照合 |
| 5 | 飛行計画連携 | FlightPlan → 飛行計画通報受付 API (通報)、飛行禁止エリア情報取得 API で `getRiskStub` を実データ化 |
| 6 | 検証 | 別紙1の18機体・別紙2の固定値・別紙3のレスポンスサンプルを受け入れ条件として動作確認 |
| 7 | 報告 | 動作確認完了報告 → 本番環境 API 利用申請 (申請書の緑色セル記入) |

---

## アーキテクチャ上の注意点

1. **外部 API は一切叩かない** — 天気・DIPS・地図はすべてスタブ実装。本番移行時に差し替えやすい interface を定義する。
2. **PDF は `runtime="nodejs"`** — メモリ 1GB 制限のためサーバーコンポーネント内で生成し、クライアントにはバイナリを返す。Puppeteer は使用しない。
3. **レイヤードアーキテクチャ厳守** — Controller は route.ts のみ。Service がビジネスロジック。Repository が DB アクセス。
4. **TDD 必須** — 各 Service は Red→Green→Refactor サイクルで実装し、カバレッジ 90% 以上を維持する。
5. **STUDENT は飛行管理機能へアクセス不可** — `hasFlightAccess()` を全 API ルートに適用する。UI は `(flight)` レイアウトグループで分離し、STUDENT のレイアウト (`(student)/`) とは完全に独立させる。

---

## ファイル構成（追加分）

```text
prisma/
  schema.prisma                         # 既存に追記
  migrations/
    [date]_add_pilot_role/
    [date]_add_aircraft/
    [date]_add_flight_plan/
    [date]_add_flight_log/

types/
  prisma.ts                             # PILOT ロール + 各モデル型追加

lib/
  auth/
    flightPermissions.ts                # hasFlightAccess(), FLIGHT_ROLES
  api/
    aircraft.ts
    flightPlan.ts
    flightLog.ts
  utils/
    fallDistance.ts
    flightDuration.ts
  zod/
    inspectionSchema.ts
  stubs/
    weatherStub.ts
  constants/
    inspectionItems.ts
  pdf/
    generateFlightLogPdf.ts
  serviceFactory.ts                     # 既存に追記

repositories/
  aircraftRepository.ts
  flightPlanRepository.ts
  flightLogRepository.ts

services/
  aircraftService.ts
  flightPlanService.ts
  flightLogService.ts

components/
  pdf/
    FlightLogPdf.tsx

app/
  (flight)/                             # ADMIN + PILOT 専用レイアウトグループ
    layout.tsx                          # hasFlightAccess() でガード
    aircraft/
      page.tsx
      new/page.tsx
      [id]/page.tsx
      [id]/edit/page.tsx
    flight-plans/
      page.tsx
      new/page.tsx
      [id]/page.tsx
    flight-logs/
      page.tsx
      new/page.tsx
      [id]/page.tsx
  admin/
    flight-logs/
      page.tsx                          # ADMIN のみ: 全操縦者の日誌一覧
  api/
    flight/
      aircraft/
        route.ts
        [id]/route.ts
      plans/
        route.ts
        [id]/route.ts
        [id]/risk/route.ts
      logs/
        route.ts
        [id]/route.ts
        [id]/pdf/route.ts

__tests__/
  services/
    aircraftService.test.ts
    flightPlanService.test.ts
    flightLogService.test.ts
  app/api/flight/
    aircraft/route.test.ts
    plans/route.test.ts
    logs/route.test.ts
  lib/
    auth/flightPermissions.test.ts
    utils/fallDistance.test.ts
    utils/flightDuration.test.ts
```

---

## 実装順序と依存関係

```text
Phase 0: PILOT ロール
  schema (UserRole) → migration → flightPermissions.ts → role-redirect

Phase 1: Aircraft (Phase 0 が前提)
  schema → types → exceptions → repository → service (TDD) → serviceFactory
  → API routes → lib/api → (flight) layout → UI pages → navigation

Phase 2: FlightPlan (Phase 1 が前提)
  schema → stubs → repository → service (TDD) → serviceFactory
  → API routes (risk 含む) → lib/api → UI pages

Phase 3: FlightLog + PDF (Phase 1 + 2 が前提)
  schema → zod → utils → repository → service (TDD) → serviceFactory
  → API routes (pdf 含む) → PDF component → lib/api → UI pages → admin page
```

---

## 承認後のアクション

- [ ] ユーザー承認
- [ ] `feature/flight-management` ブランチを `dev` から作成
- [ ] Phase 0 実装開始（PILOT ロール追加）
- [ ] Phase 1 実装開始 (`/tdd` で TDD サイクル実行)
