import { z } from "zod";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";
import type { DipsPermissionInfo } from "@/lib/dips/types";

/**
 * 許可・承認情報取得 API (DIPS2.0 API(FPA) 接続システム向けガイドライン 2.3.6) の
 * 生レスポンスを検証・正規化する境界。`lib/dips/aircraftListSchema.ts` と同じ構造
 * (5-3/5-4/5-5 もこの2ファイルの形を踏襲すること)。
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
 * エントリ単位のフォールバック: レスポンスは複数許可の配列 (`permissions`) で返るが、
 * そのうち1件のパースが失敗しても他の許可の取得を妨げない (本番疎通確認は IP 制限で
 * 実質1回勝負のため、1件の異常値でアカウント全体が 502 になる事態を避ける)。配列全体
 * ではなくエントリ単位で safeParse し、パースできた許可だけを返す。落としたエントリは
 * 個人情報を含まない形 (配列内インデックスと Zod のパスのみ) で構造化ログに残す。
 * 全件が失敗した場合はレスポンス仕様そのものが変わった可能性が高いため、空配列を返さず
 * DipsApiError を投げる (詳細は normalizePermissionsWithDiagnostics のコメント参照)。
 *
 * null 寛容化は permissionNumber2 のみに限定している: レスポンスサンプルで唯一
 * 明示的に null 値が示されているフィールドのため。他のフィールドは検証環境への
 * 事前到達ができず実際の挙動が未確認なので、機体情報一覧取得 API のときのように
 * 「不正な値は落として安全な既定値に丸める」のではなく、まずは要求どおりの形を求め、
 * 想定外の値が来たエントリはエントリ単位のフォールバックで除外するに留める
 * (安全な既定値を捏造しない)。本番疎通確認で他のフィールドにも null 寛容化が必要と
 * わかった場合は、機体情報一覧取得 API (2026-08-10 差し戻し) のときと同じ要領で
 * 個別に広げること。
 */

/** 空文字・null・キー欠落を null に正規化する (permissionNumber2 用) */
const nullableString = z
  .string()
  .nullish()
  .transform((value) => (value === null || value === undefined ? null : value));

const FlightRouteSchema = z.object({
  routeName: z.string(),
  routeLatlons: z.array(z.string()),
});

const UaInfoSchema = z.object({
  uaMaker: z.string(),
  uaName: z.string(),
  regSymbol: z.string(),
});

const PermissionEntrySchema = z.object({
  permissionNumber: z.string(),
  permissionNumber2: nullableString,
  receptionNumber: z.string(),
  permissionDate: z.string(),
  permissionPeriodStart: z.string(),
  permissionPeriodEnd: z.string(),
  flightLocation: z.string(),
  flightRoutes: z.array(FlightRouteSchema),
  aboveDenselyInhabitedDistricts: z.boolean(),
  moreThan150mAboveTheGround: z.boolean(),
  aroundAirports: z.boolean(),
  lessThan30m: z.boolean(),
  overEventSites: z.boolean(),
  nightOperation: z.boolean(),
  beyondVisualLineOfSight: z.boolean(),
  transportHazardousMaterials: z.boolean(),
  dropObjects: z.boolean(),
  uaInfos: z.array(UaInfoSchema),
});

/** レスポンスは `{ permissions: [...] }` 形であることのみ確認する (中身は要素単位で検証する) */
const RawPermissionsResponseSchema = z.object({
  permissions: z.array(z.unknown()),
});

type PermissionEntry = z.infer<typeof PermissionEntrySchema>;

/** 1エントリのパースに失敗した際の記録。個人情報を含みうる受信値そのものは持たない */
interface DroppedPermissionEntry {
  /** レスポンス配列内でのインデックス (何件目の許可か) */
  readonly index: number;
  /** 失敗原因となった Zod のパス (キー名) の一覧。値は含めない */
  readonly issuePaths: string[];
}

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

