"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deactivateAircraft } from "@/lib/api/aircraft";

interface DeactivateButtonProps {
  aircraftId: string;
}

export function DeactivateButton({ aircraftId }: DeactivateButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = async () => {
    if (!window.confirm("この機体を廃止しますか？この操作は取り消せません。")) return;

    setIsLoading(true);
    setError(null);
    try {
      await deactivateAircraft(aircraftId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && <p className="text-xs text-red-600 self-center">{error}</p>}
      <button
        onClick={handleDeactivate}
        disabled={isLoading}
        className="px-3 py-1.5 bg-red-50 border border-red-300 text-red-700 text-sm rounded hover:bg-red-100 disabled:opacity-50"
      >
        {isLoading ? "処理中..." : "廃止"}
      </button>
    </>
  );
}
