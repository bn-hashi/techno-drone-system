"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { UserStatus } from "@/types/prisma";
import { getNextStatuses } from "@/lib/constants/statusTransitions";
import { patchUserStatus } from "@/lib/api/adminUsers";

interface StatusChangeButtonProps {
  userId: string;
  currentStatus: UserStatus;
}

export function StatusChangeButton({ userId, currentStatus }: StatusChangeButtonProps) {
  const router = useRouter();
  const nextStatuses = getNextStatuses(currentStatus);
  const nextStatus = nextStatuses[0];

  const mutation = useMutation({
    mutationFn: () => patchUserStatus(userId, nextStatus),
    onSuccess: () => {
      // Server Component のデータを再取得するためページをリフレッシュする
      router.refresh();
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
