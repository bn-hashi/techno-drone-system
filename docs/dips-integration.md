# DIPS 2.0 API 連携 (Phase 4)

最終更新: 2026-07-03

## 概要

DIPS 2.0 (ドローン情報基盤システム) の検証環境 API 6種との連携実装。

> 一次資料: `docs/R08-DRS-0005_高蜂様_検証新規_設定通知.xlsx`
> (検証環境の ClientSecret・パスワードを含むため **.gitignore 済み・コミット禁止**)

## 重要な制約

| 制約 | 内容 |
|---|---|
| **IP 制限** | アクセス元 IP は `57.181.4.59` のみ許可。**ローカル開発機から実 API は叩けない** |
| OIDC リダイレクト | `https://techno-drone-system.com/redirect` で登録済み |
| 申請先 | 許可・承認申請 (検証) は**東京航空局宛のみ** (大阪宛はエラー) |
| データ投入 | 飛行計画情報取得はデータ未投入 — 先に飛行計画通報受付 API で投入が必要 |
| 共用 DB | 検証環境 DB は他事業者と共用。通報データは他者から参照され得る |
| 完了報告 | 検証完了後に当局へ動作確認完了報告。一定期間後クレデンシャルは削除される |

## アーキテクチャ

```text
route.ts (Controller)
  └─ DipsService (services/dipsService.ts) ── ビジネスロジック・所有者チェック委譲
       ├─ AircraftService / FlightPlanService ── 所有者チェック (既存)
       └─ DipsApiClient (lib/dips/dipsApiClient.ts) ── 6 API 呼び出し
            └─ DipsOidcClient (lib/dips/oidcClient.ts) ── グループ別トークン取得・キャッシュ
                 └─ DipsConfig (lib/dips/config.ts) ── 環境変数ローダー
```

- `DIPS_ENABLED !== "true"` の場合、`getDipsService()` は `DipsDisabledError` を投げ、
  API ルートは **503** を返す (ローカル開発のデフォルト状態)
- DIPS 由来のエラー (`DipsAuthError` / `DipsApiError` / `DipsConfigError`) は **502**

## API ルート

| ルート | 内容 |
|---|---|
| `POST /api/flight/aircraft/[id]/verify-registration` | 機体の登録記号を機体情報一覧取得 API と照合 |
| `POST /api/flight/plans/[id]/dips-notify` | 飛行計画を飛行計画通報受付 API へ通報 |

いずれも `requireFlightAccess` (ADMIN/PILOT) + 所有者チェック (非所有者は 404)。

## 環境変数 (本番サーバーの .env に設定)

値は設定通知書 (R08-DRS-0005) から転記する。**リポジトリには絶対に含めない。**

| 変数 | 内容 | 設定通知書の該当箇所 |
|---|---|---|
| `DIPS_ENABLED` | `true` で連携有効 (既定: 無効) | — |
| `DIPS_API_BASE_URL` | DIPS API ベース URL | API 利用ガイドライン参照 |
| `DIPS_TOKEN_URL` | OIDC トークンエンドポイント | API 利用ガイドライン参照 |
| `DIPS_UTM_CLIENT_ID` / `DIPS_UTM_CLIENT_SECRET` | 機体情報一覧取得用 (`utm-app-*`) | Client ID 一覧 |
| `DIPS_REQ_CLIENT_ID` / `DIPS_REQ_CLIENT_SECRET` | 許可・承認系 (`req-app-*`) | Client ID 一覧 |
| `DIPS_FPL_CLIENT_ID` / `DIPS_FPL_CLIENT_SECRET` | 飛行計画系 (`fpl-app-*`) | Client ID 一覧 |
| `DIPS_APPLICANT_ID_PERMISSION_GET` | 許可・承認情報取得の申請者ID (USR063011) | 申請者 ID 一覧 |
| `DIPS_APPLICANT_ID_PERMISSION_APPLY` | 許可・承認申請受付の申請者ID (USR063021) | 〃 |
| `DIPS_APPLICANT_ID_FLIGHT_PLAN_GET` | 飛行計画情報取得の申請者ID (USR063031) | 〃 |
| `DIPS_APPLICANT_ID_FLIGHT_PLAN_NOTIFY` | 飛行計画通報受付の申請者ID (USR063041) | 〃 |

## ⚠️ サーバー検証前に必ず確認すること

以下は設定通知書に記載がなく**暫定実装**のため、「DIPS2.0 API 接続システム向けガイドライン」
の正式仕様と突合して確定させること:

1. **エンドポイントパス** (`lib/dips/endpoints.ts`) — 全パスが暫定値
2. **OIDC グラント種別** (`lib/dips/oidcClient.ts`) — `client_credentials` を仮定
3. **飛行計画通報のペイロード形式** (`lib/dips/types.ts` の `DipsFlightPlanNotificationPayload`)
4. **飛行計画情報取得・飛行禁止エリアのレスポンス型** — 現状 `unknown`

## サーバーでの動作確認手順

1. 本番サーバー (`57.181.4.59`) の `.env` に上記環境変数を設定し、`DIPS_ENABLED=true`
2. 上記「暫定実装」4点をガイドラインと突合・修正
3. 機体情報一覧取得: HTTP 200 + 別紙1「利用可能情報」の18機体が取得できること
4. 別紙2の固定値・別紙3のレスポンスサンプルと突合
5. 飛行計画通報 → 飛行計画情報取得の順で確認 (取得側はデータ未投入のため)
6. 動作確認完了報告を当局へ提出 → 本番環境 API 利用申請 (申請書の緑色セル記入)

## ローカル開発

- `DIPS_ENABLED` 未設定 (無効) のまま。DIPS ルートは 503 を返す
- テストは全て fetch モック (`__tests__/lib/dips/`, `__tests__/services/dipsService.test.ts`)
