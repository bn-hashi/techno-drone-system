/**
 * DIPS 2.0 API 型定義
 *
 * 出典: R08-DRS-0005 設定通知書
 * - DipsPermissionInfo 系: 別紙3「許可・承認情報取得APIレスポンスサンプル」の実 JSON キーに準拠
 *   (`lib/dips/permissionsSchema.ts` が生レスポンスを検証・正規化してこの型を返す)
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
  /**
   * 許可日 (YYYY-MM-DD)。画面には表示しないフィールドのため、DIPS が想定外の型で
   * 返した場合でも許可自体を落とさず null に丸める (2026-08-28 差し戻し F5。
   * `lib/dips/permissionsSchema.ts` の unusedDisplayString 参照)
   */
  permissionDate: string | null;
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

// レスポンス全体の型 (`{ permissions: DipsPermissionInfo[] }`) は敢えて定義しない。
// 正規化後は除外件数 (excludedCount) を伴う `NormalizePermissionsResult`
// (`lib/dips/permissionsSchema.ts`) が実質的な後継のため、二重定義を避ける。

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

// ─── 飛行計画情報取得・飛行禁止エリア情報取得 共通 (FPRガイドライン v1.9 2.3.6/2.3.7) ──

/**
 * 検索範囲のジオメトリ (リクエスト用)。ガイドラインは Circle (円) / Polygon (多角形) の
 * 2種別を定義するが、本システムは疎通確認用途のため Circle のみをサポートする
 * (Polygon は3点以上の構成点配列の入力が必要で UI が大幅に複雑になるため、意図的に
 * 対象外とした設計判断。将来 Polygon 検索が必要になった場合はこの型を拡張すること)。
 */
export interface DipsCircleSearchFeature {
  type: "Circle";
  /** [経度, 緯度] (十進法 度表記 世界測地系) */
  center: [number, number];
  /** 検索半径 (メートル) */
  radius: number;
}

/**
 * レスポンスに含まれるジオメトリ (Circle/Polygon 両対応)。DIPS は type に関わらず
 * center/radius/coordinates の全キーを返す (該当しない側は空配列・0 になる。
 * FPRガイドライン 2.3.6/2.3.7 レスポンスボディサンプル参照)。個人情報は含まない。
 */
export interface DipsAreaGeometry {
  type: "Circle" | "Polygon";
  /** [経度, 緯度]。type が Polygon の場合は空配列 */
  center: number[];
  /** メートル。type が Polygon の場合は 0 */
  radius: number;
  /** [経度, 緯度] の配列。type が Circle の場合は空配列 */
  coordinates: number[][];
}

// ─── 飛行禁止エリア情報取得 API (FPRガイドライン v1.9 2.3.7 準拠) ──────────────────

/** 飛行禁止エリア情報取得 API のリクエスト (ドメイン層の形。ワイヤーフォーマットへの
 * ネスト変換は `DipsApiClient.searchFlightProhibitedAreas` が担う) */
export interface DipsFlightProhibitedAreaSearchRequest {
  features: DipsCircleSearchFeature;
  /** 飛行禁止エリア種別 (複数指定可・1件以上必須)。値域は FPRガイドライン 2.3.7 参照
   * (1:空港等周辺, 2:人口集中地区, 5〜11:各種禁止エリア) */
  flightProhibitedAreaTypeIds: number[];
}

/**
 * 飛行禁止エリア情報。地理情報・エリア種別・名称のみで個人情報は一切含まない
 * (5-1/5-2 のような PII 遮断のための寛容化は不要)。
 */
export interface DipsFlightProhibitedAreaInfo {
  areaId: string;
  name: string;
  detail: string;
  url: string;
  areaTypeId: number;
  /** 有効期限開始 (yyyy-MM-ddTHH:mm:ss 形式) */
  startTime: string;
  /** 有効期限終了 (yyyy-MM-ddTHH:mm:ss 形式。無期限は "9999-12-31T23:59:00") */
  finishTime: string;
  range: DipsAreaGeometry;
}

