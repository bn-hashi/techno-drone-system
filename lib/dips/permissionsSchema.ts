import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import type { DipsPermissionInfo } from "@/lib/dips/types";
import {
  describeReceivedType,
  normalizeEntriesWithDiagnostics,
} from "@/lib/dips/normalizeEntriesWithDiagnostics";

/**
 * 許可・承認情報取得 API (DIPS2.0 API(FPA) 接続システム向けガイドライン 2.3.6) の
 * 生レスポンスを検証・正規化する境界。`lib/dips/aircraftListSchema.ts` と同じ構造
 * (5-3/5-4/5-5 もこの2ファイルの形を踏襲すること)。エントリ単位のフォールバック・
 * ログ・全件失敗時の DipsApiError は `lib/dips/normalizeEntriesWithDiagnostics.ts` の
 * 共通エンジンへ委譲する (2026-08-28 段階2共通化)。
 *
 * キーのリネームが不要な理由: 機体情報一覧取得 API (DRS 系) は生キーが snake_case
 * (registration_code 等) で、正規化時に camelCase (regSymbol 等) へ変換していた。
 * 一方このレスポンスサンプル (設定通知書 R08-DRS-0005 別紙3) は生キーの時点で既に
 * camelCase (permissionNumber 等) であり、`DipsPermissionInfo` (lib/dips/types.ts) の
 * フィールド名と1:1で一致する。そのため toAircraftInfo() に相当するマッピング関数は
 * 置かず、Zod の推論型をそのまま DipsPermissionInfo として扱う。将来 API 側のキー体系が
 * 変わった場合は、このファイルにマッピング関数を追加すること。
 *
 * 個人情報の遮断点: 別紙3のレスポンスサンプルに氏名・住所等の個人情報フィールドは
 * 現れないが、念のため z.object() の既定動作 (strip: 未定義キーを自動除去) に委ね、
 * .strict() は使わない。スキーマに書いていないキーは、将来レスポンスに追加されても
 * 自動的に破棄される。
 *
 * null・欠落の寛容化 (2026-08-26 差し戻し B1〜B4 で拡張): 当初は permissionNumber2 のみに
 * 限定していたが、実機検証で以下の3点が「アカウント全体が502で落ちる」実害につながる
 * ことが分かったため、寛容化の対象を広げた:
 * - **boolean フラグ9個**: このコードベースの DIPS boolean 慣習は `"1"`/`"0"` の文字列
 *   (`lib/dips/types.ts` の `riskMitigationOnsiteControl: string`、
 *   `services/dipsService.ts` が送信時に boolean → `"1"`/`"0"` へ変換している対称)。
 *   DIPS が `"1"`/`"0"` を返すと `z.boolean()` が全エントリを弾いていたため、
 *   boolean と `"1"`/`"0"` の両方を受理して boolean へ正規化する (`flexibleBoolean`)
 * - **`permissions` 本体・`flightRoutes`・`uaInfos`**: null・キー欠落を空配列として扱う。
 *   空アカウントが `{}` や `{ "permissions": null }` を返すと、既存の「許可・承認情報が
 *   ありません」という正当な空状態の分岐に到達できず 502 になっていた
 * - **`permissionNumber2`**: 空文字・null・キー欠落のいずれも null に正規化する
 *   (以前は null/undefined しか変換しておらず、JSDoc の契約と実装がずれていた)
 *
 * それ以外のフィールド (受付番号・許可期間等の文字列) は検証環境への事前到達ができず
 * 実際の挙動が未確認なので、機体情報一覧取得 API のときのように「不正な値は落として
 * 安全な既定値に丸める」のではなく、まずは要求どおりの形を求め、想定外の値が来た
 * エントリはエントリ単位のフォールバックで除外するに留める (安全な既定値を捏造しない)。
 * 本番疎通確認でさらに寛容化が必要とわかった場合は、機体情報一覧取得 API
 * (2026-08-10 差し戻し) のときと同じ要領で個別に広げること。
 *
 * 2026-08-28 差し戻し (2回目) での追加変更:
 * - **F1: `permissions` キー欠落と明示的な null/[] を区別する**。B2 の寛容化は
 *   キー欠落 (仕様変更・接続先誤りの疑い) までも「正当なゼロ件」として飲み込んでしまい、
 *   A3 でクライアント境界を固めて潰したはずの「キー名変更が0件として静かに成功する」
 *   失敗モードをサーバー境界で復活させていた。`permissions` キーそのものが無い場合は
 *   DipsApiError を投げ、明示的な `null`・`[]` は引き続き正当なゼロ件として扱う
 *   (詳細は `extractPermissionsArray` のコメント参照)
 * - **F4: boolean フラグが数値 `1`/`0` も受理する**。`aircraftListSchema.ts` の
 *   RAW_CODE (`z.union([z.string(), z.number()])`) と寛容度を揃えていなかったため、
 *   DIPS が数値の `1`/`0` を返す経路だけ弾かれていた
 * - **F5: 画面に表示しないフィールドで許可を落とさない**。`permissionDate` /
 *   `flightRoutes[].routeName` / `routeLatlons` は `DipsPermissionsPanel.tsx` が
 *   画面に一切出していないにもかかわらず必須文字列で厳格検証しており、そこが想定外の
 *   型なだけで許可1件が丸ごと除外されていた。表示に使う値 (受付番号・許可期間・
 *   飛行場所・機体情報・boolean フラグ) は従来どおり厳格に検証し、想定外の値が来た
 *   エントリはエントリ単位のフォールバックで除外する方針を維持する
 *
 * 2026-09-02 差し戻し (H1): F5 で `permissionDate`/`flightRoutes` を `z.unknown()` の
 * まま `.transform()` していたが、Zod v4 は `z.object()` 内の `z.unknown()` のキーも
 * (値が undefined を許容する型であっても) 必須キー扱いにするため、キー自体が無い
 * レスポンスでは F5 が防ぐはずだった「許可が丸ごと除外される」失敗が再発していた
 * (全許可が失敗するとアカウント全体が502になる)。`.nullish()` を `.transform()` の前に
 * 挟み、`nullableArray` と同じ形に揃えた (詳細は `unusedDisplayString` / `flightRoutesField`
 * のコメント参照)。
 */

