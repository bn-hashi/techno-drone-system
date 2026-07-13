import { getAircraftService, getFlightPlanService } from "@/lib/serviceFactory";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { FlightLogForm } from "@/components/flight/logs/FlightLogForm";
import { FlightPlanStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

// 飛行計画の選択肢として取得する最大件数 (それより古い計画は選択不可で許容する)
const PLAN_OPTIONS_LIMIT = 100;

export default async function NewFlightLogPage() {
  const { userId, isAdmin } = await requireFlightSession();
  const context = { userId, isAdmin };

  const [aircrafts, planList] = await Promise.all([
    getAircraftService().list({ ...context, activeOnly: true }),
    getFlightPlanService().list(context, { limit: PLAN_OPTIONS_LIMIT }),
  ]);

  const completedPlans = planList.plans
    .filter((plan) => plan.status === FlightPlanStatus.COMPLETED)
    .map((plan) => ({ id: plan.id, title: plan.title }));

  if (aircrafts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">飛行日誌を作成</h1>
        <p className="text-sm text-gray-500">
          飛行日誌を作成するには、先に有効な機体を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">飛行日誌を作成</h1>
      <FlightLogForm aircrafts={aircrafts} completedPlans={completedPlans} />
    </div>
  );
}