// ─── 飛行計画情報取得 API (FPRガイドライン v1.9 2.3.6 準拠) ───────────────────────

/**
 * 飛行計画情報取得 API のリクエスト。`allFlightPlan` を省略/"0" にすると全ユーザーの
 * 公開飛行計画を検索する (この場合レスポンスの●項目の大半は省略される。DipsFlightPlanInfo
 * のコメント参照)。"1" は自アカウントの飛行計画のみ (全項目が返る)。
 */
export interface DipsFlightPlanSearchRequest {
  features: DipsCircleSearchFeature;
  /** "1"=自アカウントのみ, "0"=全ユーザー。省略時は全ユーザー */
  allFlightPlan?: "0" | "1";
}

export interface DipsFlightPlanInsuranceInfo {
  insuranceCompany: string;
  insuranceProduct: string;
  /** 対人補償金額。無制限は -1 */
  interPerson: number;
  /** 対物補償金額。無制限は -1 */
  interObject: number;
  /** 賠償能力の有無 ("0"=なし, "1"=あり) */
  insuranceAbility: string;
}

/** 操縦者情報のうち個人情報 (氏名・住所・電話番号・メールアドレス等) を除いた項目のみ */
export interface DipsFlightPlanPilotInfo {
  pilotId: number;
  skillCertificationNumber: string;
  /** 技能証明(一等) "1"=有り, "0"=無し */
  firstClass: string;
  /** 技能証明(二等) "1"=有り, "0"=無し */
  secondClass: string;
  /** 技能認証保有状況 (2025年12月の制度改正により将来的に廃止予定) */
  privateLicense: string;
  maker: string;
  model: string;
}

export interface DipsFlightPlanAircraftInfo {
  aircraftId: number;
  /** 機体の種類コード (1〜6) */
  type: string;
  certificationNum: string;
  /** 登録記号 */
  symbol: string;
  model: string;
  maker: string;
  certification1: string;
  certification2: string;
  maxWeight: number;
}

/** 許可・承認情報のうち個人情報 (連絡先氏名・住所・電話番号・メールアドレス等) を除いた項目のみ */
export interface DipsFlightPlanPermitApplicationInfo {
  flightPermitApplicationNumber: string;
  permitDate: string;
  startDate: string;
  finishDate: string;
}

/**
 * 飛行計画情報。個人情報 (通報者・操縦者・許可申請者の氏名・住所・電話番号・メールアドレス)
 * に相当するフィールドは意図的に定義していない (`lib/dips/flightPlanSchema.ts` の
 * Zod スキーマが未定義キーを除去するため、型として持たないことがそのまま個人情報の
 * 遮断になる。DipsAircraftInfo と同じ方針)。
 *
 * FPRガイドライン 2.3.6 は各レスポンス項目を ○ (全ユーザーの飛行計画で出力) と
 * ● (自アカウントの飛行計画のみ出力) に分類している。○ の項目 (flightPlanId/startTime/
 * finishTime/plannedMaxTime/plannedFlightTime/flightSpeed/flightAltitude/flyRoute) は
 * 常に存在するため必須型、● の項目は他ユーザーの飛行計画検索では省略されるため
 * `| null` (省略時は null に正規化する。値が存在するのに null というデータ異常とは区別
 * できないが、他ユーザーの飛行計画の大半でこの状態になるのは仕様どおりであり、
 * エントリ単位のフォールバックで除外すると検索結果のほとんどが消えてしまうため)。
 */
