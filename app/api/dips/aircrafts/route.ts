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
 * DIPS ログイン済みアカウントが所有する機体一覧を取得する (機体情報一覧取得 API)。
 *
 * ADMIN が代理登録する場合でも、DIPS へログインしたアカウント (= 自分自身) が
 * 所有する機体しか取得できない (DIPS 側の仕様上の制約。UI 側で明示する)。
 * クエリ `includeInvalid=true` で抹消済み・有効期限切れの機体も含める。
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireFlightAccess();
  if (!auth.ok) return auth.response;

  const includeInvalid = new URL(request.url).searchParams.get("includeInvalid") === "true";

  try {
    const service = getDipsService();
    const aircrafts = await service.listOwnedAircrafts(auth.userId, { includeInvalid });
    return NextResponse.json({ aircrafts }, { status: 200 });
  } catch (error) {
    if (error instanceof DipsDisabledError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // トークン未取得・失効: UI にログイン誘導させるため専用フラグを返す
    if (error instanceof DipsAuthRequiredError) {
      return NextResponse.json(
        { error: error.message, authRequired: true, realm: "utm" },
        { status: 401 }
      );
    }
    if (
      error instanceof DipsConfigError ||
      error instanceof DipsAuthError ||
      error instanceof DipsApiError
    ) {
      logger.error("DIPS機体情報一覧取得に失敗しました", error, {
        route: "GET /api/dips/aircrafts",
      });
      return NextResponse.json({ error: "DIPS連携でエラーが発生しました" }, { status: 502 });
    }
    logger.error("機体情報一覧取得で内部エラーが発生しました", error, {
      route: "GET /api/dips/aircrafts",
    });
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
