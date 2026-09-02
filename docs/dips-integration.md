# DIPS 2.0 API 連携 (Phase 4)

最終更新: 2026-08-28 (許可・承認情報取得API [5-2] の2回目の差し戻し対応: `permissions`
キー欠落と正当なゼロ件の区別・オフライン時挙動・OAuth 復帰時のエラー表示等)

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
- `DipsConfigError` (自システムの環境変数不足。DIPS 側の障害ではない) は **503** を返す
- DIPS 側のエラー (`DipsAuthError` / `DipsApiError`) は **502** を返す
- 2026-09-02 差し戻し (H2) までは本項に「`DipsAuthError` / `DipsApiError` /
  `DipsConfigError` は502」と誤って一括で記載していた。実装 (`lib/dips/handleRouteError.ts`)
  は当初から `DipsConfigError` を503・`DipsAuthError`/`DipsApiError` を502と区別しており
  (docs/production-operations-runbook.md の切り分け表 1-8/1-9 と一致)、本項の記載が古かった。
  なお H2 で `app/api/flight/plans/[id]/dips-notify/route.ts` (飛行計画通報) も同じ共通
  ハンドラへ移行し、この区別を全 DIPS 連携ルートで統一した (移行前はこのルートだけ
  `DipsConfigError` を502で返しており、本項の誤記載と実際に一致してしまっていた)

## API ルート

| ルート | 内容 |
|---|---|
| `POST /api/flight/plans/[id]/dips-notify` | 飛行計画を飛行計画通報受付 API へ通報 |
| `GET /api/dips/aircrafts` | DIPS ログイン済みアカウントの所有機体一覧を取得 (機体情報一覧取得 API)。クエリ `includeInvalid=true` で抹消済み・期限切れも含める |
| `GET /api/dips/permissions` | DIPS ログイン済みアカウントの許可・承認情報一覧を取得 (許可・承認情報取得 API, realm `req`)。UI は `/flight/dips-permissions` (ナビ未リンク。直接 URL でアクセス) |

`requireFlightAccess` (ADMIN/PILOT)。`GET /api/dips/aircrafts` は所有者チェックの概念がなく、
DIPS へログインしたアカウント自身が所有する機体のみが返る (DIPS 側の仕様上の制約)。
`GET /api/dips/permissions` も同様にアカウント単位で、特定の機体・飛行計画への紐付けはない。

> **2026-08-18 追記**: 許可・承認情報取得 API (5-2) を実装した (上表参照)。正規化方針・
> 寛容パース (boolean の "1"/"0" 文字列受理、null 許容の範囲等) の詳細は
> `lib/dips/permissionsSchema.ts` のファイル先頭コメントを参照。5-3 (許可・承認申請受付) /
> 5-4 (飛行計画情報取得) / 5-5 (飛行禁止エリア情報取得) は未実装のまま
> (`lib/dips/endpoints.ts` に URL・realm の定義のみ存在)。
>
> **2026-08-26 差し戻し**: 実機検証 (Playwright) で疎通確認 UI の不具合4件
> (再マウント後の1回目クリックで fetch されない・意図しない自動再取得・不正な200が
> 「0件」に化ける・失敗後も古いデータが残る) が判明し対応した。詳細は
> `app/(flight)/flight/dips-permissions/DipsPermissionsPanel.tsx` と
> `lib/api/dips.ts` の `fetchDipsPermissions()` のコメントを参照。

