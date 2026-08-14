# DIPS 機体情報一覧取得 API (DRS, §2.3.6) 実装リファレンス

最終更新: 2026-08-10
実装: `GET /api/dips/aircrafts` (Controller) → `DipsService.listOwnedAircrafts()` →
`DipsApiClient.fetchAircraftList()` → `lib/dips/aircraftListSchema.ts` (境界検証・正規化)

## 1. 一次資料

| 項目 | 値 |
|---|---|
| 資料名 | DRS API 接続システム向けガイドライン |
| 現行版数 | **1.2 版 (2026-07-27 改訂)** |
| 出典 URL | https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf (ログイン不要) |
| 対象節 | §2.3.6 機体情報一覧取得API |
| 発行者 | 国土交通省航空局安全部無人航空機安全課 |

§2.3.6 のエンドポイント・realm・JSON キー名は 1.1 版 (2022-12-05) から実質変更なし
(詳細: `_orchestrator/results/quick/20260730-dips-guideline-latest-version-scout.md`)。

## 2. エンドポイント・認証

| 項目 | 値 |
|---|---|
| メソッド | GET |
| URL (本番) | `https://www.dips-reg.mlit.go.jp/utm/v1/aircrafts` |
| URL (検証) | `https://www.dips-regdev.mlit.go.jp/utm/v1/aircrafts` |
| realm | `drs-utm` (realm キー: `utm`) |
| リクエストヘッダ | `Authorization: Bearer [access_token]` |
| 認証方式 | 既存の DIPS 認証基盤 (Authorization Code Flow) を realm 追加で再利用。新しい認証機構は作らない |

認証・API のベース URL は fpl/req 系と異なるドメイン (`dips-reg(dev).mlit.go.jp`) のため、
環境変数 `DIPS_DRS_AUTH_BASE_URL` / `DIPS_DRS_API_BASE_URL` で別途指定する
(`lib/dips/config.ts` の `requireAuthBaseUrl()` / `requireApiBaseUrl()`)。

## 3. レスポンス形式

トップレベルは配列 (0件の場合は `[]`)。各要素は以下の3ブロックを持つ:

```json
[
  {
    "aircraft_information": { "registration_code": "...", "...": "..." },
    "owner_information": { "owner_classification": "...", "...": "..." },
    "user_information": { "user_classification": "...", "...": "..." }
  }
]
```

## 4. JSON キー名と採否

出典: ガイドライン 1.2版 本文の表 (No.1〜74) と、設定通知書 (R08-DRS-0005) 別紙1 の項番
(No.1〜75) を突合した対応表
(`_orchestrator/results/quick/20260730-dips-guideline-latest-version-scout.md` §2)。

### 4-1. 採用 (`DipsAircraftInfo` として型定義・パース対象)

| JSON キー | 別紙1 項番 | 本システムでの用途 | PII区分 |
|---|---|---|---|
| `registration_code` | 3 | `regSymbol` (登録記号) | 非PII |
| `manufacturing_number` | 4 | `serialNumber` (製造番号) | 非PII |
| `manufacturing_category` | 5 | `manufactureCategory` | 非PII (コード値) |
| `aircraft_type` | 6 | `uaType` | 非PII (コード値) |
| `manufacturer_jpn` | 7 | `makerNameJa` | 非PII |
| `model_jpn` | 8 | `modelNameJa` | 非PII |
| `manufacturer_eng` | 9 | `makerNameEn` | 非PII |
| `model_eng` | 10 | `modelNameEn` | 非PII |
| `aircraft_weight` | 11 | `weightKg` | 非PII |
| `maximum_takeoff_weight` | 13 | `maxTakeoffWeightKg` | 非PII |
| `aircraft_status` | 24 | `uaStatus` | 非PII (コード値) |
| `erase_reason_number` | 25 | `deregistrationReason` | 非PII (コード値) |
| `erase_reason_other` | 26 | `deregistrationReasonOther` | 非PII (自由記述だが機体側の理由。人物情報ではない) |
| `effectiveness_period_self` | 28 | `validPeriodStart` | 非PII |
| `effectiveness_period_to` | 29 | `validPeriodEnd` | 非PII |
| `rid_type` | 30 | `remoteIdType` | 非PII (コード値) |
| `owner_classification` | 41 | `ownerCategory` (コード値のみ) | 非PII |
| `user_classification` | 60 | `userCategory` (コード値のみ) | 非PII |

### 4-2. 不採用 — 個人情報として意図的に型を定義しない (境界で破棄)

別紙1 項番 42〜57 (所有者情報: 氏名・フリガナ・法人番号・企業名・代表者名・住所・生年月日・
電話番号・メールアドレス)、項番 59・61〜75 (使用者情報の同項目) は `DipsAircraftInfo` に
一切フィールドを持たない。`lib/dips/aircraftListSchema.ts` の Zod スキーマがこれらのキーを
定義しないため、`z.object()` の既定動作 (strip) で自動的に除去される。
`__tests__/lib/dips/aircraftListSchema.test.ts` の `test_parse_drops_owner_personal_information`
/ `test_parse_drops_user_personal_information` で証明済み。

