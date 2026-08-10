/**
 * DIPS 2.0 API 型定義
 *
 * 出典: R08-DRS-0005 設定通知書
 * - DipsPermissionInfo 系: 別紙3「許可・承認情報取得APIレスポンスサンプル」の実 JSON キーに準拠
 * - DipsAircraftInfo 系: DRS API 接続システム向けガイドライン 1.2版 §2.3.6 の正式 JSON キー名に準拠
 *   (`lib/dips/aircraftListSchema.ts` が生レスポンスを検証・正規化してこの型を返す)
 */

// ─── 許可・承認情報取得 API (別紙3: JSON キーは実サンプル準拠) ─────────────────

export interface DipsFlightRoute {
  routeName: string;
  /** 緯度経度列 (度分秒を空白区切りで連結した文字列) */
  routeLatlons: string[];
}

export interface DipsUaInfo {
  uaMaker: string;
  uaName: string;
  /** 登録記号 (12桁) */
  regSymbol: string;
}

export interface DipsPermissionInfo {
  /** 許可番号 (例: 東空運航xxxxxx) */
  permissionNumber: string;
  permissionNumber2: string | null;
  /** 受付番号 (例: P221100011) */
  receptionNumber: string;
  /** 許可日 (YYYY-MM-DD) */
  permissionDate: string;
  /** 許可期間開始日 (YYYY-MM-DD) */
  permissionPeriodStart: string;
  /** 許可期間終了日 (YYYY-MM-DD) */
  permissionPeriodEnd: string;
  flightLocation: string;
  flightRoutes: DipsFlightRoute[];
  /** DID (人口集中地区) 上空 */
  aboveDenselyInhabitedDistricts: boolean;
  /** 地表から150m以上の飛行 */
  moreThan150mAboveTheGround: boolean;
  /** 空港等周辺 */
  aroundAirports: boolean;
  /** 人・物件から30m未満の飛行 */
  lessThan30m: boolean;
  /** 催し場所上空 */
  overEventSites: boolean;
  /** 夜間飛行 */
  nightOperation: boolean;
  /** 目視外飛行 */
  beyondVisualLineOfSight: boolean;
  /** 危険物輸送 */
  transportHazardousMaterials: boolean;
  /** 物件投下 */
  dropObjects: boolean;
  uaInfos: DipsUaInfo[];
}

export interface DipsPermissionsResponse {
  permissions: DipsPermissionInfo[];
}

// ─── 機体情報一覧取得 API のコード値定義 (別紙1 準拠) ────────────────────────────

/** 製造区分: 1=メーカーの機体/改造した機体, 2=自作した機体 */
export type DipsManufactureCategory = 1 | 2;

/** 機体の種類: 1=飛行機, 2=回転翼(ヘリ), 3=回転翼(マルチローター), 4=回転翼(その他), 5=滑空機, 6=飛行船 */
export type DipsUaType = 1 | 2 | 3 | 4 | 5 | 6;

/** 機体ステータス: 1=有効(登録済), 2=無効(有効期限切れ), 3=無効(抹消済) */
export type DipsUaStatus = 1 | 2 | 3;

/** 抹消理由: 1=減失・解体, 2=存否不明2ヶ月, 3=無人航空機でなくなった, 4=売却・譲渡, 5=その他, 6=登録取消, 7=更新登録なし */
export type DipsDeregistrationReason = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** RID の有無: 0=なし, 1=あり(内蔵型), 2=あり(外付型) */
export type DipsRemoteIdType = 0 | 1 | 2;

/** 所有者区分: 1=個人, 2=法人 */
export type DipsOwnerCategory = 1 | 2;

/**
 * 使用者種別: ""=個人, "1"=個人, "9"=法人 (別紙1 項番60)。
 * 所有者区分 (1=個人/2=法人) と値体系が異なる点に注意。空文字も正常値として扱う。
 */
export type DipsUserCategory = "" | "1" | "9";

