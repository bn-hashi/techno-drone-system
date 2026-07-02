import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";

interface FlightSession {
  userId: string;
  isAdmin: boolean;
}

/** 飛行管理 Server Component ページ共通の認可チェック。未認可の場合は /login にリダイレクトする */
export async function requireFlightSession(): Promise<FlightSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }
  const role = session.user.role as UserRole;
  return { userId: session.user.id, isAdmin: role === UserRole.ADMIN };
}