export interface DipsFlightPlanInfo {
  flightPlanId: string;
  name: string | null;
  /** 飛行目的コード (複数)。DipsFlightPurposeCode と同じ値域 */
  flightPurpose: number[] | null;
  /** 飛行空域コード (複数) */
  flightAirspace: number[] | null;
  /** 飛行方法コード (複数) */
  flightType: number[] | null;
  assistantsNumber: number | null;
  departurePoint: string | null;
  destinationPoint: string | null;
  /** "yyyyMMdd HHmm" 形式 */
  startTime: string;
  /** "yyyyMMdd HHmm" 形式 */
  finishTime: string;
  /** 航続可能時間 (分) */
  plannedMaxTime: number;
  /** 所要時間 (分) */
  plannedFlightTime: number;
  /** 飛行速度 (km/h) */
  flightSpeed: number;
  /** 飛行高度 (AGL メートル) */
  flightAltitude: number;
  flyRoute: DipsAreaGeometry;
  /** 立入管理措置 "1"=講じる, "0"=講じない */
  riskMitigationOnsiteControl: string | null;
  riskMitigationOnsiteControlL3: string | null;
  riskMitigationOnsiteControlL35: string | null;
  riskMitigationOnsiteControl2: string | null;
  /** 係留飛行 "1"=行う, "0"=行わない */
  exceptionalConditionsMooring: string | null;
  insuranceInformation: DipsFlightPlanInsuranceInfo | null;
  otherInformation: string | null;
  pilotInfo: DipsFlightPlanPilotInfo[] | null;
  aircraftInfo: DipsFlightPlanAircraftInfo[] | null;
  flightPermitApplicationInfo: DipsFlightPlanPermitApplicationInfo | null;
}

// ─── 許可・承認申請受付 API (DIPS2.0 API(FPA) ガイドライン v1.5 2.3.7 準拠) ────────

/**
 * 許可・承認申請受付 API のリクエストボディ。ガイドライン §2.3.7 の全134項目に対応する。
 *
 * このシステムは疎通確認 (検証環境で任意の申請を送信し受付番号が取得できることの確認)
 * のみを目的とし、申請内容の入力 UI は持たない。`buildPermissionApplicationTestPayload()`
 * (`lib/dips/permissionApplicationSchema.ts`) が、設定通知書 別紙2「許可・承認申請受付
 * API_利用可能情報」の固定テスト値と、ガイドライン自身のリクエストボディサンプルの値
 * (「他項目で値が不明な場合は、ガイドラインのリクエストボディサンプルの値を参考に設定
 * すること」という検証環境利用上の注記に明示的に従う) から本payloadを組み立てる。
 *
 * フィールド名はガイドラインのパラメータ名 (物理項目名) をそのまま使う。個人情報は
 * pilotInfos (操縦者名・住所・電話番号・メールアドレス等) に含まれるが、これは検証環境の
 * 固定テスト値 (別紙2/ガイドラインサンプル由来のダミー値) であり実在人物の情報ではない。
 */
