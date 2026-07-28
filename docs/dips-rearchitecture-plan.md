# DIPS連携リアーキテクチャ計画 (承認済み)

作成日: 2026-07-03
最終更新: 2026-07-28 (機体情報一覧取得APIガイドラインに関する誤記を訂正)
ステータス: **ユーザー承認済み** — 実装中 (feature/dips-auth-code-flow)

## 承認済みの決定事項

| # | 論点 | 決定 |
|---|---|---|
| Q1 | 通報時にFlightPlanにない必須項目の入力方法 | **(a) 通報ボタン押下時のダイアログで都度入力** |
| Q2 | DIPSトークンの保存方式 | **暗号化してDB保存** (AES-256-GCM、鍵は環境変数) |
| Q3 | `dipsReceptionNumber` カラム | **`dipsFlightPlanId` にリネーム** |

## 背景

ガイドライン突合 (2026-07-03) により、Phase 4 で実装した `lib/dips` の前提が誤りと判明:

1. 認証は `client_credentials` ではなく **Authorization Code Flow** (利用者がDIPSログイン画面でID/PW入力)
2. エンドポイントのホスト・パスが全て相違
3. 通報ペイロードは `flightPlanInfo` 詳細フォーム形式、レスポンスは受付番号ではなく `flightPlanId`

### 一次資料 (公開PDF、再取得可能)

- FPR (飛行計画通報) ガイドライン v1.9 (2026-03-23):
  https://www.ossportal.dips.mlit.go.jp/guide/fiss/DIPS2.0_API%EF%BC%88FPR%EF%BC%89_Guideline.pdf
- FPA (飛行許可・承認申請) ガイドライン v1.4 (2026-06-22):
  https://www.ossportal.dips.mlit.go.jp/guide/dips/DIPS2.0_API（FPA）_Guideline_v1.4.pdf
- DRS (機体情報一覧取得) ガイドライン 1.1版 (2022-12-05、国土交通省航空局安全部無人航空機安全課):
  https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf
  （§2.3.6 機体情報一覧取得API。ログイン不要でダウンロード可能）
- テキスト抽出方法: `/opt/homebrew/bin/python3.11` + `pypdf` (`PdfReader(...).pages[i].extract_text()`)

**訂正 (2026-07-28)**: 「機体情報一覧取得API (utm-app系) のガイドラインは非公開」としていた従来の記述は誤り。
上記 DRS ガイドライン §2.3.6 に仕様が完全公開されている。R08-DRS-0005 設定通知書でも 5-1「機体情報一覧取得API」が
「〇」(申請・承認済み) で、`utm-app-*` の Client ID/Secret も払い出し済み (値は `.gitignore` 対象の設定通知書のみに
記載し、本ドキュメントには書かない)。**「仕様が入手できない」のではなく「単に未実装」**な状態であり、下記
「機体情報一覧取得 API (未実装・参考仕様)」および「未対応 (別フェーズ)」を参照。
なお DRS API は参照系 (GET) のみで、機体の新規登録・変更・抹消はこの API では行えない (DIPS 画面での人手操作が必要)。

## 確定仕様 (ガイドラインから抽出)

### 認証 (OIDC Authorization Code Flow)

- realm: 飛行計画系 = `drs-fpl` / 許可承認系 = `drs-req` (系統別にトークンが必要)
- 認可エンドポイント (検証): `https://www.stg.uafp.dips.mlit.go.jp/auth/realms/{realm}/protocol/openid-connect/auth`
  - GET。パラメータ: `response_type=code` (固定) / `client_id` / `redirect_uri` / `scope=openid offline_access` (固定) / `state` (CSRF対策) / `ui_locales=ja` (任意)
- トークンエンドポイント (検証): `https://www.stg.uafp.dips.mlit.go.jp/auth/realms/{realm}/protocol/openid-connect/token`
  - POST (form-urlencoded)。取得: `grant_type=authorization_code` + `code` + `redirect_uri` + `client_id` + `client_secret`
  - 更新: `grant_type=refresh_token` + `refresh_token` + `client_id` + `client_secret`
  - レスポンス: `access_token` (有効 **約300秒**) / `refresh_token` (有効 **約3600秒**) / `expires_in` / `refresh_expires_in` / `id_token` 等
