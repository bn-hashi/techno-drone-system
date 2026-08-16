import { NextResponse } from "next/server";
import { getDipsService } from "@/lib/serviceFactory";
import { requireFlightAccess } from "@/lib/auth/requireFlightAccess";
import { isDipsRealm } from "@/lib/dips/authState";
import { DipsDisabledError, DipsConfigError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: { realm: string };
}

/**
 * DIPS 連携を解除する (realm 単位)。
 *
 * 対象は常にセッションの userId (`auth.userId`)。リクエストボディ・クエリから
 * userId を受け取らないため、ADMIN であっても他ユーザーの連携を解除できない
 * (`DipsAircraftPickerModal` の「別のアカウントでログインし直す」から呼ばれる)。
 * 未連携の状態で呼んでもエラーにせず成功を返す (冪等。DipsService.unlinkAccount 参照)。
 */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const { realm } = params;
  if (!isDipsRealm(realm)) {
    return NextResponse.json({ error: "不正なrealmです" }, { status: 400 });
  }

  try {
    const service = getDipsService();
    await service.unlinkAccount(auth.userId, realm);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // 自システムの環境変数不足 (DIPS 側の障害ではない)。GET /api/dips/aircrafts と同じ方針で
    // 502 (DIPS 側障害) と区別する
    if (error instanceof DipsConfigError) {
      logger.error("DIPS連携の設定が不足しています", error, {
        route: "DELETE /api/dips/tokens/[realm]",
      });
      return NextResponse.json({ error: "DIPS連携の設定が不足しています" }, { status: 503 });
    }
    logger.error("DIPS連携解除で内部エラーが発生しました", error, {
      route: "DELETE /api/dips/tokens/[realm]",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
