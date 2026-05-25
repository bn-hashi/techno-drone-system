"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJudgeAccepted, postJudgeRejected } from "@/lib/api/adminJudgment";

interface JudgmentFormProps {
  userId: string;
}

export function JudgmentForm({ userId }: JudgmentFormProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleAccept = async () => {
    if (isPending) return;
    if (!window.confirm("受講成立として判定し、ステータスを「修了」に進めます。よろしいですか?")) {
      return;
    }
    setIsPending(true);
    setError(null);
    setWarning(null);
    try {
      await postJudgeAccepted(userId, comment.trim() || undefined);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "判定の送信に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  const handleReject = async () => {
    if (isPending) return;
    if (
      !window.confirm("受講不成立として判定し、受講者へメール通知します。よろしいですか?")
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    setWarning(null);
    try {
      const response = await postJudgeRejected(userId, comment.trim() || undefined);
      if (!response.mailSent) {
        setWarning("判定は保存しましたが、受講者へのメール通知に失敗しました。");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "判定の送信に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label htmlFor="judgment-comment" className="mb-2 block text-sm font-medium text-gray-700">
        判定コメント (任意・社内記録のみ、メールには含まれません)
      </label>
      <textarea
        id="judgment-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="判定理由など (任意)"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {error !== null && (
          <span role="alert" className="mr-auto text-xs text-red-600">
            {error}
          </span>
        )}
        {warning !== null && (
          <span role="status" className="mr-auto text-xs text-amber-700">
            {warning}
          </span>
        )}
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="rounded border border-red-600 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "送信中..." : "不成立"}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isPending ? "送信中..." : "成立"}
        </button>
      </div>
    </div>
  );
}