/** 空文字・null・キー欠落を null に正規化する (permissionNumber2 用) */
const nullableString = z
  .string()
  .nullish()
  .transform((value) => (value === null || value === undefined || value === "" ? null : value));

/** null・キー欠落を空配列として扱う (permissions/flightRoutes/uaInfos 用) */
function nullableArray<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .array(itemSchema)
    .nullish()
    .transform((value) => value ?? []);
}

/**
 * DIPS の boolean 慣習 (`"1"`/`"0"` の文字列、または数値の `1`/`0`) と素の boolean を
 * 受理し、boolean へ正規化する。`services/dipsService.ts` が送信時に boolean →
 * `"1"`/`"0"` へ変換しているのと対称的に、受信時も両方の形を受け付ける (B1 差し戻し:
 * `"1"`/`"0"` を z.boolean() が全エントリで弾き、アカウントごと 502 になっていた)。
 * 数値の `1`/`0` も受理するのは `aircraftListSchema.ts` の RAW_CODE
 * (`z.union([z.string(), z.number()])`) と寛容度を揃えるため (F4 差し戻し:
 * 文字列の `"1"`/`"0"` しか受理しておらず、数値で返る経路だけ弾かれていた)。
 */
const flexibleBoolean = z
  .union([z.boolean(), z.enum(["1", "0"]), z.literal(1), z.literal(0)])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    return value === "1" || value === 1;
  });