export interface DipsPermissionApplicationPayload {
  /** 「1:新規」固定 */
  formKind: "1";
  /** 「2:カテゴリーⅡ」固定 */
  category: "2";
  // 業務内容 (少なくとも1つ true。空撮〜事故・災害対応等の12項目。その他1/趣味/研究開発/
  // その他2の4項目は検証環境では "false:該当なし" 固定)
  airShot: boolean;
  news: boolean;
  guard: boolean;
  maff: boolean;
  survey: boolean;
  research: boolean;
  facilityMaint: boolean;
  infra: boolean;
  materia: boolean;
  transport: boolean;
  nature: boolean;
  accident: boolean;
  otherGyomu: boolean;
  hobby: boolean;
  rschAndDvlpmt: boolean;
  otherGyomugai: boolean;
  // 立入管理措置の有無 (補助者の配置/立入管理区画の設定/立入禁止区画の設定の少なくとも
  // 1つに該当。レベル3/3.5飛行・その他は検証環境では false 固定)
  ostCtrlMsrsPlcmtOfAsstsExstnc: boolean;
  ostCtrlMsrsSetAccsCtrlAraExstnc: boolean;
  ostCtrlMsrsSetOflmtsZnExstnc: boolean;
  ostCtrlMsrsSetAccsCtrlAraLevel3Exstnc: boolean;
  ostCtrlMsrsSetAccsCtrlAraLevel35Exstnc: boolean;
  ostCtrlMsrsOtherExstnc: boolean;
  // 特定飛行の飛行形態 (該当する場合、対になる *Code に理由コードを設定する)
  aboveDenselyInhabitedDistricts: boolean;
  aboveDenselyInhabitedDistrictsCode?: string;
  lessThan30m: boolean;
  lessThan30mCode?: string;
  nightOperation: boolean;
  nightOperationCode?: string;
  beyondVisualLineOfSight: boolean;
  beyondVisualLineOfSightCode?: string;
  transportHazardousMaterials: boolean;
  transportHazardousMaterialsCode?: string;
  dropObjects: boolean;
  dropObjectsCode?: string;
  /** 「false:該当なし」固定 (空港周辺等は本システムの検証申請では対象外) */
  moreThan150mAboveTheGround: boolean;
  aroundAirports: boolean;
  overEventSites: boolean;
  /** 年間の飛行 1:はい, 2:いいえ */
  annualFlight: "1" | "2";
  /** 飛行する期間 (開始日) YYYY/MM/DD */
  formStart: string;
  /** 飛行する期間 (終了日) YYYY/MM/DD */
  formEnd: string;
  /** 飛行経路の特定「1:特定しない」固定 */
  flightRouteSpecific: "1";
  /** 飛行場所 1:日本全国, 3:都道府県 */
  flyLocation: "1" | "3";
  /** 提出先区分 01:東京航空局, 02:大阪航空局 */
  destinationKbn: "01" | "02";
  /** 提出先コード ECAB:東京航空局, WCAB:大阪航空局 */
  destinationCode: "ECAB" | "WCAB";
  /** 都道府県コード (別紙3)。flyLocation が "3" 以外なら空配列 */
  keninfo: string[];
  /** マニュアル選択「1:航空局標準マニュアルを使用」固定 */
  manual: "1";
  cvlAvtnBruStddMnl01: boolean;
  cvlAvtnBruStddMnl02: boolean;
  cvlAvtnBruStddMnlArlSpry: boolean;
  cvlAvtnBruStddMnlRschAdDvlpmt: boolean;
  cvlAvtnBruStddMnl01InfrstrteInspcn: boolean;
  cvlAvtnBruStddMnl02InfrstrteInspcn: boolean;
  /** 申請書操縦者情報 (1件〜N件) */
  pilotInfos: DipsPermissionApplicationPilotInfo[];
  /** 申請書機体情報 (1件〜N件) */
  uaInfos: DipsPermissionApplicationUaInfo[];
  insurance?: string;
  productName?: string;
  /** 無制限の場合は -1 */
  interPerson?: number;
  /** 無制限の場合は -1 */
  interObject?: number;
  /** 賠償能力の有無 1:有り, 2:無し */
  cmpstnAblty: "1" | "2";
  emergencyTel: string;
  /** 別紙2 国コードのデータ定義 */
  countryCodeTel: string;
  tel: string;
  /** 許可書形式 1:電子許可書, 2:紙許可書 */
  permissionForm: "1" | "2";
}

/**
 * 申請書操縦者情報 (ガイドライン §2.3.7 項番55〜82)。氏名・住所・電話番号・メール
 * アドレスは検証環境の固定テスト値 (実在人物の情報ではない) を送信する。
 */
export interface DipsPermissionApplicationPilotInfo {
  pilotName: string;
  pilotNamekana: string;
  /** 別紙2 国コードのデータ定義 */
  pilotCountryCode: string;
  /** 別紙3 都道府県コードのデータ定義 */
  pilotPrefectureCode: string;
  pilotAddress: string;
  pilotCountryCodeTel: string;
  pilotPhoneNumber: string;
  pilotMailAddress: string;
  skillCertificateNumber?: string;
  /** 「1:はい」固定 */
  pilotCareer10Hour: "1";
  /** 「1:はい」固定 */
  pilotKnowledge: "1";
  /** 「1:はい」固定 */
  pilotSkill: "1";
  /** 1:はい, 3:該当の操作・操縦を行わない */
  pilotRemoteskill: "1" | "3";
  /** 1:はい, 3:該当の操作・操縦を行わない */
  pilotAutopilotskill: "1" | "3";
  addStdRotorNightFly?: "1" | "";
  addStdRotorOutsideFly?: "1" | "";
  addStdRotorDrop?: "1" | "";
  addStdAirplaneNightFly?: "1" | "";
  addStdAirplaneOutsideFly?: "1" | "";
  addStdAirplaneDrop?: "1" | "";
  addStdGlidersNightFly?: "1" | "";
  addStdGlidersOutsideFly?: "1" | "";
  addStdGlidersDrop?: "1" | "";
  addStdAirshipNightFly?: "1" | "";
  addStdAirshipOutsideFly?: "1" | "";
  addStdAirshipDrop?: "1" | "";
  /** 代替的安全対策 (夜間・目視外・物件投下)「空」固定 */
  flightModeSafty: "";
  formDroneMaker: string;
  formDroneName: string;
}

