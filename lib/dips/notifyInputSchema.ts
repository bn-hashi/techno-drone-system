import { z } from "zod";
import type { DipsFlightPurposeCode } from "@/lib/dips/types";
import { isKnownDipsPrefectureCode } from "@/lib/constants/dipsAddressCode";
import {
  DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS,
  DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS,
} from "@/lib/constants/dipsFlightPurpose";

/**
 * 飛行計画通報でユーザーがダイアログ入力する項目の検証スキーマ。
 * 値域は FPRガイドライン v1.9 2.3.8 の業務制約に準拠する (コントローラーには置かない)。
 *
 * サーバー側でここまで厳格に検証しておくことが、共用検証DBへの無駄な送信を減らす
 * 主要な手段になる (req-013。検証環境DBは他事業者と共用のため)。
 */

/** 飛行目的コードの上限 (1〜16) */
const MAX_FLIGHT_PURPOSE_CODE = 16;
/** 飛行速度の上限 (km/h) */
const MAX_SPEED_KMH = 999;
/** 飛行高度の上限 (AGL メートル) */
const MAX_ALTITUDE_M = 999;

/** その他1(業務) が選択されているとき、理由入力が空でないことを検証する (No.5) */
function hasOtherBusinessReasonIfSelected(data: {
  flightPurpose: number[];
  othergyomutext?: string;
}): boolean {
  if (!data.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_BUSINESS)) return true;
  return (data.othergyomutext ?? "").trim().length > 0;
}

/** その他2(業務以外) が選択されているとき、理由入力が空でないことを検証する (No.6) */
function hasOtherNonBusinessReasonIfSelected(data: {
  flightPurpose: number[];
  othergyomugaitext?: string;
}): boolean {
  if (!data.flightPurpose.includes(DIPS_FLIGHT_PURPOSE_OTHER_NON_BUSINESS)) return true;
  return (data.othergyomugaitext ?? "").trim().length > 0;
}

export const DipsNotifyInputSchema = z
  .object({
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
    othergyomutext: z.string().optional(),
    othergyomugaitext: z.string().optional(),
    flightAirspace: z.array(z.number().int()).min(1),
    assistantsNumber: z.number().int().min(0),
    departurePoint: z.string().min(1),
    destinationPoint: z.string().min(1),
    flightSpeed: z.number().int().min(1).max(MAX_SPEED_KMH),
    flightAltitude: z.number().int().min(1).max(MAX_ALTITUDE_M),
    flyRoute: z.string().min(1),
    riskMitigationOnsiteControl: z.boolean(),
    riskMitigationOnsiteControlL3: z.boolean(),
    riskMitigationOnsiteControlL35: z.boolean(),
    riskMitigationOnsiteControl2: z.boolean(),
    exceptionalConditionsMooring: z.boolean(),
    // 通報者・操縦者 (同一人物) の連絡先。氏名・メールは User レコードから取得するため
    // ここには含めない (req-013 人の決定。新規PIIを都度入力させる範囲は最小限にする)
    prefecture: z.string().refine(isKnownDipsPrefectureCode, "不明な都道府県コードです"),
    municipality: z.string().min(1),
    telephone: z.string().min(1),
    firstClass: z.boolean(),
    secondClass: z.boolean(),
    privateLicense: z.boolean(),
  })
  .refine(hasOtherBusinessReasonIfSelected, {
    message: "その他1(業務)の理由を入力してください",
    path: ["othergyomutext"],
  })
  .refine(hasOtherNonBusinessReasonIfSelected, {
    message: "その他2(業務以外)の理由を入力してください",
    path: ["othergyomugaitext"],
  });
