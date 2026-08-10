/**
 * DIPS 連携のクライアント API ヘルパー
 */
import { z } from "zod";

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

/** DIPS 所有機体 (機体情報一覧取得 API)。所有者・使用者の個人情報は含まない */
export interface DipsOwnedAircraftDto {
  registrationCode: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  weightGrams: number;
  status: 1 | 2 | 3;
  deregistrationReason: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  validPeriodEnd: string;
  remoteIdType: 0 | 1 | 2;
  ownerCategory: 1 | 2;
  isSelectable: boolean;
}

const DipsOwnedAircraftDtoSchema = z.object({
  registrationCode: z.string(),
  manufacturer: z.string(),
  modelNumber: z.string(),
  serialNumber: z.string(),
  weightGrams: z.number(),
  status: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  deregistrationReason: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)])
    .nullable(),
  validPeriodEnd: z.string(),
  remoteIdType: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  ownerCategory: z.union([z.literal(1), z.literal(2)]),
  isSelectable: z.boolean(),
});

/**
 * DIPS ログイン済みアカウントが所有する機体一覧を取得する。
 * トークン未取得・失効 (401 authRequired) の場合は DipsAuthRequiredClientError を投げる。
 */
export async function fetchDipsOwnedAircrafts(
  includeInvalid = false
): Promise<DipsOwnedAircraftDto[]> {
  const res = await fetch(`/api/dips/aircrafts?includeInvalid=${includeInvalid}`);

  const body = (await res.json().catch(() => null)) as
    | ({ authRequired?: boolean; realm?: string; error?: string } & { aircrafts?: unknown })
    | null;

  if (res.status === 401 && body?.authRequired) {
    throw new DipsAuthRequiredClientError(body.realm ?? "utm");
  }

  if (!res.ok) {
    throw new Error(body?.error ?? "DIPS機体情報の取得に失敗しました");
  }

  const result = z.array(DipsOwnedAircraftDtoSchema).safeParse(body?.aircrafts);
  if (!result.success) {
    throw new Error("DIPS機体情報の取得に失敗しました: レスポンスの形式が不正です");
  }
  return result.data;
}
