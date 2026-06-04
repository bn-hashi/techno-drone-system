"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteQuestion } from "@/lib/api/adminQuestions";

interface Props {
  id: string;
  body: string;
}

export function DeleteQuestionButton({ id, body }: Props) {
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => deleteQuestion(id),
    onSuccess: () => {
      router.refresh();
    },
  });

  function handleClick() {
    const summary = body.length > 30 ? `${body.slice(0, 30)}...` : body;
    if (!window.confirm(`「${summary}」を削除しますか？この操作は元に戻せません。`)) return;
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
