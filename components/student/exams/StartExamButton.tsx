"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postStartExam, type StartExamResponse } from "@/lib/api/studentExams";
import { EXAM_SESSION_STORAGE_KEY } from "@/lib/exam/storage";

interface StartExamButtonProps {
  disabled?: boolean;
}

export function StartExamButton({ disabled = false }: StartExamButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const response: StartExamResponse = await postStartExam();
      // 試験中の問題セットはクライアントで保持する（DB 非保存方針）
      window.sessionStorage.setItem(
        `${EXAM_SESSION_STORAGE_KEY}:${response.examId}`,
        JSON.stringify(response)
      );
      router.push(`/exams/${response.examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "試験の開始に失敗しました");
      setIsPending(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {isPending ? "開始中..." : "試験を開始"}
      </button>
      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
