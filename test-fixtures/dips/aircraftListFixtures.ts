/**
 * DRS API (機体情報一覧取得, §2.3.6) レスポンスのテストフィクスチャ。
 *
 * 出典:
 * - JSON キー名: DRS API 接続システム向けガイドライン 1.2版 §2.3.6
 *   (`_orchestrator/results/quick/20260730-dips-guideline-latest-version-scout.md` で確定)
 * - コード値 (登録記号・各種ステータス・区分): 設定通知書 (R08-DRS-0005) 別紙1 の実データ
 *   (`_orchestrator/results/quick/20260727-dips-setup-notice-xlsx-extraction.md`)
 * - 機体09/10 の機体ステータス値: サマリ表と詳細表で食い違いがあったため原本を再確認した結果
 *   (`_orchestrator/results/quick/20260801-dips-annex1-aircraft-status-verify-scout.md`)。
 *   機体09=3(抹消済)・機体10=2(期限切れ) が正。
 *
 * 個人情報の扱い: 氏名・フリガナ・住所・電話番号・メールアドレス・生年月日は
 * 原本の値を一切転記せず、すべてダミー文字列に置き換えている。転記しているのは
 * 登録記号と各種コード値 (機体ステータス・抹消理由・RIDの有無 等) のみ。
 *
 * 製造者名・型式名・製造番号・重量は元の抽出レポートに個別値が含まれていなかったため、
 * 合成値 (機体番号から機械的に生成した値) を使用している。実データではない。
 *
 * 「リモートID発信方式」(別紙1 項番39) はキー名が不明 (現行ガイドラインに記載なし) の項目。
 * ここでは寛容パースの動作確認のため、あえて未定義の推測キー名で値を含めている
 * (`aircraftListSchema.ts` 側はこのキーを知らないため、パース結果からは黙って除去される)。
 */

interface RawAircraftEntry {
  aircraft_information: Record<string, unknown>;
  owner_information: Record<string, unknown>;
  user_information: Record<string, unknown>;
  /** ガイドラインが将来キーを追加してもパースが壊れないことを示すためのダミー拡張フィールド */
  future_extension_field: null;
}

const VALID_PERIOD = {
  // 全機体共通の値。機体10 (期限切れ) も同じ値が入っており、ステータス値のみで
  // 区別されている (設定通知書の実データ仕様どおり)。
  effectiveness_period_self: "2025-06-20T00:00:00+09:00",
  effectiveness_period_to: "2028-06-19T00:00:00+09:00",
};

interface AircraftSpec {
  no: string;
  registrationCode: string;
  manufacturingCategory: number;
  aircraftType: number;
  status: number;
  eraseReason: number | "";
  eraseReasonOther: string;
  ridType: number;
  mustHaveRid: number;
  writeStatus: number;
  ownerClassification: number;
  ownerUserSame: number;
  userClassification: number | "";
}