// ─── 飛行計画通報受付 API (FPRガイドライン v1.9 2.3.8 準拠) ─────────────────────

/**
 * 飛行目的コード (FPRガイドライン 2.3.8)
 * 1:空撮 2:報道取材 3:警備 4:農林水産業 5:測量 6:環境調査 7:設備メンテナンス
 * 8:インフラ点検・保守 9:資材管理 10:輸送・宅配 11:自然観測 12:事故・災害対応等
 * 13:その他1(業務) 14:趣味 15:研究開発 16:その他2(業務以外)
 */
export type DipsFlightPurposeCode =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16;

/** 飛行空域種別コード (FPRガイドライン 2.3.8) */
export type DipsFlightAirspaceCode = number;

/**
 * 飛行計画通報でユーザーがダイアログ入力する項目 (FlightPlan/Aircraft から導出できない項目)。
 *
 * Q1=(a): 通報ボタン押下時のダイアログで都度入力する。
 */
export interface DipsNotificationUserInput {
  /** 飛行目的 (複数可) */
  flightPurpose: DipsFlightPurposeCode[];
  /** 飛行空域種別 (複数可) */
  flightAirspace: DipsFlightAirspaceCode[];
  /** 補助者の人数 (無しは 0) */
  assistantsNumber: number;
  /** 出発地の地名・固有名称 */
  departurePoint: string;
  /** 目的地の地名・固有名称 */
  destinationPoint: string;
  /** 当該飛行で多用/最大の速度 (km/h, 1〜999) */
  flightSpeed: number;
  /** 当該飛行で多用/最大の高度 (AGL メートル, 1〜999) */
  flightAltitude: number;
  /** 飛行範囲を表す GeoJSON 文字列 (Circle/Polygon) */
  flyRoute: string;
  /** 立入管理措置を講じる場合 true */
  riskMitigationOnsiteControl: boolean;
}

/**
 * 飛行計画通報受付 API のリクエストボディ (FPRガイドライン 2.3.8)。
 * ネストの flightPlanInfo に通報項目を格納する。startTime は "yyyyMMdd hhmm" 形式。
 */
export interface DipsFlightPlanNotificationPayload {
  flightPlanInfo: {
    /** 更新時のみ。新規は空文字 */
    flightPlanId: string;
    /** 飛行計画名称 (最大30文字) */
    name: string;
    flightPurpose: DipsFlightPurposeCode[];
    flightAirspace: DipsFlightAirspaceCode[];
    assistantsNumber: number;
    departurePoint: string;
    destinationPoint: string;
    /** "yyyyMMdd hhmm" (半角スペース区切り) */
    startTime: string;
    /** 航続可能時間 (分, 5単位 5〜1440) */
    plannedMaxTime: number;
    /** 所要時間 (分, 5単位 5〜1440) */
    plannedFlightTime: number;
    flightSpeed: number;
    flightAltitude: number;
    /** GeoJSON 文字列 */
    flyRoute: string;
    /** "1"=講じる, "0"=講じない */
    riskMitigationOnsiteControl: string;
    aircraftInfo: Array<{
      /** 登録記号 (12桁) */
      symbol: string;
    }>;
  };
}

/** 飛行計画通報の受付結果 (FPRガイドライン 2.3.8 レスポンス) */
export interface DipsFlightPlanNotificationResult {
  /** 採番された飛行計画 ID (DB の dipsFlightPlanId に保存) */
  flightPlanId: string;
  /** 登録結果 (失敗時は理由) */
  flightPlanRegistrationResult: string;
  /** 受付日時 "yyyy/MM/dd hh:mm" */
  flightPlanRegistrationDatetime: string;
}