### 4-3. 不採用 — 本システムが現時点で使わないため型を定義しない

重量区分・機体寸法・改造情報・安全性の確認1〜5・最終更新日・RID外付け機器の詳細・RID搭載義務・
RID更新日時・書き込みフラグ・所有者使用者同一確認 (別紙1 項番12〜23,27,31〜38,59)。

### 4-4. キー名不明 (寛容パースで対応)

別紙1 項番39「リモートID発信方式」に対応する行が、現行ガイドライン (1.2版) 本体の §2.3.6
レスポンス定義 (No.1〜74) に存在しない。ガイドライン側は `write_status` (No.38) の次が
`owner_information` (No.39) に直結しており、対応するキーがない。

**2026-08-01 人の決定: 窓口へ照会せず、寛容パースで進める。**
理由: 第1段階が使う項目 (登録記号・型式・製造者・機体ステータス等) に元々含まれておらず、
照会の往復 (回答まで日数不明) を検証期限 (2026-08-31) 前のクリティカルパスに載せる価値が
ないため。`lib/dips/aircraftListSchema.ts` は未知キーを黙って除去する (`.strict()` を使わない)
ため、この項目を含むレスポンスでもパースは失敗しない。
`__tests__/lib/dips/aircraftListSchema.test.ts` の `test_parse_ignores_unknown_keys` で証明済み。

**将来この項目が必要になった場合**: DIPS 申請窓口 (`hqt-jcab.mujin@ki.mlit.go.jp`、1.2版で
ドメイン変更済み) へ、別紙1 項番39 に対応する JSON キー名を照会すること。

## 5. コード値表 (別紙1 準拠)

| 項目 | コード値 |
|---|---|
| 機体ステータス (`aircraft_status`) | 1=有効(登録済) / 2=無効(有効期限切れ) / 3=無効(抹消済) |
| 抹消理由 (`erase_reason_number`) | 1=減失・解体 / 2=存否不明2ヶ月 / 3=無人航空機でなくなった / 4=売却・譲渡 / 5=その他 / 6=登録取消 / 7=更新登録なし |
| RIDの有無 (`rid_type`) | 0=なし / 1=あり(内蔵型) / 2=あり(外付型) |
| 所有者区分 (`owner_classification`) | 1=個人 / 2=法人 |
| 使用者種別 (`user_classification`) | 空文字=個人 / "1"=個人 / "9"=法人 (所有者区分と値体系が異なる点に注意) |

コード値は JSON 上で数値・文字列いずれで返るかガイドラインから断定できないため、
`lib/dips/aircraftListSchema.ts` は両方を受理して number (または `userCategory` のみ string)
へ正規化する。

## 6. 機体09/10 の機体ステータス実値 (確定)

設定通知書 別紙1 の「◆機体情報サマリ」表 (説明文) と「◆機体情報詳細」表 (生値) で記述が
食い違っていたため、Excel 原本のセル実値を再確認した
(`_orchestrator/results/quick/20260801-dips-annex1-aircraft-status-verify-scout.md`)。

**詳細表の生値が正**:

| 機体 | 機体ステータス | 抹消理由 |
|---|---|---|
| 機体09 | `3` (抹消済) | `5` (その他)。その他の理由「その他抹消理由」 |
| 機体10 | `2` (有効期限切れ) | (空欄) |

サマリ表の説明文 (機体09=期限切れ / 機体10=抹消済) は誤り。判定根拠は上記スコット報告の
「業務ルール上の内部整合性 (抹消理由は機体ステータス=3のときのみ設定される)」による。
テストフィクスチャ (`test-fixtures/dips/aircraftListFixtures.ts`) はこの確定値を使用している。

## 7. 個人情報の取り扱い方針 (実装確認用チェックリスト)

- [x] 生レスポンスの所有者・使用者の氏名・フリガナ・住所・電話番号・メールアドレス・生年月日は
      型として定義しない (§4-2)
- [x] Zod スキーマは `.strict()` を使わない (未知キー・不採用キーは黙って除去)
- [x] エラーメッセージ・ログには Zod のキー名 (path) のみを含め、受信値そのものは含めない
      (`lib/dips/aircraftListSchema.ts` の `formatIssuePaths()`)
- [x] `DipsApiError.responseBody` は先頭200文字までに切り詰めて保持する
      (`lib/dips/dipsApiClient.ts` の `RESPONSE_BODY_PREVIEW_LENGTH`)
- [x] 機体詳細ページの「DIPSと照合」結果は DB に保存しない (都度取得のみ)
- [x] 所有者区分・使用者種別はコード値のみ保持し、氏名等は一切取得しない

## 8. DB について

第1段階はスキーマ変更なし。選択した機体の情報は既存 `Aircraft` テーブルの列
(`manufacturer` / `modelNumber` / `serialNumber` / `weightGrams` / `registrationNumber`) に
そのまま入る。機体詳細ページの照合結果も保存しない。
