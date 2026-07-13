import { z } from "zod";
import type { DipsFlightPurposeCode } from "@/lib/dips/types";

/**
 * 飛行計画通報でユーザーがダイアログ入力する項目の検証スキーマ。
 * 値域は FPRガイドライン v1.9 2.3.8 の業務制約に準拠する (コントローラーには置かない)。
 */

/** 飛行目的コードの上限 (1〜16) */
const MAX_FLIGHT_PURPOSE_CODE = 16;
/** 飛行速度の上限 (km/h) */
const MAX_SPEED_KMH = 999;
/** 飛行高度の上限 (AGL メートル) */
const MAX_ALTITUDE_M = 999;

export const DipsNotifyInputSchema = z.object({
  flightPurpose: z
    .array(
      z
        .number()
        .int()
        .min(1)
        .max(MAX_FLIGHT_PURPOSE_CODE)
        .transform((code) => code as DipsFlightPurposeCode)
    )
    .min(1),
  flightAirspace: z.array(z.number().int()).min(1),
  assistantsNumber: z.number().int().min(0),
  departurePoint: z.string().min(1),
  destinationPoint: z.string().min(1),
  flightSpeed: z.number().int().min(1).max(MAX_SPEED_KMH),
  flightAltitude: z.number().int().min(1).max(MAX_ALTITUDE_M),
  flyRoute: z.string().min(1),
  riskMitigationOnsiteControl: z.boolean(),
});