/** Zod のパス (キー名) の一覧を返す。受信値そのものは一切含めない */
function formatIssuePathList(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join("."));
}

/** レスポンスの実際の型名を返す (エラーメッセージの切り分け用。値そのものは含めない) */
function describeReceivedType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * 生レスポンスの `permissions` 配列を1件ずつ検証する。配列全体を safeParse すると
 * 1件の失敗で全体が失敗扱いになるため、要素ごとに safeParse してパースできた
 * 許可だけを集める。
 */
function parsePermissionEntries(rawEntries: readonly unknown[]): {
  entries: PermissionEntry[];
  failures: DroppedPermissionEntry[];
} {
  const entries: PermissionEntry[] = [];
  const failures: DroppedPermissionEntry[] = [];

  rawEntries.forEach((rawEntry, index) => {
    const result = PermissionEntrySchema.safeParse(rawEntry);
    if (result.success) {
      entries.push(result.data);
    } else {
      failures.push({ index, issuePaths: formatIssuePathList(result.error) });
    }
  });

  return { entries, failures };
}

/**
 * パースに失敗したエントリの情報を構造化ログに残す (本番疎通確認時の切り分け用)。
 * 個人情報の混入を防ぐため、受信値そのものは一切含めず、配列内のインデックスと
 * Zod のパス (キー名) のみを記録する。
 */
function logDroppedPermissionEntries(
  failures: readonly DroppedPermissionEntry[],
  totalCount: number
): void {
  logger.error(
    `DIPS許可・承認情報のパースで${failures.length}/${totalCount}件のエントリを除外しました`,
    undefined,
    {
      route: "normalizePermissions",
      droppedEntries: failures.map((failure) => ({
        index: failure.index,
        issuePaths: failure.issuePaths,
      })),
    }
  );
}

/**
 * 許可・承認情報取得 API の生レスポンスを検証し、DipsPermissionInfo[] へ正規化する。
 * 除外した許可の件数も併せて返す (`excludedCount`)。
 *
 * エントリ単位でパースし、1件のパース失敗は他の許可を巻き込まない (パースできた
 * 許可だけを返し、失敗した許可はログに記録して除外する)。以下の場合は DipsApiError
 * を投げる:
 * - レスポンスが `{ permissions: [...] }` 形でない (API 仕様そのものが変わった可能性が高い)
 * - `permissions` に1件以上の要素があるにもかかわらず、全件のパースに失敗した (個々の
 *   異常値ではなく、レスポンス構造自体の変更を疑うべき状況のため、空配列を返さず
 *   502 で失敗を可視化する)
 *
 * 空配列 ([]) 自体は「許可情報なし」の正当な応答のため、そのまま [] を返す。
 * エラーメッセージには Zod のキー名または受信した型名のみを含め、受信値 (個人情報を
 * 含みうる) は一切含めない。
 */
export function normalizePermissionsWithDiagnostics(raw: unknown): NormalizePermissionsResult {
  const shapeResult = RawPermissionsResponseSchema.safeParse(raw);
  if (!shapeResult.success) {
    throw new DipsApiError(
      `DIPS許可・承認情報のレスポンス形式が不正です (受信した型: ${describeReceivedType(raw)})`
    );
  }

  const { entries, failures } = parsePermissionEntries(shapeResult.data.permissions);

  if (failures.length > 0) {
    logDroppedPermissionEntries(failures, shapeResult.data.permissions.length);
  }

  if (entries.length === 0 && shapeResult.data.permissions.length > 0) {
    const failedKeys = Array.from(new Set(failures.flatMap((failure) => failure.issuePaths)));
    throw new DipsApiError(
      `DIPS許可・承認情報の全${shapeResult.data.permissions.length}件のエントリでパースに失敗しました (対象キー: ${failedKeys.join(", ")})`
    );
  }

  return { permissions: entries, excludedCount: failures.length };
}