- 本番は `https://www.dips-reg.mlit.go.jp/auth/realms/{realm}/...`
- リダイレクトURL登録済み: `https://techno-drone-system.com/redirect` (パス固定)
- 検証環境はIP制限 (57.181.4.59) のためローカルから疎通不可。設定通知書の「申請者ID」(R08-DRS-0005 参照) は
  DIPSログイン画面で使う検証用アカウントIDと解釈

### エンドポイント (検証環境)

| API | メソッド | URL |
|---|---|---|
| 飛行計画情報取得 | POST | `https://www.stg.uafpi.dips.mlit.go.jp/api/flight-plan/search` |
| 飛行禁止エリア情報取得 | POST | `https://www.stg.uafpi.dips.mlit.go.jp/api/flight-prohibited-area/search` |
| 飛行計画通報受付 | POST | `https://www.stg.uafpi.dips.mlit.go.jp/api/flight-plan/register` |
| 許可・承認情報取得 | GET | `https://www.stg.uafp.dips.mlit.go.jp/req-pub/api/v1/appliers/me/permissions` |
| 許可・承認申請受付 | POST | `https://www.stg.uafp.dips.mlit.go.jp/req-pub/api/v1/appliers/me/permissionRegister` |

- 本番ホスト: API系 `www.uafpi.dips.mlit.go.jp` / 許可承認系 `www.uafp.dips.mlit.go.jp`
- ヘッダ: `Authorization: Bearer {access_token}` / `Content-Type: application/json;charset=UTF-8`
- `applicantId` をbodyに含める旧設計は廃止 (トークンの認証ユーザーから自動特定、URLも `appliers/me`)

### 機体情報一覧取得 API (DRSガイドライン 2.3.6。未実装・参考仕様)

**この節は仕様の記録のみで、実装は行っていない。** 「未対応 (別フェーズ)」参照。

| 項目 | 値 |
|---|---|
| メソッド | GET |
| URL (本番) | `https://www.dips-reg.mlit.go.jp/utm/v1/aircrafts` |
| URL (検証) | `https://www.dips-regdev.mlit.go.jp/utm/v1/aircrafts` |
| realm | `drs-utm` |
| 認可エンドポイント (検証) | `https://www.dips-regdev.mlit.go.jp/auth/realms/drs-utm/protocol/openid-connect/auth` |
| 認可エンドポイント (本番) | `https://www.dips-reg.mlit.go.jp/auth/realms/drs-utm/protocol/openid-connect/auth` |
| リクエストヘッダ | `Authorization: Bearer [access_token]` |

- 認証ホストが他 2 系統 (fpl/req は `uafp(i).dips.mlit.go.jp` 系) と異なり `dips-reg(dev).mlit.go.jp` である点に注意。
  現行 `DipsConfig` (`lib/dips/config.ts`) は fpl/req の2系統専用のため、実装時は設定構造の見直しが必要。
- レスポンス全75項目・検証用アカウント4件・テスト機体18機体のデータは設定通知書 (R08-DRS-0005) の
  「別紙1_機体情報一覧取得API_利用可能情報」シートに定義済み。
- 機体の新規登録・変更・抹消はこの API では不可 (参照 (GET) のみ)。DIPS 画面での人手操作が必要。

### 飛行計画通報受付 リクエスト概要 (FPRガイドライン 2.3.8)

`flightPlanInfo` オブジェクト。主な必須項目 (完全なリストは Phase C 実装時にPDF 2.3.8 から再確認):

- `flightPlanId` (更新時のみ) / `name` (計画名 ≤30字)
- `flightPurpose`: 数値配列 — 1:空撮 2:報道取材 3:警備 4:農林水産業 5:測量 6:環境調査 7:設備メンテナンス 8:インフラ点検・保守 9:資材管理 10:輸送・宅配 11:自然観測 12:事故・災害対応等 13:その他1(業務) 14:趣味 15:研究開発 16:その他2(業務以外)
- `flightAirspace`: 数値配列 (空域種別)
- `assistantsNumber` (補助者人数、0可) / `departurePoint` / `destinationPoint`
- `startTime`: `"yyyyMMdd hhmm"` (半角スペース区切り。終了は所要時間から計算)
- `plannedMaxTime` / `plannedFlightTime`: 分、5分単位 5〜1440
- `flightSpeed`: km/h 1〜999 / `flightAltitude`: m 1〜999 (AGL)
- `flyRoute`: GeoJSON — `type`: `Circle` (center[経度,緯度]+radius[m]) or `Polygon` (coordinates、3点以上)
- 立入管理措置系フラグ4種・係留飛行フラグ ("1"/"0" 文字列)
- 保険情報 (`insuranceProduct`・対人補償額等、許可承認情報設定時は必須)
- `aircraftInfo`: 配列 (必須) → `symbol` (登録記号、必須)

