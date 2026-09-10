# 飛行計画通報受付 API (5-6) の必須51項目 対応表

DIPS2.0 API（飛行計画通報）ガイドライン (FPRガイドライン) v1.9 §2.3.8 のリクエストボディが
定義する必須 (○) 51項目について、本システムがどこから値を組み立てているかをまとめる。

## 位置づけ・使い方

- 本番サーバーで飛行計画通報 (5-6) が 400 (必須項目不足) で拒否されたとき、
  `errorMessage` に含まれる項目名をこの表と突き合わせて原因を切り分けるために使う
  (`docs/production-operations-runbook.md` 「1-13. 飛行計画通報受付(5-6)の疎通確認」から参照される)
- 元々この対応表は `_orchestrator/results/req-013/builder.md` (req-013 の作業報告書) に
  あったが、`_orchestrator/` は `.gitignore` の対象であり本番サーバー上では取得できない
  ため、本番でも参照できるようこの `docs/` 配下へ移設した (2026-09-10, req-013 差し戻し J7)。
  作業の背景・判断根拠など、この表自体に含まれない詳細は引き続き元の報告書を参照すること
  (ローカルの `_orchestrator/` にアクセスできる場合のみ)
- 一次情報 (ガイドライン PDF) の出典は `docs/dips-integration.md` の環境変数節を参照。
  PDF から抽出したテキストは `_orchestrator/results/quick/20260908-fpr-guideline-2.3.8-extract.txt`
  にあるが、同じ理由で本番サーバーからは参照できない

## 実装箇所

payload の組み立ては `lib/dips/notificationMapper.ts` の `buildFlightPlanNotificationPayload()`
に集約されている。この網羅性は `__tests__/lib/dips/flightPlanNotificationPayload.test.ts` の
`REQUIRED_FIELDS` 表で機械的に検証する (1項目でも欠ければテストが落ちる)。

**この API のペイロードを変更する場合、まずこのテストの `REQUIRED_FIELDS` 表をガイドラインと
突合してから直すこと (推測で埋めない)。**

## 必須51項目の対応表

凡例 — 取得元: `既存` = DB/セッションから取得済み / `入力` = 通報ダイアログの入力 /
`DB(Aircraft)` = 機体マスタのカラム / `定数` = 固定値 / `構造` = JSON の階層。