/** 別紙1「機体情報詳細」機体01〜18 の実データ (登録記号・各種コード値) */
const AIRCRAFT_SPECS: AircraftSpec[] = [
  {
    no: "01",
    registrationCode: "JU1219043018",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 2,
    userClassification: 1,
  },
  {
    no: "02",
    registrationCode: "JU2219043027",
    manufacturingCategory: 1,
    aircraftType: 2,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 1,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "03",
    registrationCode: "JU3219043036",
    manufacturingCategory: 1,
    aircraftType: 3,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 1,
    ownerClassification: 1,
    ownerUserSame: 2,
    userClassification: 9,
  },
  {
    no: "04",
    registrationCode: "JU4219043045",
    manufacturingCategory: 2,
    aircraftType: 4,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 1,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "05",
    registrationCode: "JU5219043054",
    manufacturingCategory: 2,
    aircraftType: 5,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "06",
    registrationCode: "JU6219043063",
    manufacturingCategory: 2,
    aircraftType: 6,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "07",
    registrationCode: "JU1219043070",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 0,
    mustHaveRid: 2,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "08",
    registrationCode: "JU1219043083",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: 1,
  },
  {
    no: "09",
    registrationCode: "JU1219043097",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 5,
    eraseReasonOther: "その他抹消理由",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: "",
  },
  {
    no: "10",
    registrationCode: "JU1219043100",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 2,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: "",
  },
  {
    no: "11",
    registrationCode: "JU1219043114",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 1,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 1,
    ownerUserSame: 1,
    userClassification: "",
  },
  {
    no: "12",
    registrationCode: "JU1219043128",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 1,
    eraseReason: "",
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "13",
    registrationCode: "JU1219043131",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 1,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "14",
    registrationCode: "JU1219043145",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 2,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "15",
    registrationCode: "JU1219043159",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 3,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "16",
    registrationCode: "JU1219043162",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 4,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "17",
    registrationCode: "JU1219043176",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 6,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
  {
    no: "18",
    registrationCode: "JU1219043180",
    manufacturingCategory: 1,
    aircraftType: 1,
    status: 3,
    eraseReason: 7,
    eraseReasonOther: "",
    ridType: 2,
    mustHaveRid: 1,
    writeStatus: 0,
    ownerClassification: 2,
    ownerUserSame: 1,
    userClassification: 9,
  },
];

function findSpec(no: string): AircraftSpec {
  const spec = AIRCRAFT_SPECS.find((s) => s.no === no);
  if (!spec) throw new Error(`未定義の機体番号です (テストフィクスチャの不整合): ${no}`);
  return spec;
}

/** 個人所有者のダミー情報 (原本の氏名・住所等は一切含まない合成値) */
function individualOwnerInformation(no: string): Record<string, unknown> {
  return {
    owner_classification: 1,
    owner_fullname: `ダミー所有者${no}`,
    owner_furigana: `ダミーショユウシャ${no}`,
    owner_corporation_number: "",
    owner_corporation_name: "",
    owner_corporation_representative_name: "",
    owner_country_code: "001",
    owner_prefecture_code: "13",
    owner_address: `ダミー住所${no}`,
    owner_headoffice_location_country_code: "",
    owner_headoffice_location_prefecture_code: "",
    owner_headoffice_location_address: "",
    owner_department_name: "",
    owner_birthday: "1990/01/01",
    owner_country_code_tel: "081",
    owner_tel: "00000000000",
    owner_email_address: `dummy-owner-${no}@example.test`,
  };
}

/** 法人所有者のダミー情報 (原本の企業名・代表者名等は一切含まない合成値) */
function corporateOwnerInformation(no: string): Record<string, unknown> {
  return {
    owner_classification: 2,
    owner_fullname: `ダミー担当者${no}`,
    owner_furigana: `ダミータントウシャ${no}`,
    owner_corporation_number: "1000000000000",
    owner_corporation_name: `ダミー株式会社${no}`,
    owner_corporation_representative_name: `ダミー代表${no}`,
    owner_country_code: "001",
    owner_prefecture_code: "13",
    owner_address: `ダミー本店住所${no}`,
    owner_headoffice_location_country_code: "001",
    owner_headoffice_location_prefecture_code: "13",
    owner_headoffice_location_address: `ダミー本店住所${no}`,
    owner_department_name: `ダミー部署${no}`,
    owner_birthday: "",
    owner_country_code_tel: "081",
    owner_tel: "00000000000",
    owner_email_address: `dummy-corp-owner-${no}@example.test`,
  };
}

/** 使用者情報のダミー情報。使用者種別が空文字の場合は所有者と同一のため他項目も空とする */
function userInformation(spec: AircraftSpec): Record<string, unknown> {
  if (spec.userClassification === "") {
    return {
      owner_user_same_confirmation: spec.ownerUserSame,
      user_classification: "",
      user_fullname: "",
      user_furigana: "",
      user_corporation_number: "",
      user_corporation_name: "",
      user_corporation_representative_name: "",
      user_country_code: "",
      user_prefecture_code: "",
      user_address: "",
      user_headoffice_location_country_code: "",
      user_headoffice_location_prefecture_code: "",
      user_headoffice_location_address: "",
      user_department_name: "",
      user_country_code_tel: "",
      user_tel: "",
      user_email_address: "",
    };
  }
  const isCorporate = spec.userClassification === 9;
  return {
    owner_user_same_confirmation: spec.ownerUserSame,
    user_classification: spec.userClassification,
    user_fullname: `ダミー使用者${spec.no}`,
    user_furigana: `ダミーシヨウシヤ${spec.no}`,
    user_corporation_number: isCorporate ? "2000000000000" : "",
    user_corporation_name: isCorporate ? `ダミー使用者法人${spec.no}` : "",
    user_corporation_representative_name: isCorporate ? `ダミー使用者代表${spec.no}` : "",
    user_country_code: "001",
    user_prefecture_code: "13",
    user_address: `ダミー使用者住所${spec.no}`,
    user_headoffice_location_country_code: isCorporate ? "001" : "",
    user_headoffice_location_prefecture_code: isCorporate ? "13" : "",
    user_headoffice_location_address: isCorporate ? `ダミー使用者本店住所${spec.no}` : "",
    user_department_name: isCorporate ? `ダミー使用者部署${spec.no}` : "",
    user_country_code_tel: "081",
    user_tel: "00000000000",
    user_email_address: `dummy-user-${spec.no}@example.test`,
  };
}

function aircraftInformation(spec: AircraftSpec): Record<string, unknown> {
  return {
    registration_code: spec.registrationCode,
    // 実データの個別値は抽出レポートに含まれていないため機械生成した合成値
    manufacturing_number: spec.no === "03" ? "MANUFACT000000000003" : `MANUFACT${spec.no}`,
    manufacturing_category: spec.manufacturingCategory,
    aircraft_type: spec.aircraftType,
    manufacturer_jpn: `サンプル製造者${spec.no}`,
    model_jpn: `サンプル型式${spec.no}`,
    manufacturer_eng: `Sample Maker ${spec.no}`,
    model_eng: `Sample Model ${spec.no}`,
    // 機体01のみガイドライン記載例の値 (24.0001kg) を使用し、kg→g丸めのテストに使う
    aircraft_weight: spec.no === "01" ? 24.0001 : 1.5 + Number(spec.no) * 0.1,
    weight_classification: 1,
    maximum_takeoff_weight: spec.no === "01" ? 25.0 : 2.0 + Number(spec.no) * 0.1,
    aircraft_width: 1.0,
    aircraft_length: 1.0,
    aircraft_height: 0.5,
    remodeling_type: 2,
    remodeling_summary: "",
    safety_confirmation_check1: "",
    safety_confirmation_check2: "",
    safety_confirmation_check3: "",
    safety_confirmation_check4: "",
    safety_confirmation_check5: "",
    aircraft_status: spec.status,
    erase_reason_number: spec.eraseReason,
    erase_reason_other: spec.eraseReasonOther,
    last_update_date: "2025-06-20T00:00:00+09:00",
    ...VALID_PERIOD,
    rid_type: spec.ridType,
    rid_manufacturer_jpn: spec.ridType === 0 ? "" : `サンプル製造者${spec.no}`,
    rid_model_jpn: spec.ridType === 0 ? "" : `サンプル型式${spec.no}`,
    rid_manufacturer_eng: spec.ridType === 0 ? "" : `Sample Maker ${spec.no}`,
    rid_model_eng: spec.ridType === 0 ? "" : `Sample Model ${spec.no}`,
    rid_manufacturing_number: spec.ridType === 0 ? "" : `MANUFACT${spec.no}`,
    must_have_rid: spec.mustHaveRid,
    modified_date: "",
    write_status: spec.writeStatus,
    // 「リモートID発信方式」(別紙1 項番39) はキー名不明のため、寛容パース確認用に
    // 未定義の推測キーで値を含めている (aircraftListSchema.ts はこのキーを知らない)
    remote_id_broadcast_method: 1,
  };
}

function buildEntry(no: string): RawAircraftEntry {
  const spec = findSpec(no);
  return {
    aircraft_information: aircraftInformation(spec),
    owner_information:
      spec.ownerClassification === 2
        ? corporateOwnerInformation(spec.no)
        : individualOwnerInformation(spec.no),
    user_information: userInformation(spec),
    future_extension_field: null,
  };
}

/** アカウントA: 個人・複数機 (機体01〜07,09,10)。機体08はアカウントB、機体11はアカウントDへ移管済みのため含まない */
export const accountAResponse: RawAircraftEntry[] = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "09",
  "10",
].map(buildEntry);

