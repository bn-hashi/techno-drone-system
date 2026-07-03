/**
 * DIPS 連携のクライアント API ヘルパー
 */

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

  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as {
      authRequired?: boolean;
      realm?: string;
    } | null;
    if (body?.authRequired) {
      throw new DipsAuthRequiredClientError(body.realm ?? "fpl");
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "DIPS通報に失敗しました");
  }

  const data = (await res.json()) as { result: DipsNotificationResult };
  return data.result;
}

/** DIPS ログイン (認可コードフロー) を開始する URL */
export function dipsLoginUrl(realm: string): string {
  return `/api/dips/auth/start?realm=${encodeURIComponent(realm)}`;
}
