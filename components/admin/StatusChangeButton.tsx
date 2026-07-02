"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { UserStatus } from "@/types/prisma";
import { getNextStatuses } from "@/lib/constants/statusTransitions";
import { USER_STATUS_LABELS } from "@/lib/constants/userStatusLabels";
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
    onError: () => {
      // エラーは mutation.error として UI に表示する
    },
  });

  const isDisabled = !nextStatus || mutation.isPending;

  function handleClick() {
    if (!nextStatus) return;
    const confirmed = window.confirm(
      `ステータスを「${USER_STATUS_LABELS[currentStatus]}」から「${USER_STATUS_LABELS[nextStatus]}」に変更しますか？`
    );
    if (confirmed) {
      mutation.mutate();
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className="rounded-[7px] bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {nextStatus ? `${USER_STATUS_LABELS[nextStatus]}にする` : "変更不可"}
      </button>
      {mutation.isError && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "ステータス変更に失敗しました"}
        </p>
      )}
    </div>
  );
}
