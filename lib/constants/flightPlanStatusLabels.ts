import type { FlightPlanStatus } from "@prisma/client";

export const FLIGHT_PLAN_STATUS_LABELS: Record<FlightPlanStatus, string> = {
  DRAFT: "下書き",
  APPROVED: "承認済み",
  REJECTED: "却下",
  COMPLETED: "完了",
};

export const FLIGHT_PLAN_STATUS_STYLE: Record<FlightPlanStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
};