/**
 * 画面に一切表示しないフィールド (`permissionDate`) 用。想定外の型でもエントリ (許可)
 * 自体を落とさず null に丸める (F5 差し戻し: 表示に使わないフィールドを他の文字列項目と
 * 同じ厳格さ (z.string() 必須) で検証しており、そこが想定外の型なだけで許可1件が丸ごと
 * 除外されていた)。表示に使うフィールド (受付番号・許可期間・飛行場所) は
 * 引き続き z.string() で厳格に検証し、想定外の値が来たエントリはエントリ単位の
 * フォールバックで除外する方針を維持する。
 *
 * **`.nullish()` を `.transform()` の前に置く理由 (2026-09-02 差し戻し H1)**: Zod v4 は
 * `z.object()` 内の `z.unknown()` のキーを (値が undefined を許容する型であっても)
 * 必須キー扱いにするため、`z.unknown().transform(...)` のままだと DIPS が
 * `permissionDate` キー自体を返さないレスポンスで `invalid_type: expected nonoptional`
 * となり、F5 が防ぐはずだった「許可1件が丸ごと除外される」失敗モードがキー欠落の
 * 経路でだけ再発していた (全許可が失敗すると `normalizeEntriesWithDiagnostics` が
 * `DipsApiError` を投げ、アカウント全体が502になる)。`.nullish()` を挟むとキー自体を
 * 省略可能にでき、かつ `.transform()` は値が `undefined` でも必ず呼ばれるため出力オブジェ
 * クトにはキーが常に載る (`null` として)。下の `nullableArray` (`uaInfos` 用) も同じ形
 * (`.nullish()` → `.transform()`) を既に使っており、ここもそれに揃える。
 */
const unusedDisplayString = z
  .unknown()
  .nullish()
  .transform((value) => (typeof value === "string" ? value : null));

const FlightRouteSchema = z.object({
  routeName: z.string(),
  routeLatlons: z.array(z.string()),
});

/**
 * `flightRoutes` は `DipsPermissionsPanel.tsx` が画面に一切表示しないフィールドである。
 * 1経路のパース失敗で許可全体を落とすのは不釣り合いなため (F5 差し戻し)、経路単位で
 * safeParse し、パースできた経路だけを残す (許可・承認情報自体のエントリ単位
 * フォールバックと同じ考え方を、その内側の配列にも適用している)。パースできない経路は
 * 個人情報を含まないため黙って落としてよく、ログ・除外件数の対象も許可エントリ単位に
 * 留める (経路単位までは広げない)。
 */
function parseFlightRoutesLeniently(value: unknown): z.infer<typeof FlightRouteSchema>[] {
  const arrayResult = z.array(z.unknown()).nullish().safeParse(value);
  if (!arrayResult.success || !arrayResult.data) return [];

  const routes: z.infer<typeof FlightRouteSchema>[] = [];
  for (const rawRoute of arrayResult.data) {
    const result = FlightRouteSchema.safeParse(rawRoute);
    if (result.success) routes.push(result.data);
  }
  return routes;
}

// `.nullish()` を `.transform()` の前に置く理由は `unusedDisplayString` のコメント参照
// (2026-09-02 差し戻し H1: Zod v4 は z.unknown() のキーも必須扱いにするため、
// flightRoutes キー自体が無いレスポンスで許可が丸ごと除外されていた)。
const flightRoutesField = z.unknown().nullish().transform(parseFlightRoutesLeniently);

const UaInfoSchema = z.object({
  uaMaker: z.string(),
  uaName: z.string(),
  regSymbol: z.string(),
});

const PermissionEntrySchema = z.object({
  permissionNumber: z.string(),
  permissionNumber2: nullableString,
  receptionNumber: z.string(),
  permissionDate: unusedDisplayString,
  permissionPeriodStart: z.string(),
  permissionPeriodEnd: z.string(),
  flightLocation: z.string(),
  flightRoutes: flightRoutesField,
  aboveDenselyInhabitedDistricts: flexibleBoolean,
  moreThan150mAboveTheGround: flexibleBoolean,
  aroundAirports: flexibleBoolean,
  lessThan30m: flexibleBoolean,
  overEventSites: flexibleBoolean,
  nightOperation: flexibleBoolean,
  beyondVisualLineOfSight: flexibleBoolean,
  transportHazardousMaterials: flexibleBoolean,
  dropObjects: flexibleBoolean,
  uaInfos: nullableArray(UaInfoSchema),
});

