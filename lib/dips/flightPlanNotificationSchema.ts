import { z } from "zod";
import { DipsAcceptedButUnreadableResultError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";
import type { DipsFlightPlanNotificationResult } from "@/lib/dips/types";

/**
 * 飛行計画通報受付 API (5-6, FPRガイドライン v1.9 §2.3.8) のレスポンス検証。
 *
 * ガイドラインの正常時レスポンスは「トップレベル配列 + flightPlanInfoRegistrationResult
 * 入れ子」という他の FPR 系 API (§2.3.6/§2.3.7 はオブジェクト直下) と異なる形状。
 * 共通エンジン (`normalizeEntriesWithDiagnostics` の `extractArrayByKey`) はトップレベル
 * オブジェクトであることを前提にしており (トップレベル配列を `Array.isArray` で弾く)、
 * ここでは使えない。許可・承認申請受付 (`lib/dips/permissionApplicationSchema.ts`) と
 * 同じく、単一結果を扱う専用の Zod 検証をここに置く (共通化漏れではなく意図的な選択。
 * 2026-09-11 planner計画 §1-3 案A)。
 *
 * 【非対称設計】`flightPlanId` は DB (`dipsFlightPlanId`) に保存され冪等性保護
 * (2回目の通報を防ぐ) の要になるため厳格に検証する (空文字・空白のみ・全角空白・
 * 非文字列はすべて欠落扱い)。それ以外の項目 (表示用) は寛容にし、欠けても成功として
 * 扱う。理由: HTTP 200 が返っている時点で DIPS は通報を受理済みであり、表示用の
 * 付随項目が1つ欠けただけで「受理済みなのに失敗扱い」として利用者に再送を促すと、
 * かえって重複通報を招く (2026-09-11 planner計画 §1-4 案C)。
 *
 * 【PII 遮断点】`duplicateFlightPlan` (重複飛行計画情報) は意図的にスキーマへ定義しない。
 * ガイドラインのサンプルにこのキーが含まれる版には、他事業者の連絡先メールアドレス
 * (`contactEmail`) が含まれる (`_orchestrator/results/quick/20260908-fpr-guideline-2.3.8-
 * samples.txt` 370/400行)。件数のみ `existOtherFlightRoutesCount` として取り込み、
 * 詳細配列は z.object の strip により黙って破棄する (`lib/dips/flightPlanSchema.ts` と
 * 同じ思想)。
 *
 * 【件数と配列長は不一致】ガイドライン11件版サンプルは `existOtherFlightRoutesCount: 11`
 * なのに `duplicateFlightPlan: []` (件数と配列長が一致しない)。件数は必ず
 * `existOtherFlightRoutesCount` から取り、配列長を数え直さない。
 */

/**
 * `flightPlanId` の欠落判定。`undefined`/`null` に加え、空文字・空白のみ・全角空白
 * (U+3000 は `String.prototype.trim()` が除去する) も欠落として扱う (req-013 差し戻し
 * J1 の教訓の反映)。文字列でない値 (数値・オブジェクト・配列・boolean) は `z.string()`
 * の型検証で弾かれる。
 */
const FlightPlanIdSchema = z.string().trim().min(1);

/**
 * 表示用の付随項目 (寛容パース)。欠落・null に加え、型が不正な値 (数値・オブジェクト・
 * NaN 等) も検証失敗ではなく null へ正規化する (`.catch(null)`)。
 *
 * 2026-09-12 CodeRabbit指摘2への対応: 以前は `.nullish()` のみで、型が不正な値が来ると
 * `z.object()` の他フィールドと合わせて `RegistrationResultEntrySchema` 全体が invalid
 * になり、有効な `flightPlanId` まで巻き込んで「取り出せない」と判定していた
 * (「受理済みなのに ID を取り出せない」状態を自ら作る、この PR の目的に逆行する挙動)。
 * `.catch(null)` でフィールド単位の検証失敗をその場で吸収し、`flightPlanId` の検証とは
 * 独立させる。
 */
const LenientDisplayStringSchema = z.string().nullish().catch(null);
/** 数値版。NaN/Infinity も `.finite()` の検証失敗として拾われ `.catch(null)` で null になる */
const LenientFiniteNumberSchema = z.number().finite().nullish().catch(null);

const RegistrationResultEntrySchema = z.object({
  flightPlanId: FlightPlanIdSchema,
  flightPlanRegistrationResult: LenientDisplayStringSchema,
  flightPlanRegistrationDatetime: LenientDisplayStringSchema,
  existOtherFlightRoutesCount: LenientFiniteNumberSchema,
  // duplicateFlightPlan は意図的に定義しない (PII 遮断点。上記コメント参照)
});

const ResponseEntrySchema = z.object({
  flightPlanInfoRegistrationResult: RegistrationResultEntrySchema,
});

/**
 * トップレベル配列であること・空でないことのみを検証する。要素の形状は先頭要素だけを
 * `ResponseEntrySchema` で個別に検証する (`normalizeFlightPlanNotificationResult` 参照)。
 *
 * 2026-09-12 CodeRabbit指摘3への対応: 以前は `z.array(ResponseEntrySchema).min(1)` で
 * 配列の全要素を検証していたため、使わない2件目以降の形状が不正なだけで配列全体が
 * invalid になり、先頭の有効な結果まで「取り出せない」と判定していた。
 */
const ResponseArrayShapeSchema = z.array(z.unknown()).min(1);

/**
 * 飛行計画通報受付 API のレスポンス (成功時、HTTP 200) を検証・正規化する。
 *
 * 取り出せなかった場合 (異常形状・`flightPlanId` の欠落) は
 * `DipsAcceptedButUnreadableResultError` を投げる。HTTP 200 が返っている以上 DIPS 側では
 * 既に受理済みであり、通常の失敗として扱うと利用者が再送し重複通報を招くため
 * (2026-09-11 planner計画 §1-1)。
 */
export function normalizeFlightPlanNotificationResult(
  raw: unknown
): DipsFlightPlanNotificationResult {
  const arrayResult = ResponseArrayShapeSchema.safeParse(raw);
  if (!arrayResult.success) {
    throw new DipsAcceptedButUnreadableResultError(
      "DIPS飛行計画通報受付のレスポンスから飛行計画IDを読み取れませんでした",
      arrayResult.error
    );
  }

  if (arrayResult.data.length > 1) {
    // ガイドラインのサンプルは常に1要素。2件以上でも HTTP 200 = 受理済みのため、
    // 失敗扱いにして再送を促すのは逆効果 (2026-09-11 planner計画 §1-3)。先頭を採用し
    // ログにのみ残す
    logger.error("DIPS飛行計画通報受付のレスポンス配列が2件以上でした (先頭のみ使用)", undefined, {
      route: "normalizeFlightPlanNotificationResult",
      count: arrayResult.data.length,
    });
  }

  // 先頭要素だけを検証する (2026-09-12 CodeRabbit指摘3。ResponseArrayShapeSchema の
  // コメント参照)。2件目以降は形状を問わず無視する
  const entryResult = ResponseEntrySchema.safeParse(arrayResult.data[0]);
  if (!entryResult.success) {
    throw new DipsAcceptedButUnreadableResultError(
      "DIPS飛行計画通報受付のレスポンスから飛行計画IDを読み取れませんでした",
      entryResult.error
    );
  }

  const entry = entryResult.data.flightPlanInfoRegistrationResult;
  return {
    flightPlanId: entry.flightPlanId,
    flightPlanRegistrationResult: entry.flightPlanRegistrationResult ?? null,
    flightPlanRegistrationDatetime: entry.flightPlanRegistrationDatetime ?? null,
    existOtherFlightRoutesCount: entry.existOtherFlightRoutesCount ?? null,
  };
}
