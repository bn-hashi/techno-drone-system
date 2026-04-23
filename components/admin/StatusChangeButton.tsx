"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserStatus } from "@/types/prisma";
import { getNextStatuses } from "@/lib/constants/statusTransitions";

interface StatusChangeButtonProps {
  userId: string;
  currentStatus: UserStatus;
}

async function patchUserStatus(userId: string, status: UserStatus): Promise<void> {
  const response = await fetch(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "ステータス変更に失敗しました");
  }
}

export function StatusChangeButton({ userId, currentStatus }: StatusChangeButtonProps) {
  const queryClient = useQueryClient();
  const nextStatuses = getNextStatuses(currentStatus);
  const nextStatus = nextStatuses[0];

  const mutation = useMutation({
    mutationFn: () => patchUserStatus(userId, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const isDisabled = !nextStatus || mutation.isPending;

  function handleClick() {
    if (!nextStatus) return;
    const confirmed = window.confirm(
      `ステータスを "${currentStatus}" から "${nextStatus}" に変更しますか？`
    );
    if (confirmed) {
      mutation.mutate();
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {nextStatus ?? "変更不可"}
    </button>
  );
}
