/**
 * DIPS 連携のクライアント API ヘルパー
 */
import { z } from "zod";
import type { DipsOwnedAircraftDto } from "@/lib/dips/types";

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
});

export interface FetchDipsOwnedAircraftsResult {
  aircrafts: DipsOwnedAircraftDto[];
  /** サーバー側でパースに失敗して除外された機体の件数 (C3: UI の誤表示防止に使う) */
  excludedCount: number;
}

/**
 * DIPS 所有機体の配列を1件ずつ検証する。配列全体を safeParse すると1機の DTO 検証失敗で
 * 全機を失ってしまうため (2026-08-10 差し戻し。サーバー側 edcc694 のエントリ単位
 * フォールバックがクライアント側では効いていなかった問題)、要素ごとに safeParse して
 * パースできた機体だけを返す。パースに失敗した機体は黙って除外する (サーバー側が
 * 既にエントリ単位でフォールバック済みのため、ここで再び失敗するのはクライアント/
 * サーバー間のスキーマ齟齬か、JSON シリアライズで値が壊れた場合 (例: Infinity →
 * JSON.stringify で null 化) に限られる想定)。
 */
function parseOwnedAircrafts(rawAircrafts: unknown): DipsOwnedAircraftDto[] {
  const arrayResult = z.array(z.unknown()).safeParse(rawAircrafts);
  if (!arrayResult.success) {
    throw new Error("DIPS機体情報の取得に失敗しました: レスポンスの形式が不正です");
  }
  const parsed: DipsOwnedAircraftDto[] = [];
  for (const rawEntry of arrayResult.data) {
    const result = DipsOwnedAircraftDtoSchema.safeParse(rawEntry);
    if (result.success) {
      parsed.push(result.data);
    }
  }
  return parsed;
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
  const res = await fetch(`/api/dips/aircrafts?includeInvalid=${includeInvalid}`);

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

  return {
    aircrafts: parseOwnedAircrafts(body?.aircrafts),
    excludedCount: typeof body?.excludedCount === "number" ? body.excludedCount : 0,
  };
}