/**
 * 機体情報 (別紙1「機体情報詳細」のうち本システムが使用する属性のみ)。
 * `lib/dips/aircraftListSchema.ts` の `normalizeAircraftList()` が返す正規化後の型。
 *
 * 個人情報 (氏名・フリガナ・生年月日・住所・電話番号・メールアドレス等) に相当する
 * フィールドは意図的に定義していない。境界の Zod スキーマが未定義キーを除去するため、
 * 型として持たないことがそのまま個人情報の遮断になる (計画書 §6 参照)。
 *
 * 「リモートID発信方式」(別紙1 項番39) は現行ガイドライン (1.2版) 本体に対応する記載がなく
 * JSON キー名が不明なため、意図的に型として定義していない。境界の Zod スキーマは
 * 未知フィールドとして黙って破棄する (寛容パース。2026-08-01 人の決定)。将来この項目が
 * 必要になった場合は DIPS 申請窓口へキー名を再照会すること。
 *
 * コード値系フィールド (manufactureCategory/uaType/uaStatus/deregistrationReason/
 * remoteIdType/ownerCategory) はあえて別紙1 の値体系 (DipsUaStatus 等の literal union) を
 * 型として採用せず `number | null` にしている。実 API が別紙1 未定義の値や null を返しても
 * 境界のパースが失敗しないようにするための寛容パース方針 (2026-08-10 差し戻し) であり、
 * `number` 型に literal union を `as` キャストして被せると実行時の値域を保証しないまま
 * 型だけが狭く見える「偽装」になるため widen した。表示側は
 * `lib/constants/dipsAircraftStatus.ts` の `dipsUaStatusLabel()` 等が未知値・null を
 * 「不明」にフォールバックする。null は「値が欠落していた／数値化できなかった」ことを表す
 * (`aircraftListSchema.ts` の nullableCodeNumber 参照)。
 */
export interface DipsAircraftInfo {
  /** 登録記号 (国発行・12桁) */
  regSymbol: string;
  /** 製造番号 (20桁以下) */
  serialNumber: string;
  manufactureCategory: number | null;
  uaType: number | null;
  makerNameJa: string;
  modelNameJa: string;
  makerNameEn: string;
  modelNameEn: string;
  /** 機体重量 (kg)。null は値が欠落していた／数値化できなかったことを表す */
  weightKg: number | null;
  /** 最大離陸重量 (kg)。null は値が欠落していた／数値化できなかったことを表す */
  maxTakeoffWeightKg: number | null;
  uaStatus: number | null;
  deregistrationReason: number | null;
  /** 抹消理由が「その他」の場合の自由記述。それ以外は null */
  deregistrationReasonOther: string | null;
  remoteIdType: number | null;
  /** 有効期限開始 (YYYY-MM-DDThh:mm:ss+09:00) */
  validPeriodStart: string;
  /** 有効期限終了 (YYYY-MM-DDThh:mm:ss+09:00) */
  validPeriodEnd: string;
  ownerCategory: number | null;
  /** 使用者種別 ("" | "1" | "9" が既知の値。空文字は個人を表す正常値)。未知の値もそのまま通す */
  userCategory: string;
}

/**
 * DIPS 所有機体 (機体情報一覧取得 API) を UI へ渡す DTO。`DipsService.listOwnedAircrafts()` が返す。
 * 所有者・使用者の個人情報は含まない (DipsAircraftInfo の時点で既に除去済み)。
 *
 * `lib/api/dips.ts` (クライアント側) はこの型を re-export して使う (二重定義の解消)。
 * コード値系フィールドを `number | null` にしている理由は `DipsAircraftInfo` と同じ。
 */
export interface DipsOwnedAircraftDto {
  registrationCode: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  /** 機体重量 (g)。DIPS 側は kg 単位のため四捨五入して変換する。null は値が欠落していたことを表す */
  weightGrams: number | null;
  status: number | null;
  deregistrationReason: number | null;
  validPeriodEnd: string;
  remoteIdType: number | null;
  ownerCategory: number | null;
  /** 取り込み選択可能か (機体ステータスが有効な機体のときのみ true) */
  isSelectable: boolean;
}