/** アカウントB: 個人・1機 (機体08) */
export const accountBResponse: RawAircraftEntry[] = ["08"].map(buildEntry);

/** アカウントC: 機体を1件も所有しない個人アカウント */
export const accountCResponse: RawAircraftEntry[] = [];

/** アカウントD: 法人・複数機 (機体12〜18)。機体11はアカウントAから移管され、アカウントDの機体として返る */
export const accountDResponse: RawAircraftEntry[] = [
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
].map(buildEntry);

/**
 * 個人情報が正規化後に残らないことを証明するための単独フィクスチャ。
 * 所有者・使用者ブロックに識別しやすいダミー PII 文字列 ("PIIプローブ...") を入れている。
 */
export const piiProbeResponse: RawAircraftEntry[] = [
  {
    aircraft_information: aircraftInformation(findSpec("01")),
    owner_information: {
      ...individualOwnerInformation("01"),
      owner_fullname: "PIIプローブ所有者",
      owner_furigana: "ピーアイアイプローブショユウシャ",
      owner_address: "PIIプローブ所有者住所",
      owner_birthday: "1999/09/09",
      owner_tel: "09099999999",
      owner_email_address: "pii-probe-owner@example.test",
    },
    user_information: {
      ...userInformation({ ...findSpec("01"), userClassification: 1 }),
      user_fullname: "PIIプローブ使用者",
      user_furigana: "ピーアイアイプローブシヨウシヤ",
      user_address: "PIIプローブ使用者住所",
      user_tel: "08088888888",
      user_email_address: "pii-probe-user@example.test",
    },
    future_extension_field: null,
  },
];
