"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postAdminAnswer } from "@/lib/api/adminQA";
import { QA_ANSWER_MAX_LENGTH } from "@/lib/constants";

interface AnswerFormProps {
  qaId: string;
  initialAnswer: string | null;
}

export function AnswerForm({ qaId, initialAnswer }: AnswerFormProps) {
  const router = useRouter();
  const [answer, setAnswer] = useState<string>(initialAnswer ?? "");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    setIsPending(true);
    setError(null);
    setWarning(null);
    try {
      const response = await postAdminAnswer(qaId, answer);
      if (!response.mailSent) {
        setWarning("回答は保存しましたが、受講者へのメール通知に失敗しました。");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "回答の送信に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  const remaining = QA_ANSWER_MAX_LENGTH - answer.length;
  const isOverLimit = remaining < 0;
  const isRevision = initialAnswer !== null;

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
      <label
        htmlFor={`answer-${qaId}`}
        className="mb-2 block text-xs font-medium text-gray-700"
      >
        {isRevision ? "回答を修正" : "回答を送信"}
      </label>
      <textarea
        id={`answer-${qaId}`}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        maxLength={QA_ANSWER_MAX_LENGTH + 100}
        placeholder="ご質問への回答を入力してください"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={isOverLimit ? "text-red-600" : "text-gray-500"}>
          残り {remaining} 文字
        </span>
        {error !== null && (
          <span role="alert" className="text-red-600">
            {error}
          </span>
        )}
        {warning !== null && (
          <span role="status" className="text-amber-700">
            {warning}
          </span>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={isPending || answer.trim().length === 0 || isOverLimit}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isPending ? "送信中..." : isRevision ? "修正を送信" : "回答を送信"}
        </button>
      </div>
    </form>
  );
}
