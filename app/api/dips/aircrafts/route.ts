import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";

/**
 * DIPS ログイン済みアカウントが所有する機体一覧を取得する (機体情報一覧取得 API)。
 *
 * ADMIN が代理登録する場合でも、DIPS へログインしたアカウント (= 自分自身) が
 * 所有する機体しか取得できない (DIPS 側の仕様上の制約。UI 側で明示する)。
 * クエリ `includeInvalid=true` で抹消済み・有効期限切れの機体も含める。
 *
 * エラー分類・レスポンス形は `handleDipsRouteError` (`lib/dips/handleRouteError.ts`) に
 * 委譲する。`app/api/dips/permissions/route.ts` と同型 (5-3/5-4/5-5 も同じ形を踏襲すること)。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const includeInvalid = new URL(request.url).searchParams.get("includeInvalid") === "true";

  try {
    const service = getDipsService();
    const { aircrafts, excludedCount } = await service.listOwnedAircrafts(auth.userId, {
      includeInvalid,
    });
    return NextResponse.json({ aircrafts, excludedCount }, { status: 200 });
  } catch (error) {
    return handleDipsRouteError(error, { route: "GET /api/dips/aircrafts", label: "機体情報一覧" });
  }
}
