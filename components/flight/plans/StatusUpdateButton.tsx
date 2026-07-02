"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFlightPlanStatus } from "@/lib/api/flightPlan";
import type { FlightPlanStatus } from "@/lib/api/flightPlan";

interface StatusUpdateButtonProps {
  planId: string;
  nextStatus: FlightPlanStatus;
  label: string;
  variant?: "primary" | "danger" | "success";
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
};

export function StatusUpdateButton({
  planId,
  nextStatus,
  label,
  variant = "primary",
}: StatusUpdateButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await updateFlightPlanStatus(planId, nextStatus);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`px-3 py-1.5 text-sm rounded disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
      >
        {isLoading ? "処理中..." : label}
      </button>
    </div>
  );
}