/**
 * `permissions` の値そのもの (配列 または null) を検証するスキーマ。キーの存在確認は
 * `extractPermissionsArray` が別途行う (このスキーマだけでは「値が undefined」と
 * 「キー自体が無い」を区別できないため)。
 */
const PermissionsValueSchema = z.array(z.unknown()).nullable();

/**
 * 正規化結果と、除外したエントリ件数をあわせて返す。件数だけを上位層 (API レスポンス →
 * UI) へ伝えることで、「許可情報0件」と「一部の許可情報が異常値で除外された」を UI 側で
 * 区別できるようにする (機体情報一覧取得 API の C3 対応と同じ考え方)。
 */
export interface NormalizePermissionsResult {
  permissions: DipsPermissionInfo[];
  /** パースに失敗して除外した許可の件数 (個人情報を含む生の値は保持しない) */
  excludedCount: number;
}

/**
 * 生レスポンスから `permissions` 配列を取り出す。以下を区別する (F1 差し戻し):
 * - `permissions` キー自体が存在しない → 仕様変更・接続先誤りの疑いとして DipsApiError
 *   を投げる (B2 の寛容化が、A3 でクライアント境界を固めて潰したはずの「キー名変更が
 *   0件として静かに成功する」失敗モードをサーバー境界で復活させていたことへの対処)
 * - `permissions` が明示的に `null` または `[]` → 「許可・承認情報なし」の正当な空状態
 *   として空配列を返す
 * - `permissions` が上記以外の不正な値 (配列でも null でもない) → DipsApiError を投げる
 *
 * オブジェクトが `permissions` プロパティを持つかどうかは `hasOwnProperty` で直接確認する
 * (Zod の `.nullable()` は「値が undefined」と「キー自体が無い」のどちらも `undefined` として
 * 扱われ、両者を区別できないため)。
 */
function extractPermissionsArray(raw: unknown): unknown[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new DipsApiError(
      `DIPS許可・承認情報のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`
    );
  }

  if (!Object.prototype.hasOwnProperty.call(raw, "permissions")) {
    throw new DipsApiError(
      "DIPS許可・承認情報のレスポンスに permissions キーが存在しません (仕様変更またはDIPS接続先の誤りの疑いがあります)"
    );
  }

  const rawPermissionsValue = (raw as Record<string, unknown>).permissions;
  const shapeResult = PermissionsValueSchema.safeParse(rawPermissionsValue);
  if (!shapeResult.success) {
    throw new DipsApiError(
      `DIPS許可・承認情報のレスポンス形式が不正です (permissions の値が不正です。受信した型: ${describeReceivedType(rawPermissionsValue)})`
    );
  }

  return shapeResult.data ?? [];
}

/**
 * 許可・承認情報取得 API の生レスポンスを検証し、DipsPermissionInfo[] へ正規化する。
 * 除外した許可の件数も併せて返す (`excludedCount`)。
 *
 * エントリ単位のフォールバック・ログ・全件失敗時の DipsApiError は共通エンジン
 * (`normalizeEntriesWithDiagnostics`) に委譲する。
 *
 * `permissions` が明示的な `null` または `[]` の場合は「許可情報なし」の正当な応答のため、
 * そのまま [] を返す (キー欠落とは区別する。詳細は `extractPermissionsArray` 参照)。
 * エラーメッセージには Zod のキー名または受信した型名のみを含め、受信値 (個人情報を
 * 含みうる) は一切含めない。
 */
export function normalizePermissionsWithDiagnostics(raw: unknown): NormalizePermissionsResult {
  const { entries, excludedCount } = normalizeEntriesWithDiagnostics(raw, {
    entrySchema: PermissionEntrySchema,
    extractArray: extractPermissionsArray,
    subject: "DIPS許可・承認情報",
    route: "normalizePermissions",
  });

  return { permissions: entries, excludedCount };
}
