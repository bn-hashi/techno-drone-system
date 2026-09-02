import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { handleDipsRouteError } from "@/lib/dips/handleRouteError";

/**
 * 許可・承認申請受付 API (5-3, realm req) へ検証環境向けのテスト申請を送信する。
 *
 * 5-6 (`app/api/flight/plans/[id]/dips-notify/route.ts`) と同型の POST。5-3 は
 * 検証環境での疎通確認 (任意の申請を送信し受付番号が取得できることの確認) のみが目的の
 * ため、リクエストボディは受け取らない (`DipsService.applyPermissionTest` が
 * ガイドライン準拠のテスト申請を組み立てて送信する)。
 */
export async function POST(): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  try {
    const service = getDipsService();
    const result = await service.applyPermissionTest(auth.userId);
    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return handleDipsRouteError(error, {
      route: "POST /api/dips/permissions/apply",
      label: "許可・承認申請",
      actionVerb: "送信",
    });
  }
}
