import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";

/**
 * DIPS ログイン済みアカウントの許可・承認情報を取得する (許可・承認情報取得 API)。
 *
 * realm は `req` (機体情報一覧取得 (`GET /api/dips/aircrafts`) の `utm` とは別 realm)。
 * エラー分類・レスポンス形は `handleDipsRouteError` (`lib/dips/handleRouteError.ts`) に
 * 委譲する。realm は同ハンドラが常に `error.realm` から取る (ハードコードしない。
 * 2026-08-26 差し戻し D1)。`app/api/dips/aircrafts/route.ts` と同型
 * (5-3/5-4/5-5 も同じ形を踏襲すること)。
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  try {
    const service = getDipsService();
    const { permissions, excludedCount } = await service.fetchPermissions(auth.userId);
    return NextResponse.json({ permissions, excludedCount }, { status: 200 });
  } catch (error) {
    return handleDipsRouteError(error, {
      route: "GET /api/dips/permissions",
      label: "許可・承認情報",
    });
  }
}