| No  | 項目名                          | パラメータ名                     | 値の取得元                                                                 |
| --- | ------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| 1   | 飛行計画情報                    | `flightPlanInfo`                 | 構造 (ラッパー)                                                            |
| 3   | 飛行計画名称                    | `name`                           | 既存: `FlightPlan.title` (30文字切り詰め)                                  |
| 4   | 飛行目的                        | `flightPurpose`                  | 入力                                                                       |
| 9   | 補助者                          | `assistantsNumber`               | 入力                                                                       |
| 10  | 出発地                          | `departurePoint`                 | 入力                                                                       |
| 11  | 飛行開始日時                    | `startTime`                      | 既存: `FlightPlan.plannedAt` → JST整形                                     |
| 12  | 航続可能時間                    | `plannedMaxTime`                 | 既存: `Aircraft.maxFlightTimeMin` (5分単位に丸め)                          |
| 13  | 所要時間                        | `plannedFlightTime`              | 既存: `FlightPlan.durationMin` (5分単位に丸め)                             |
| 14  | 飛行速度                        | `flightSpeed`                    | 入力                                                                       |
| 15  | 飛行する高度                    | `flightAltitude`                 | 入力                                                                       |
| 16  | 飛行の経路                      | `flyRoute`                       | 入力 → Circle GeoJSON 文字列                                               |
| 17  | ジオメトリタイプ                | `type` (flyRoute内)              | 既存: `"Circle"` 固定 (flyRoute 文字列に内包)                              |
| 26  | 目的地                          | `destinationPoint`               | 入力                                                                       |
| 27  | 立入管理措置                    | `riskMitigationOnsiteControl`    | 入力                                                                       |
| 28  | 立入管理措置(レベル3飛行)       | `riskMitigationOnsiteControlL3`  | 入力                                                                       |
| 29  | 立入管理措置(レベル3.5飛行関連) | `riskMitigationOnsiteControlL35` | 入力                                                                       |
| 30  | 立入禁止措置                    | `riskMitigationOnsiteControl2`   | 入力                                                                       |
| 31  | 係留飛行                        | `exceptionalConditionsMooring`   | 入力                                                                       |
| 38  | 通報者                          | `reporter`                       | 構造 (オブジェクト)                                                        |
| 39  | 連絡先フラグ                    | `contactReporterFlag`            | 定数 `"1"` 固定                                                            |
| 40  | 連絡先                          | `contactReporter`                | 構造                                                                       |
| 41  | 氏名                            | `name`                           | 既存: `User.name`                                                          |
| 42  | 国                              | `country`                        | 定数: `DIPS_COUNTRY_CODE_JAPAN` = `"001"`                                  |
| 43  | 都道府県                        | `prefectures`                    | 入力 (セレクト、47件)                                                      |
| 44  | 住所                            | `municipality`                   | 入力                                                                       |
| 45  | 電話番号 (国コード)             | `telephoneCountry`               | 定数: 日本                                                                 |
| 46  | 電話番号                        | `telephone`                      | 入力                                                                       |
| 47  | メールアドレス                  | `email`                          | 既存: `User.email`                                                         |
| 49  | 操縦者情報                      | `pilotInfo`                      | 構造 (配列。常に1件。操縦者=通報者)                                        |
| 50  | 連絡先フラグ                    | `contactPilotFlag`               | 定数 `"0"` 固定                                                            |
| 51  | 連絡先                          | `contactPilot`                   | 構造                                                                       |
| 52  | 氏名                            | `name`                           | 既存: `User.name` (通報者と同一人物)                                       |
| 53  | 国                              | `country`                        | 定数: 日本                                                                 |
| 54  | 都道府県                        | `prefectures`                    | 入力 (通報者と同値)                                                        |
| 55  | 住所                            | `municipality`                   | 入力 (同上)                                                                |
| 56  | 電話番号 (国コード)             | `telephoneCountry`               | 定数: 日本                                                                 |
| 57  | 電話番号                        | `telephone`                      | 入力 (同上)                                                                |
| 58  | メールアドレス                  | `email`                          | 既存: `User.email`                                                         |
| 60  | 技能証明(一等)                  | `firstClass`                     | 入力                                                                       |
| 61  | 技能証明(二等)                  | `secondClass`                    | 入力                                                                       |
| 62  | 技能認証保有状況                | `privateLicense`                 | 入力                                                                       |
| 63  | 使用機体製造者名                | `maker`                          | 既存: `Aircraft.manufacturer` (通報対象機体)                               |
| 64  | 使用機体型式／名称              | `model`                          | 既存: `Aircraft.modelNumber`                                               |
| 65  | 機体情報                        | `aircraftInfo`                   | 構造 (配列。常に1件)                                                       |
| 66  | 機体の種類                      | `type`                           | DB(Aircraft): `dipsUaType` (1〜6。未設定だと通報前にエラーで止まる)        |
| 68  | 登録記号                        | `symbol`                         | 既存: `Aircraft.registrationNumber`                                        |
| 69  | 型式／名称                      | `model`                          | 既存: `Aircraft.modelNumber`                                               |
| 70  | 製造者名                        | `maker`                          | 既存: `Aircraft.manufacturer`                                              |
| 71  | 機体認証(第一種)                | `certification1`                 | DB(Aircraft): `hasDipsCertification1` (既定 false = 未取得)                |
| 72  | 機体認証(第二種)                | `certification2`                 | DB(Aircraft): `hasDipsCertification2` (既定 false = 未取得)                |
| 73  | 総重量(kg)                      | `maxWeight`                      | DB(Aircraft): `maxTakeoffWeightGrams` (優先) または `weightGrams` (kg換算) |

### 51項目に含まれないが条件付きで必須になる項目

| No  | 項目名           | パラメータ名        | 条件                                                         |
| --- | ---------------- | ------------------- | ------------------------------------------------------------ |
| 5   | その他1 理由入力 | `othergyomutext`    | `flightPurpose` に 13 (その他1・業務) を含む場合のみ必須     |
| 6   | その他2 理由入力 | `othergyomugaitext` | `flightPurpose` に 16 (その他2・業務以外) を含む場合のみ必須 |

### 意図的に送信していない項目 (ガイドライン上は任意 `－`/`△`)

`docs/dips-integration.md` の「未実装のまま残っているもの」節を参照。許可・承認情報
(No.74〜87)・保険情報 (No.32〜37)・重複計画情報取得フラグ (No.88) はいずれも任意のため
送信しない。この画面は許可・承認を要する飛行 (No.7 flightAirspace や No.8 flightType の
いずれかに該当する飛行) の通報をサポートしない。