### 飛行計画通報受付 レスポンス

`flightPlanInfoRegistrationResult`:
- `flightPlanId` (採番ID — **DB の `dipsFlightPlanId` に保存**)
- `flightPlanRegistrationResult` (登録結果/失敗理由)
- `flightPlanRegistrationDatetime` (`yyyy/MM/dd hh:mm`)
- `existOtherFlightRoutesCount` / `duplicateFlightPlan[]` (経路重複情報)

### 許可・承認申請受付 リクエスト概要 (FPAガイドライン 2.3.7)

- `formKind`: "1" (新規) 固定 / `category`: "2" (カテゴリーⅡ) 固定
- 飛行目的別の真偽値フィールド群 (`airShot`, `news`, `guard`, `maff`, `survey`, `research`, `facilityMaint`, `infra` ...)
- `regSymbol` はDIPS登録機能へ自動照会され、無効なら即エラー
- 検証環境は東京航空局宛のみ受付

## 実装フェーズ

- [x] **Phase A**: config再設計 (realm別クレデンシャル・認証/API別ベースURL・暗号化鍵) + endpoints正式パス化
- [x] **Phase B**: Authorization Code Flow — `DipsToken` モデル (userId×realm、暗号化保存) + マイグレーション、
      `lib/dips/tokenCipher.ts` (AES-256-GCM)、oidcClient書き換え (認可URL生成/コード交換/自動リフレッシュ)、
      `app/api/dips/auth/start/route.ts` + `app/redirect/route.ts` (state検証)
- [x] **Phase C**: types正式スキーマ化 + dipsApiClient改修 (ユーザー単位トークン、POST系取得API対応)
- [x] **Phase D**: `dipsReceptionNumber`→`dipsFlightPlanId` リネームmigration、DipsService通報マッピング改修
- [x] **Phase E**: UI — 飛行計画詳細に「DIPSへ通報」ボタン + 追加入力ダイアログ (Q1=(a))、DIPS未認証時はログイン誘導
- [ ] **Phase F** (サーバー上): 検証環境疎通 → 動作確認完了報告 → 本番API申請。デプロイ・起動方式の整備が前提
      (2026-07-03時点で Lightsail に node プロセスなし)

### 未対応 (別フェーズ)

- 機体照合 (utm-app系): **ガイドラインは入手済み** (DRS API ガイドライン §2.3.6。上記「機体情報一覧取得 API」参照)。
  仕様待ちではなく実装未着手が正しい状態。実装時に `DipsApiClient.fetchAircraftList` /
  `DipsService.verifyAircraftRegistration` / 機体詳細ページの照合UIを追加する
- 飛行禁止エリア情報取得 → `getRiskStub` の実データ化 (Phase F 疎通後)
- 許可・承認申請受付 (permissionRegister) の UI
- 通報ダイアログの飛行空域種別: 現状カンマ区切りテキスト。ガイドラインのコード表で選択式に改善余地

## 環境変数 (新設計)

| 変数 | 用途 |
|---|---|
| `DIPS_ENABLED` | 機能フラグ (既存) |
| `DIPS_AUTH_BASE_URL` | 認証系ベース (検証: `https://www.stg.uafp.dips.mlit.go.jp`) |
| `DIPS_FPR_API_BASE_URL` | 飛行計画API系 (検証: `https://www.stg.uafpi.dips.mlit.go.jp`) |
| `DIPS_FPA_API_BASE_URL` | 許可承認API系 (検証: `https://www.stg.uafp.dips.mlit.go.jp`) |
| `DIPS_FPL_CLIENT_ID` / `DIPS_FPL_CLIENT_SECRET` | realm `drs-fpl` 用 |
| `DIPS_REQ_CLIENT_ID` / `DIPS_REQ_CLIENT_SECRET` | realm `drs-req` 用 |
| `DIPS_REDIRECT_URI` | `https://techno-drone-system.com/redirect` |
| `DIPS_TOKEN_ENCRYPTION_KEY` | トークン暗号化鍵 (32byte hex) |