> **訂正 (2026-07-28)**: 以前ここに記載していた `POST /api/flight/aircraft/[id]/verify-registration`
> (機体の登録記号を機体情報一覧取得 API と照合するルート) は、Authorization Code Flow への
> リアーキテクチャ (#57) 時に削除されており、当時は存在しなかった。削除の理由は「機体情報一覧取得 API の
> ガイドラインが非公開」という誤った前提だった。実際は DRS API 接続システム向けガイドライン 1.1版
> (2022-12-05) §2.3.6 で公開されている
> (https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf)。
>
> **2026-08-10 追記**: 機体情報一覧取得 API を realm `utm` として実装した (上表参照)。ただし
> UI 導線は当時検討していた「登録記号の自動照合」とは形が異なる: (a) 機体フォームの
> 「DIPSから取り込む」ボタン + 選択モーダルでフォームへ自動入力、(b) 機体詳細ページの
> 「DIPSと照合」ボタンで都度ステータス・有効期限を表示 (DB には保存しない)。実装の詳細・
> JSON キー名の対応表は `docs/dips-drs-aircraft-list-api.md` を参照。

## 環境変数 (本番サーバーの .env に設定)

値は設定通知書 (R08-DRS-0005) から転記する。**リポジトリには絶対に含めない。**

| 変数 | 内容 | 設定通知書の該当箇所 |
|---|---|---|
| `DIPS_ENABLED` | `true` で連携有効 (既定: 無効) | — |
| `DIPS_API_BASE_URL` | DIPS API ベース URL | API 利用ガイドライン参照 |
| `DIPS_TOKEN_URL` | OIDC トークンエンドポイント | API 利用ガイドライン参照 |
| `DIPS_UTM_CLIENT_ID` / `DIPS_UTM_CLIENT_SECRET` | 機体情報一覧取得用 (`utm-app-*`)。**任意** (utm 機能を使うときのみ必須。未設定でも fpl/req は影響なし) | Client ID 一覧 (シート1 J51/J52) |
| `DIPS_DRS_AUTH_BASE_URL` | realm `drs-utm` の認証 (Keycloak) ベース URL。fpl/req とドメインが異なる。検証: `https://www.dips-regdev.mlit.go.jp` | ガイドライン §3.1 |
| `DIPS_DRS_API_BASE_URL` | 機体情報一覧取得 API のベース URL。検証: `https://www.dips-regdev.mlit.go.jp` | ガイドライン §2.3.6 |
| `DIPS_REQ_CLIENT_ID` / `DIPS_REQ_CLIENT_SECRET` | 許可・承認系 (`req-app-*`) | Client ID 一覧 |
| `DIPS_FPL_CLIENT_ID` / `DIPS_FPL_CLIENT_SECRET` | 飛行計画系 (`fpl-app-*`) | Client ID 一覧 |
| `DIPS_APPLICANT_ID_PERMISSION_GET` | 許可・承認情報取得の申請者ID (R08-DRS-0005 参照) | 申請者 ID 一覧 |
| `DIPS_APPLICANT_ID_PERMISSION_APPLY` | 許可・承認申請受付の申請者ID (R08-DRS-0005 参照) | 〃 |
| `DIPS_APPLICANT_ID_FLIGHT_PLAN_GET` | 飛行計画情報取得の申請者ID (R08-DRS-0005 参照) | 〃 |
| `DIPS_APPLICANT_ID_FLIGHT_PLAN_NOTIFY` | 飛行計画通報受付の申請者ID (R08-DRS-0005 参照) | 〃 |

## ⚠️ サーバー検証前に必ず確認すること

以下は設定通知書に記載がなく**暫定実装**のため、「DIPS2.0 API 接続システム向けガイドライン」
の正式仕様と突合して確定させること:

1. **エンドポイントパス** (`lib/dips/endpoints.ts`) — 全パスが暫定値
2. **飛行計画通報のペイロード形式** (`lib/dips/types.ts` の `DipsFlightPlanNotificationPayload`)
3. **飛行計画情報取得・飛行禁止エリアのレスポンス型** — 現状 `unknown`

> **訂正 (2026-07-28)**: 以前ここにあった「OIDC グラント種別 (`lib/dips/oidcClient.ts`) —
> `client_credentials` を仮定」は誤りだったため上記リストから除外した。3本の公開ガイドライン
> (DRS 1.1版 §1.4、DIPS2.0 API(FPA) v1.4 §1.4、DIPS2.0 API(FPR) v1.9 §1.4) はすべて
> **Authorization Code Flow** (利用者本人が DIPS のログイン画面で ID/パスワードを入力する方式)。
> `lib/dips/oidcClient.ts` / `app/api/dips/auth/start/route.ts` / `app/redirect/route.ts` は
> 既にこの方式で実装済み (詳細: `docs/dips-rearchitecture-plan.md`)。解決済みのため要確認事項から除外した。

## サーバーでの動作確認手順

1. 本番サーバー (`57.181.4.59`) の `.env` に上記環境変数を設定し、`DIPS_ENABLED=true`
2. 上記「暫定実装」3点をガイドラインと突合・修正
3. 別紙2の固定値・別紙3のレスポンスサンプルと突合
4. 飛行計画通報 → 飛行計画情報取得の順で確認 (取得側はデータ未投入のため)
5. 動作確認完了報告を当局へ提出 → 本番環境 API 利用申請 (申請書の緑色セル記入)

> **訂正 (2026-07-28 時点)**: 「機体情報一覧取得: HTTP 200 + 別紙1「利用可能情報」の18機体が取得できること」
> という確認手順は、当時は機体情報一覧取得 API が未実装 (`lib/dips/endpoints.ts` に定義なし) だった
> ため削除していた。
>
> **2026-08-10 追記**: 機体情報一覧取得 API を実装した。詳細な疎通確認手順は
> `docs/production-operations-runbook.md` の「1-8. 機体情報一覧取得の疎通確認」に追加した。

## ローカル開発

- `DIPS_ENABLED` 未設定 (無効) のまま。DIPS ルートは 503 を返す
- テストは全て fetch モック (`__tests__/lib/dips/`, `__tests__/services/dipsService.test.ts`)
