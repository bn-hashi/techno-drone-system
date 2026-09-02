import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type {
  DipsPermissionApplicationPayload,
  DipsPermissionApplicationPilotInfo,
  DipsPermissionApplicationUaInfo,
  DipsPermissionApplicationResult,
} from "@/lib/dips/types";

/**
 * 許可・承認申請受付 API (5-3, DIPS2.0 API(FPA) 接続システム向けガイドライン v1.5 §2.3.7)
 * のレスポンス検証と、検証環境向けテスト申請 payload の組み立て。
 *
 * このシステムは疎通確認 (検証環境で任意の申請を送信し、申請受付番号が取得できることの
 * 確認) のみを目的とし、申請内容を入力する UI は持たない。設定通知書「検証環境での
 * 確認ポイント」(シート2 D35/E35) に「リクエストボディの設定条件に準じた任意の申請を
 * 行い、申請受付番号が取得できること」「他項目で値が不明な場合は、DIPS API接続システム
 * 向けガイドラインのリクエストボディサンプルの値を参考に設定すること」と明記されている
 * ため、ガイドライン自身のリクエストボディサンプルの値をそのまま用いる (推測で値を
 * 埋めない)。氏名等のテスト値もガイドライン (公開PDF) 自身のダミー値であり、実在人物の
 * 情報ではない。
 *
 * ⚠️ 申請可能地域の制約 (設定通知書シート2 D16/E16): 許可・承認申請受付用の検証用
 * 申請者IDは住所が東京で設定されているため、飛行場所が日本全国または東京航空局・
 * 大阪航空局の両管轄都道府県を含む申請は東京航空局宛にする必要がある (大阪航空局宛は
 * エラーになる)。このため飛行場所は東京都のみ (flyLocation: "3", keninfo: ["13"]) に
 * 限定し、提出先は東京航空局固定 (destinationKbn: "01", destinationCode: "ECAB") とする
 * (ガイドラインのリクエストボディサンプルもこの組み合わせになっている)。
 */

const JST_OFFSET_MINUTES = 9 * 60;

/**
 * 飛行する期間の開始日までのオフセット (日)。当日開始だと審査猶予がなく却下される
 * 懸念があるため翌日からにする (公式ルールではなく安全マージンとしての判断)。
 */
const APPLICATION_START_OFFSET_DAYS = 1;
/**
 * 飛行する期間の長さ (日)。ガイドラインのリクエストボディサンプルは約4ヶ月間だが、
 * 疎通確認用途のため90日に短縮する (期間の長さ自体に業務上の制約はガイドラインに
 * 記載がない)。
 */
