import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import {
  DipsDisabledError,
  DipsConfigError,
  DipsAuthError,
  DipsApiError,
  DipsAuthRequiredError,
} from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

/**
 * DIPS ログイン済みアカウントの許可・承認情報を取得する (許可・承認情報取得 API)。
 *
 * realm は `req` (機体情報一覧取得 (`GET /api/dips/aircrafts`) の `utm` とは別 realm)。
 * エラー分類・レスポンス形は app/api/dips/aircrafts/route.ts と同型にしている
 * (5-3/5-4/5-5 も同じ形を踏襲すること。詳細は req-009 builder 報告参照)。
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  try {
    const service = getDipsService();
    const { permissions, excludedCount } = await service.fetchPermissions(auth.userId);
    return NextResponse.json({ permissions, excludedCount }, { status: 200 });
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // トークン未取得・失効: UI にログイン誘導させるため専用フラグを返す
    if (error instanceof DipsAuthRequiredError) {
      return NextResponse.json(
        { error: error.message, authRequired: true, realm: "req" },
        { status: 401 }
      );
    }
    // 自システムの環境変数不足 (DIPS 側の障害ではない)。DIPS 側障害の 502 と混同すると
    // 運用時の切り分け表 (docs/production-operations-runbook.md) で誤誘導するため区別する
    if (error instanceof DipsConfigError) {
      logger.error("DIPS連携の設定が不足しています", error, {
        route: "GET /api/dips/permissions",
      });
      return NextResponse.json({ error: "DIPS連携の設定が不足しています" }, { status: 503 });
    }
    if (error instanceof DipsAuthError || error instanceof DipsApiError) {
      logger.error("DIPS許可・承認情報取得に失敗しました", error, {
        route: "GET /api/dips/permissions",
      });
      return NextResponse.json({ error: "DIPS連携でエラーが発生しました" }, { status: 502 });
    }
    logger.error("許可・承認情報取得で内部エラーが発生しました", error, {
      route: "GET /api/dips/permissions",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
