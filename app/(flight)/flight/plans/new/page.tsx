import { getAircraftService } from "@/lib/serviceFactory";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { FlightPlanForm } from "@/components/flight/plans/FlightPlanForm";

export const dynamic = "force-dynamic";

export default async function NewFlightPlanPage() {
  const { userId, isAdmin } = await requireFlightSession();

  const aircrafts = await getAircraftService().list({ userId, isAdmin, activeOnly: true });

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