/**
 * 申請書機体情報 (ガイドライン §2.3.7 項番86〜125)。登録記号は検証環境用に
 * 任意の英数半角12桁の文字列を設定する (設定通知書「検証環境での確認ポイント」より)。
 */
export interface DipsPermissionApplicationUaInfo {
  /** 登録記号 (最大12文字。検証環境は任意の英数半角12桁で可) */
  regSymbol: string;
  modelCertificationBookNumber?: string;
  /** 1:第一種, 2:第二種。型式認証書番号を設定した場合必須 */
  modelCertificationType?: "1" | "2";
  aircraftCertificationBookNumber?: string;
  /** 1:第一種, 2:第二種。機体認証書番号を設定した場合必須 */
  aircraftCertificationType?: "1" | "2";
  uaMaker: string;
  uaName: string;
  /** 1:飛行機, 2:回転翼(ヘリ), 3:回転翼(マルチローター), 4:回転翼(その他), 5:滑空機, 6:飛行船 */
  uaType: "1" | "2" | "3" | "4" | "5" | "6";
  /** 総重量 (kg)。0.0001〜99999、小数点以下4桁以内 */
  uaMaxWeight: number;
  uaSerialNum: string;
  /** 機体認証・型式認証を持つ場合「1:はい」固定、いずれも未設定なら空 */
  folwSpcfctnTrmsUseEtcUmndArlVhclFlgtRgltns?: "1" | "";
  /** 基準適合性 (構造/灯火/燃料残量確認)「1:適」固定 */
  compatible1: "1";
  compatible2: "1";
  compatible3: "1";
  /** 基準適合性 (遠隔操作関係) 1:適, 3:該当せず */
  remote1: "1" | "3";
  remote2: "1" | "3";
  remote3: "1" | "3";
  remote4: "1" | "3";
  remote5: "1" | "3";
  /** 基準適合性 (自動操縦関係) 1:適, 3:該当せず */
  autopilot1: "1" | "3";
  autopilot2: "1" | "3";
  autopilot3: "1" | "3";
  /** 総重量25kg以上の場合必須「1:適」固定、それ以外は空 */
  stableFlight?: "1" | "";
  communicationImpact?: "1" | "";
  antiScattering?: "1" | "";
  recordFlight?: "1" | "";
  failSafe?: "1" | "";
  /** 「人・家屋の密集地域の上空」または「人・物件から30m未満」が true の場合必須 */
  reduceHam?: "1" | "";
  reduceHamOtherText: "";
  /** 「夜間の飛行」が true の場合必須 */
  visiblityLight?: "1" | "";
  /** 「目視外の飛行」が true の場合必須 */
  camera?: "1" | "";
  cameraOtherText: "";
  noFault?: "1" | "";
  crisis?: "1" | "";
  /** 「危険物の輸送」が true の場合必須 */
  danger?: "1" | "";
  /** 「物件投下」が true の場合必須 */
  noDropping?: "1" | "";
}

/** 許可・承認申請受付 API のレスポンス (成功時)。個人情報は含まない */
export interface DipsPermissionApplicationResult {
  /** 申請受付番号 */
  formNum: string;
}
