"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteVideo } from "@/lib/api/adminVideos";

interface Props {
  id: string;
  title: string;
}

export function DeleteVideoButton({ id, title }: Props) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => deleteVideo(id),
    onSuccess: () => {
      router.refresh();
    },
  });

  function handleClick() {
    if (!window.confirm(`「${title}」を削除しますか？この操作は元に戻せません。`)) return;
    mutation.mutate();
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={mutation.isPending}
        className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
      >
        削除
      </button>
      {mutation.isError && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : "削除に失敗しました"}
        </p>
      )}
    </div>
  );
}
