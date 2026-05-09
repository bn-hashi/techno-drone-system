import { NextResponse } from "next/server";
import { getSetupService } from "@/lib/serviceFactory";
import { BusinessError } from "@/services/errors";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "token と password は必須です" },
      { status: 400 }
    );
  }

  try {
    await getSetupService().setPassword(body.token, body.password);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "内部エラーが発生しました" }, { status: 500 });
  }
}
