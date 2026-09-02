/**
 * DIPS 連携のクライアント API ヘルパー
 */
import { z } from "zod";
import type {
  DipsOwnedAircraftDto,
  DipsPermissionInfo,
  DipsFlightRoute,
  DipsUaInfo,
} from "@/lib/dips/types";

/**
 * サーバー正規化済み配列 (機体・許可情報とも) をクライアント境界で1件ずつ再検証する
 * 共通処理。配列全体を safeParse すると1件の DTO 検証失敗で全件を失ってしまうため
 * (2026-08-10 差し戻し。サーバー側 edcc694 のエントリ単位フォールバックがクライアント側
 * では効いていなかった問題)、要素ごとに safeParse してパースできたエントリだけを返す。
 * `rawEntries` 自体が配列でない (キー名違い・非 JSON 応答等) 場合はエラーを投げる
 * (A3 差し戻し: 以前はここで `?? []` により静かに0件へフォールバックしていた)。
 *
 * `lib/api/dips.ts` の `parseOwnedAircrafts` と `parsePermissions` はこの処理を
 * 識別子名・対象名以外まったく同一の形で複製していたため (2026-08-28 段階2共通化)、
 * ここへ1本化する。エントリ単位のスキーマ・エラーメッセージ用の対象名 (`subject`) は
 * 呼び出し側が渡す。
 */
function parseEntriesLeniently<T>(
  rawEntries: unknown,
  entrySchema: z.ZodType<T>,
  subject: string
): { entries: T[]; excludedCount: number } {
  const arrayResult = z.array(z.unknown()).safeParse(rawEntries);
  if (!arrayResult.success) {
    throw new Error(`${subject}の取得に失敗しました: レスポンスの形式が不正です`);
  }
  const entries: T[] = [];
  let excludedCount = 0;
  for (const rawEntry of arrayResult.data) {
    const result = entrySchema.safeParse(rawEntry);
    if (result.success) {
      entries.push(result.data);
    } else {
      excludedCount += 1;
    }
  }
  return { entries, excludedCount };
}

export interface DipsNotificationInput {
  flightPurpose: number[];
  flightAirspace: number[];
  assistantsNumber: number;
  departurePoint: string;
  destinationPoint: string;
  flightSpeed: number;
  flightAltitude: number;
  flyRoute: string;
  riskMitigationOnsiteControl: boolean;
}

export interface DipsNotificationResult {
  flightPlanId: string;
  flightPlanRegistrationResult: string;
  flightPlanRegistrationDatetime: string;
}

/** DIPS ログインが必要なときに投げる。呼び出し側はログイン画面へ誘導する */
export class DipsAuthRequiredClientError extends Error {
  constructor(readonly realm: string) {
    super("DIPSへのログインが必要です");
    this.name = "DipsAuthRequiredClientError";
  }
}

/**
 * アプリ自体のログインセッションが失効しているときに投げる (DIPS 側の再認可とは別物)。
 * `requireFlightAccess()` は未ログイン時に英語の `{ error: "Unauthorized" }` を返すため、
 * それをそのまま画面へ出さないよう専用のエラー型で区別する。呼び出し側はアプリの
 * ログイン画面 (`/login`) へ誘導する。
 */
export class AppSessionExpiredClientError extends Error {
  constructor() {
    super("ログインが必要です。再度ログインしてください");
    this.name = "AppSessionExpiredClientError";
  }
}

/**
 * 飛行計画を DIPS へ通報する。
 * トークン未取得・失効 (401 authRequired) の場合は DipsAuthRequiredClientError を投げる。
 */
