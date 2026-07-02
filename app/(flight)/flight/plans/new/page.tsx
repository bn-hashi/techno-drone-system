import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@/types/prisma";
import { hasFlightAccess } from "@/lib/auth/flightPermissions";
import { AircraftRepository } from "@/repositories/aircraftRepository";
import { FlightPlanForm } from "@/components/flight/plans/FlightPlanForm";

export const dynamic = "force-dynamic";

export default async function NewFlightPlanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasFlightAccess(session.user.role as UserRole)) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  const isAdmin = role === UserRole.ADMIN;

  const repo = new AircraftRepository();
  const aircrafts = isAdmin
    ? await repo.findAll(true)
    : await repo.findAllByUser(session.user.id, true);

  if (aircrafts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">飛行計画を作成</h1>
        <p className="text-sm text-gray-500">
          飛行計画を作成するには、先に有効な機体を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">飛行計画を作成</h1>
      <FlightPlanForm aircrafts={aircrafts} />
    </div>
  );
}