const APPLICATION_PERIOD_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** "YYYY/MM/DD" (JST) 形式にフォーマットする (ガイドライン 2.3.7 formStart/formEnd 用) */
function formatDipsDateSlash(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MINUTES * 60_000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

/**
 * 申請書操縦者情報 (ガイドラインのリクエストボディサンプルの値そのまま)。氏名等は
 * ガイドライン (公開PDF) 自身のテスト用ダミー値であり、実在人物の情報ではない。
 */
function buildTestPilotInfo(): DipsPermissionApplicationPilotInfo {
  return {
    pilotName: "試験 太郎",
    pilotNamekana: "シケンタロウ",
    pilotCountryCode: "001",
    pilotPrefectureCode: "13",
    pilotAddress: "テストユーザ住所",
    pilotCountryCodeTel: "001",
    pilotPhoneNumber: "09012345678",
    pilotMailAddress: "abc@test.co.jp",
    skillCertificateNumber: "",
    pilotCareer10Hour: "1",
    pilotKnowledge: "1",
    pilotSkill: "1",
    pilotRemoteskill: "1",
    pilotAutopilotskill: "1",
    addStdRotorNightFly: "",
    addStdRotorOutsideFly: "",
    addStdRotorDrop: "",
    addStdAirplaneNightFly: "",
    addStdAirplaneOutsideFly: "",
    addStdAirplaneDrop: "",
    addStdGlidersNightFly: "",
    addStdGlidersOutsideFly: "",
    addStdGlidersDrop: "",
    addStdAirshipNightFly: "",
    addStdAirshipOutsideFly: "",
    addStdAirshipDrop: "",
    flightModeSafty: "",
    formDroneMaker: "TEST DRONE",
    formDroneName: "DRONE 1",
  };
}

/**
 * 申請書機体情報 (ガイドラインのリクエストボディサンプルの値そのまま)。登録記号は
 * 設定通知書「検証環境での確認ポイント」により「任意の英数半角12桁の文字列」でよいと
 * 明記されているため、ガイドラインのサンプル値をそのまま使う。
 */
function buildTestUaInfo(): DipsPermissionApplicationUaInfo {
  return {
    regSymbol: "JU121678901Z",
    modelCertificationBookNumber: "1234-56",
    modelCertificationType: "2",
    aircraftCertificationBookNumber: "R0412345602",
    aircraftCertificationType: "2",
    uaMaker: "TEST DRONE",
    uaName: "DRONE 1",
    uaType: "3",
    uaMaxWeight: 3.4,
    uaSerialNum: "1234",
    folwSpcfctnTrmsUseEtcUmndArlVhclFlgtRgltns: "1",
    compatible1: "1",
    compatible2: "1",
    compatible3: "1",
    remote1: "1",
    remote2: "1",
    remote3: "1",
    remote4: "1",
    remote5: "1",
    autopilot1: "1",
    autopilot2: "1",
    autopilot3: "1",
    stableFlight: "",
    communicationImpact: "",
    antiScattering: "",
    recordFlight: "",
    failSafe: "",
    reduceHam: "1",
    reduceHamOtherText: "",
    visiblityLight: "",
    camera: "",
    cameraOtherText: "",
    noFault: "",
    crisis: "",
    danger: "",
    noDropping: "",
  };
}

/**
 * 検証環境で疎通確認するための申請 payload を組み立てる。ガイドライン (DIPS2.0
 * API(FPA) v1.5 §2.3.7) 自身のリクエストボディサンプルの値をそのまま用い、飛行期間
 * (formStart/formEnd) のみ「翌日から90日間」に計算し直す (サンプルの日付は過去日の
 * ため、そのまま送ると期限切れ等の理由で却下される懸念があるため)。
 *
 * `now` は既定で現在時刻だが、テストで日付を固定できるよう引数として受け取る。
 */
export function buildPermissionApplicationTestPayload(
  now: Date = new Date()
): DipsPermissionApplicationPayload {
  const formStart = addDays(now, APPLICATION_START_OFFSET_DAYS);
  const formEnd = addDays(formStart, APPLICATION_PERIOD_DAYS);

  return {
    formKind: "1",
    category: "2",
    airShot: true,
    news: true,
    guard: true,
    maff: false,
    survey: true,
    research: true,
    facilityMaint: true,
    infra: false,
    materia: false,
    transport: false,
    nature: false,
    accident: false,
    otherGyomu: false,
    hobby: false,
    rschAndDvlpmt: false,
    otherGyomugai: false,
    ostCtrlMsrsPlcmtOfAsstsExstnc: true,
    ostCtrlMsrsSetAccsCtrlAraExstnc: false,
    ostCtrlMsrsSetOflmtsZnExstnc: false,
    ostCtrlMsrsSetAccsCtrlAraLevel3Exstnc: false,
    ostCtrlMsrsSetAccsCtrlAraLevel35Exstnc: false,
    ostCtrlMsrsOtherExstnc: false,
    aboveDenselyInhabitedDistricts: true,
    aboveDenselyInhabitedDistrictsCode: "001",
    lessThan30m: true,
    lessThan30mCode: "001",
    nightOperation: false,
    nightOperationCode: "",
    beyondVisualLineOfSight: false,
    beyondVisualLineOfSightCode: "",
    transportHazardousMaterials: false,
    transportHazardousMaterialsCode: "",
    dropObjects: false,
    dropObjectsCode: "",
    moreThan150mAboveTheGround: false,
    aroundAirports: false,
    overEventSites: false,
    annualFlight: "2",
    formStart: formatDipsDateSlash(formStart),
    formEnd: formatDipsDateSlash(formEnd),
    flightRouteSpecific: "1",
    flyLocation: "3",
    destinationKbn: "01",
    destinationCode: "ECAB",
    keninfo: ["13"],
    manual: "1",
    cvlAvtnBruStddMnl01: false,
    cvlAvtnBruStddMnl02: true,
    cvlAvtnBruStddMnlArlSpry: false,
    cvlAvtnBruStddMnlRschAdDvlpmt: false,
    cvlAvtnBruStddMnl01InfrstrteInspcn: false,
    cvlAvtnBruStddMnl02InfrstrteInspcn: false,
    pilotInfos: [buildTestPilotInfo()],
    uaInfos: [buildTestUaInfo()],
    insurance: "DIPS 損保（株）",
    productName: "ドローン飛行保証",
    interPerson: 10000000,
    interObject: 5000000,
    cmpstnAblty: "1",
    emergencyTel: "緊急連絡先担当者氏名",
    countryCodeTel: "001",
    tel: "09876543210",
    permissionForm: "1",
  };
}

const PermissionApplicationResultSchema = z.object({
  formNum: z.string(),
});

/**
 * 許可・承認申請受付 API のレスポンス (成功時) を検証する。共通エンジン
 * (`normalizeEntriesWithDiagnostics`) は配列レスポンス向けのため、単一オブジェクト
 * (`{ formNum: string }` のみ) であるここでは使わない。個人情報を一切含まない
 * シンプルな形状のため、専用の Zod 検証で十分と判断した。
 */
export function normalizePermissionApplicationResult(
  raw: unknown
): DipsPermissionApplicationResult {
  const result = PermissionApplicationResultSchema.safeParse(raw);
  if (!result.success) {
    throw new DipsApiError("DIPS許可・承認申請受付のレスポンス形式が不正です (formNum が取得できません)");
  }
  return result.data;
}