export async function notifyFlightPlanToDips(
  planId: string,
  input: DipsNotificationInput
): Promise<DipsNotificationResult> {
  const res = await fetch(`/api/flight/plans/${planId}/dips-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const body = (await res.json().catch(() => null)) as
    | ({ authRequired?: boolean; realm?: string; error?: string } & {
        result?: DipsNotificationResult;
      })
    | null;

  if (res.status === 401 && body?.authRequired) {
    throw new DipsAuthRequiredClientError(body.realm ?? "fpl");
  }

  if (!res.ok || !body?.result) {
    throw new Error(body?.error ?? "DIPS通報に失敗しました");
  }

  return body.result;
}

/**
 * DIPS 連携を解除する (realm 単位)。対象は常にログイン中の自分自身のトークン。
 * 未連携の状態で呼んでも成功する (冪等)。
 */
export async function unlinkDipsAccount(realm: string): Promise<void> {
  const res = await fetch(`/api/dips/tokens/${encodeURIComponent(realm)}`, { method: "DELETE" });

  if (res.status === 401) {
    throw new AppSessionExpiredClientError();
  }
  if (res.status === 403) {
    throw new Error("この操作を行う権限がありません");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "DIPS連携の解除に失敗しました");
  }
}

/**
 * DIPS ログイン (認可コードフロー) を開始する URL。
 * returnPath (アプリ内パス) を渡すと、認可完了後にそのページへ戻る。
 * サーバー側で検証されるため、不正なパスは既定の一覧ページ扱いになる。
 */
export function dipsLoginUrl(realm: string, returnPath?: string): string {
  const params = new URLSearchParams({ realm });
  if (returnPath) {
    params.set("returnPath", returnPath);
  }
  return `/api/dips/auth/start?${params.toString()}`;
}

/**
 * 2つの型が完全に一致する (フィールドの過不足がない) ことをコンパイル時に検証する型
 * ユーティリティ。
 *
 * `satisfies z.ZodType<T>` (このファイルの各 DTO スキーマ定義末尾で使用) が保証するのは
 * 「スキーマの出力型 → T」の一方向の代入可能性のみ。TypeScript の構造的部分型では、
 * 余剰フィールドを持つ型はより要求の少ない型へそのまま代入できてしまうため、
 * `satisfies` だけでは「T にフィールドを追加したのにスキーマの更新を忘れた」場合は
 * 検知できるが、逆に「スキーマにフィールドを追加したのに T の更新を忘れた」場合は
 * 検知できない (2026-09-01 stop-time review 差し戻し G1。サーバー側に寛容化を1つ足すと
 * クライアントの検証がそれを弾き、対象が黙って除外される失敗経路)。
 *
 * ここではジェネリック関数の型としての比較を介して双方向の完全一致を判定する
 * (TypeScript でよく使われる型等価判定イディオム。単純な相互 extends
 * `A extends B ? B extends A ? ... : ...` は一部のケースで不安定なため使わない)。
 */
type IsExactType<Actual, Expected> = (<T>() => T extends Actual ? 1 : 2) extends (
  <T>() => T extends Expected ? 1 : 2
)
  ? true
  : false;

/**
 * `IsExactType` が `false` を返すと、この型エイリアスの型制約違反でビルドが失敗する
 * (G1 双方向ドリフト検知の実体)。使い方: 各 DTO スキーマの直後に
 * `type _AssertXxxSchemaExact = AssertExactType<IsExactType<z.infer<typeof XxxSchema>, XxxDto>>;`
 * を置く。実行時には一切使われない型検査専用の宣言 (先頭の `_` は
 * `.eslintrc.json` の `varsIgnorePattern` で意図的な未使用として許可される)。
 */
type AssertExactType<T extends true> = T;

// ─── 機体情報一覧取得 (DIPS 所有機体) ─────────────────────────────────────────

/**
 * DIPS 所有機体 (機体情報一覧取得 API)。所有者・使用者の個人情報は含まない。
 * サーバー側 (`lib/dips/types.ts`) の型を re-export し、DTO の二重定義を避ける。
 */
export type { DipsOwnedAircraftDto };

/**
 * コード値 (status/remoteIdType/ownerCategory/deregistrationReason) はサーバー側
 * (`lib/dips/aircraftListSchema.ts`) が別紙1 未定義の値も null 以外の任意の数値を
 * そのまま通す寛容パース方針のため、クライアント側もここで同じ値域まで受理する
 * (number | null)。別紙1 の値体系 (DipsUaStatus 等) はあくまで既知の値の意味付けであり、
 * 表示側は `lib/constants/dipsAircraftStatus.ts` の `dipsUaStatusLabel()` 等で未知値・
 * null を「不明」にフォールバック表示する。
 */
// `satisfies z.ZodType<DipsOwnedAircraftDto>` で、このスキーマのフィールドが
// `DipsOwnedAircraftDto` (サーバー側の DTO 型) からドリフトしていないかをコンパイル時に
// 検証する。手書きの2重定義そのものはなくせない (サーバー側 DTO はビルド時の型情報でしか
// なく、クライアント境界の実行時再検証には別途 Zod スキーマが要る) が、型を1つ追加し忘れた
// 場合にビルドが失敗するようにして、静かな乖離を防ぐ (2026-08-28 段階2共通化)。
// なお `satisfies` は一方向の検知に留まるため、直後の `AssertExactType` で逆方向
// (スキーマ側の余剰フィールド) も検知できるようにする (2026-09-01 差し戻し G1)。
const DipsOwnedAircraftDtoSchema = z.object({
  registrationCode: z.string(),
  manufacturer: z.string(),
  modelNumber: z.string(),
  serialNumber: z.string(),
  weightGrams: z.number().nullable(),
  status: z.number().nullable(),
  deregistrationReason: z.number().nullable(),
  validPeriodEnd: z.string(),
  remoteIdType: z.number().nullable(),
  ownerCategory: z.number().nullable(),
  isSelectable: z.boolean(),
}) satisfies z.ZodType<DipsOwnedAircraftDto>;

type _AssertDipsOwnedAircraftDtoSchemaExact = AssertExactType<
  IsExactType<z.infer<typeof DipsOwnedAircraftDtoSchema>, DipsOwnedAircraftDto>
>;

export interface FetchDipsOwnedAircraftsResult {
  aircrafts: DipsOwnedAircraftDto[];
  /**
   * 除外された機体の件数。サーバー側でパースに失敗した件数と、クライアント側の DTO
   * 検証で落とした件数の合算 (CodeRabbit 2026-08-10 2回目レビュー指摘: クライアント側の
   * 除外がここに合算されておらず、除外通知が出ない・照合 UI が「見つからない」と
   * 誤って断定する実害があった)
   */
  excludedCount: number;
}

interface ParseOwnedAircraftsResult {
  aircrafts: DipsOwnedAircraftDto[];
  /** クライアント側の DTO 検証で落とした件数 */
  excludedCount: number;
}

/**
 * DIPS 所有機体の配列を1件ずつ検証する。パースに失敗した機体は黙って除外するが、その
 * 件数は呼び出し側 (`fetchDipsOwnedAircrafts`) がサーバー側の `excludedCount` に合算
 * できるよう返す (サーバー側が既にエントリ単位でフォールバック済みのため、ここで再び
 * 失敗するのはクライアント/サーバー間のスキーマ齟齬か、JSON シリアライズで値が壊れた
 * 場合 (例: Infinity → JSON.stringify で null 化) に限られる想定だが、稀であっても
 * 利用者に「除外があった」ことは伝える必要がある)。共通実装は `parseEntriesLeniently` 参照。
 */
function parseOwnedAircrafts(rawAircrafts: unknown): ParseOwnedAircraftsResult {
  const { entries, excludedCount } = parseEntriesLeniently(
    rawAircrafts,
    DipsOwnedAircraftDtoSchema,
    "DIPS機体情報"
  );
  return { aircrafts: entries, excludedCount };
}

/**
 * DIPS ログイン済みアカウントが所有する機体一覧を取得する。
 * トークン未取得・失効 (401 authRequired) の場合は DipsAuthRequiredClientError を投げる。
 * アプリ自体のセッションが切れている (401 だが authRequired を伴わない) 場合は
 * AppSessionExpiredClientError を投げ、呼び出し側はアプリのログイン画面へ誘導する。
 */
export async function fetchDipsOwnedAircrafts(
  includeInvalid = false
): Promise<FetchDipsOwnedAircraftsResult> {
  let res: Response;
  try {
    res = await fetch(`/api/dips/aircrafts?includeInvalid=${includeInvalid}`);
  } catch {
    // fetch() 自体が失敗した場合 (ネットワーク接続不可等) の TypeError は英語のまま
    // 画面に出てしまう (2026-09-02 差し戻し H4: fetchDipsPermissions 側 (D4 差し戻し) に
    // しか入っていなかった移行漏れ。DipsAircraftPickerModal.tsx / DipsVerifyButton.tsx が
    // err.message をそのまま描画するため、オフライン時に英語の "Failed to fetch" が
    // 5-1 の画面に出ていた)。ここで日本語メッセージに正規化する
    throw new Error("DIPS機体情報の取得に失敗しました。ネットワーク接続を確認してください");
  }

  const body = (await res.json().catch(() => null)) as
    | ({ authRequired?: boolean; realm?: string; error?: string } & {
        aircrafts?: unknown;
        excludedCount?: number;
      })
    | null;

  if (res.status === 401 && body?.authRequired) {
    throw new DipsAuthRequiredClientError(body.realm ?? "utm");
  }

  if (res.status === 401) {
    // requireFlightAccess() が返す素の 401 (英語 "Unauthorized") はアプリ自体のセッション
    // 切れ。DIPS 再認可 (authRequired) とは別物のため専用エラーで区別する
    throw new AppSessionExpiredClientError();
  }

  if (res.status === 403) {
    // requireFlightAccess() が返す素の 403 (英語 "Forbidden") をそのまま表示しない
    throw new Error("この操作を行う権限がありません");
  }

  if (!res.ok) {
    throw new Error(body?.error ?? "DIPS機体情報の取得に失敗しました");
  }

  const serverExcludedCount = typeof body?.excludedCount === "number" ? body.excludedCount : 0;
  const { aircrafts, excludedCount: clientExcludedCount } = parseOwnedAircrafts(body?.aircrafts);

  return {
    aircrafts,
    excludedCount: serverExcludedCount + clientExcludedCount,
  };
}

// ─── 許可・承認情報取得 ─────────────────────────────────────────────────────

/**
 * DIPS 許可・承認情報。所有者・使用者等の個人情報は含まない。
 * サーバー側 (`lib/dips/types.ts`) の型を re-export し、型の二重定義を避ける
 * (機体情報一覧取得の DipsOwnedAircraftDto と同じ方針)。
 */
export type { DipsPermissionInfo };

export interface FetchDipsPermissionsResult {
  permissions: DipsPermissionInfo[];
  /**
   * 除外された許可の件数。サーバー側 (permissionsSchema.ts) でパースに失敗した件数と、
   * クライアント側の DTO 検証で落とした件数の合算 (fetchDipsOwnedAircrafts の
   * excludedCount と同じ合算方針。2026-08-10 差し戻しの教訓を踏襲)
   */
  excludedCount: number;
}

interface ParsePermissionsResult {
  permissions: DipsPermissionInfo[];
  /** クライアント側の DTO 検証で落とした件数 */
  excludedCount: number;
}

/**
 * DIPS 許可・承認情報の DTO 検証スキーマ (クライアント境界)。サーバー側
 * (lib/dips/permissionsSchema.ts) が正規化済みの JSON を返す前提だが、そこを信頼しきって
 * 再検証を省略していたことが A3 差し戻しの原因だった (キー名違い・非 JSON レスポンスの
 * 両方で、検証されないまま「0件」として静かに成功していた)。fetchDipsOwnedAircrafts の
 * parseOwnedAircrafts と同じ強度で、要素単位に safeParse する。
 *
 * サーバー側 `PermissionEntrySchema` (lib/dips/permissionsSchema.ts) の生入力パース
 * (寛容: "1"/"0" や null も受理して正規化する) とは別物で、ここは正規化済み出力型
 * (`DipsPermissionInfo`) をそのまま再検証する厳格なスキーマである。両者は目的が違う
 * ため Zod スキーマそのものは共有できないが、20フィールドの手書き2重定義が
 * `DipsPermissionInfo` からドリフトしないよう `satisfies z.ZodType<DipsPermissionInfo>`
 * でコンパイル時に検証する (2026-08-28 段階2共通化。DipsOwnedAircraftDtoSchema と同じ方針)。
 * `satisfies` は一方向の検知に留まるため、各スキーマ定義の直後の `AssertExactType` で
 * 逆方向 (スキーマ側の余剰フィールド) も検知できるようにする (2026-09-01 差し戻し G1)。
 */
const FlightRouteDtoSchema = z.object({
  routeName: z.string(),
  routeLatlons: z.array(z.string()),
}) satisfies z.ZodType<DipsFlightRoute>;

type _AssertFlightRouteDtoSchemaExact = AssertExactType<
  IsExactType<z.infer<typeof FlightRouteDtoSchema>, DipsFlightRoute>
>;

const UaInfoDtoSchema = z.object({
  uaMaker: z.string(),
  uaName: z.string(),
  regSymbol: z.string(),
}) satisfies z.ZodType<DipsUaInfo>;

type _AssertUaInfoDtoSchemaExact = AssertExactType<
  IsExactType<z.infer<typeof UaInfoDtoSchema>, DipsUaInfo>
>;

const DipsPermissionInfoSchema = z.object({
  permissionNumber: z.string(),
  permissionNumber2: z.string().nullable(),
  receptionNumber: z.string(),
  // 画面に表示しないフィールドのため null を許容する (サーバー側 permissionsSchema.ts の
  // unusedDisplayString と同じ寛容度。2026-08-28 差し戻し F5)
  permissionDate: z.string().nullable(),
  permissionPeriodStart: z.string(),
  permissionPeriodEnd: z.string(),
  flightLocation: z.string(),
  flightRoutes: z.array(FlightRouteDtoSchema),
  aboveDenselyInhabitedDistricts: z.boolean(),
  moreThan150mAboveTheGround: z.boolean(),
  aroundAirports: z.boolean(),
  lessThan30m: z.boolean(),
  overEventSites: z.boolean(),
  nightOperation: z.boolean(),
  beyondVisualLineOfSight: z.boolean(),
  transportHazardousMaterials: z.boolean(),
  dropObjects: z.boolean(),
  uaInfos: z.array(UaInfoDtoSchema),
}) satisfies z.ZodType<DipsPermissionInfo>;

type _AssertDipsPermissionInfoSchemaExact = AssertExactType<
  IsExactType<z.infer<typeof DipsPermissionInfoSchema>, DipsPermissionInfo>
>;

/**
 * DIPS 許可・承認情報の配列を1件ずつ検証する。共通実装は `parseEntriesLeniently` 参照。
 */
function parsePermissions(rawPermissions: unknown): ParsePermissionsResult {
  const { entries, excludedCount } = parseEntriesLeniently(
    rawPermissions,
    DipsPermissionInfoSchema,
    "DIPS許可・承認情報"
  );
  return { permissions: entries, excludedCount };
}

/**
 * DIPS ログイン済みアカウントの許可・承認情報一覧を取得する。
 * トークン未取得・失効 (401 authRequired) の場合は DipsAuthRequiredClientError を投げる。
 * アプリ自体のセッションが切れている場合は AppSessionExpiredClientError を投げる
 * (fetchDipsOwnedAircrafts と同じ区別)。
 *
 * レスポンスはサーバー側 (lib/dips/permissionsSchema.ts) が既に検証・正規化済みだが、
 * それを信頼しきってクライアント側の再検証を省略していたことが A3 差し戻しの原因
 * だったため (キー名違い・非 JSON レスポンスの両方で「0件」として静かに成功していた)、
 * fetchDipsOwnedAircrafts の parseOwnedAircrafts と同じ強度で境界検証する。
 */
export async function fetchDipsPermissions(): Promise<FetchDipsPermissionsResult> {
  let res: Response;
  try {
    res = await fetch("/api/dips/permissions");
  } catch {
    // fetch() 自体が失敗した場合 (ネットワーク接続不可等) の TypeError は英語のまま
    // 画面に出てしまう (D4 差し戻し)。ここで日本語メッセージに正規化する
    throw new Error("DIPS許可・承認情報の取得に失敗しました。ネットワーク接続を確認してください");
  }

  const body = (await res.json().catch(() => null)) as
    | ({ authRequired?: boolean; realm?: string; error?: string } & {
        permissions?: unknown;
        excludedCount?: number;
      })
    | null;

  if (res.status === 401 && body?.authRequired) {
    throw new DipsAuthRequiredClientError(body.realm ?? "req");
  }

  if (res.status === 401) {
    // requireFlightAccess() が返す素の 401 (英語 "Unauthorized") はアプリ自体のセッション
    // 切れ。DIPS 再認可 (authRequired) とは別物のため専用エラーで区別する
    throw new AppSessionExpiredClientError();
  }

  if (res.status === 403) {
    // requireFlightAccess() が返す素の 403 (英語 "Forbidden") をそのまま表示しない
    throw new Error("この操作を行う権限がありません");
  }

  if (!res.ok) {
    throw new Error(body?.error ?? "DIPS許可・承認情報の取得に失敗しました");
  }

  const serverExcludedCount = typeof body?.excludedCount === "number" ? body.excludedCount : 0;
  const { permissions, excludedCount: clientExcludedCount } = parsePermissions(body?.permissions);

  return {
    permissions,
    excludedCount: serverExcludedCount + clientExcludedCount,
  };
}
