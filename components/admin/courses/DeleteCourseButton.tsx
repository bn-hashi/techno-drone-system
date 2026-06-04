"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteCourse } from "@/lib/api/adminCourses";

interface Props {
  id: string;
  name: string;
}

export function DeleteCourseButton({ id, name }: Props) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => deleteCourse(id),
    onSuccess: () => {
      router.refresh();
    },
  });

  function handleClick() {
    if (!window.confirm(`「${name}」を削除しますか？この操作は元に戻せません。`)) return;
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
