"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postStudentQuestion } from "@/lib/api/studentQA";
import { QA_QUESTION_MAX_LENGTH } from "@/lib/constants";

export function QuestionForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await postStudentQuestion(question);
      setQuestion("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "質問の送信に失敗しました");
    } finally {
      setIsPending(false);
    }
  };

  const remaining = QA_QUESTION_MAX_LENGTH - question.length;
  const isOverLimit = remaining < 0;

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <label htmlFor="qa-question" className="mb-2 block text-sm font-medium text-gray-700">
        ご質問内容
      </label>
      <textarea
        id="qa-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={5}
        maxLength={QA_QUESTION_MAX_LENGTH + 100}
        placeholder="受講内容や教材についてのご質問をご記入ください"
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
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={isPending || question.trim().length === 0 || isOverLimit}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isPending ? "送信中..." : "質問を送信"}
        </button>
      </div>
    </form>
  );
}
