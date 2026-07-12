import { notFound, redirect } from "next/navigation";
import { getFlightPlanService } from "@/lib/serviceFactory";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";
import { FlightPlanNotFoundError } from "@/services/errors";
import { FlightPlanStatus } from "@prisma/client";
import { FlightPlanForm } from "@/components/flight/plans/FlightPlanForm";
import type { FlightPlanDto } from "@/lib/api/flightPlan";

interface EditFlightPlanPageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function EditFlightPlanPage({ params }: EditFlightPlanPageProps) {
  const { userId, isAdmin } = await requireFlightSession();
  const context = { userId, isAdmin };
  const service = getFlightPlanService();

  let plan;
  try {
    plan = await service.findById(params.id, context);
  } catch (err) {
    if (err instanceof FlightPlanNotFoundError) {
      notFound();
    }
    throw err;
  }

  // services/flightPlanService.ts の update() と同じ編集不可条件
  // (完了済み・DIPS通報済み) は、フォームを見せる前にここで弾く
  if (plan.status === FlightPlanStatus.COMPLETED || plan.dipsFlightPlanId) {
    redirect(`/flight/plans/${params.id}`);
  }

  const aircraft = await service.getAircraftForPlan(plan);
  if (!aircraft) {
    notFound();
  }

  const initialData: FlightPlanDto = {
    ...plan,
    plannedAt: plan.plannedAt.toISOString(),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">飛行計画を編集</h1>
      <FlightPlanForm aircrafts={[aircraft]} initialData={initialData} />
    </div>
  );
}
