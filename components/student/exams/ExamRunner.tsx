"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  postSubmitExam,
  type StartExamResponse,
  type SubmitAnswerItem,
} from "@/lib/api/studentExams";
import { EXAM_SESSION_STORAGE_KEY } from "@/lib/exam/storage";

interface ExamRunnerProps {
  examId: string;
}

interface RemainingTime {
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

function calculateRemaining(startedAt: Date, durationMinutes: number, now: Date): RemainingTime {
  const elapsedMs = now.getTime() - startedAt.getTime();
  const totalMs = durationMinutes * 60 * 1000;
  const remainMs = Math.max(totalMs - elapsedMs, 0);
  const totalSeconds = Math.floor(remainMs / 1000);
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

export function ExamRunner({ examId }: ExamRunnerProps) {
  const router = useRouter();
  const [examData, setExamData] = useState<StartExamResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  // 自動提出 (タイムアウト) はセッション中 1 回のみ。
  // 提出失敗で戻すと useEffect が remaining=0 で再発火しループするため、立てたら戻さない。
  const autoSubmitted = useRef(false);
  // 同時実行ロック。手動提出のエラー時は false に戻し、ユーザーがリトライできるようにする。
  const inFlight = useRef(false);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`${EXAM_SESSION_STORAGE_KEY}:${examId}`);
    if (raw === null) {
      setMissing(true);
      return;
    }
    try {
      setExamData(JSON.parse(raw) as StartExamResponse);
    } catch {
      setMissing(true);
    }
  }, [examId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (examData === null || inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: SubmitAnswerItem[] = examData.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: answers[q.id] ?? -1,
      }));
      await postSubmitExam(examId, payload);
      window.sessionStorage.removeItem(`${EXAM_SESSION_STORAGE_KEY}:${examId}`);
      router.push(`/exams/${examId}/result`);
    } catch (err) {
      // 手動提出の失敗はユーザーが再試行できるようロックだけ解く。
      // 自動提出フラグ (autoSubmitted) は戻さないので、useEffect が再発火してループすることはない。
      inFlight.current = false;
      setError(err instanceof Error ? err.message : "試験の提出に失敗しました");
      setIsSubmitting(false);
    }
  }, [examData, answers, examId, router]);

  const remaining = useMemo(() => {
    if (examData === null) return null;
    return calculateRemaining(new Date(examData.startedAt), examData.durationMinutes, now);
  }, [examData, now]);

  useEffect(() => {
    if (remaining !== null && remaining.totalSeconds === 0 && !autoSubmitted.current) {
      // 自動提出は 1 回のみ。失敗してもこのフラグは戻さない (ループ防止)。
      autoSubmitted.current = true;
      void handleSubmit();
    }
  }, [remaining, handleSubmit]);

  if (missing) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">試験データが見つかりません</h1>
        <p className="text-sm text-gray-600">
          試験は 1
          セッションで完結する設計です。ページを再読み込みするとセッション情報が失われます。試験一覧から再開してください。
        </p>
        <Link
          href="/exams"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white"
        >
          試験一覧へ
        </Link>
      </main>
    );
  }

  if (examData === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-600">読み込み中...</p>
      </main>
    );
  }

  const currentQuestion = examData.questions[currentIndex];
  const isLast = currentIndex === examData.questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">修了確認試験</h1>
        <div
          data-testid="remaining-time"
          className={`rounded px-3 py-1 text-sm font-mono ${
            remaining !== null && remaining.totalSeconds < 60
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-700"
          }`}
          aria-live="polite"
        >
          残り {remaining?.minutes ?? 0}:{String(remaining?.seconds ?? 0).padStart(2, "0")}
        </div>
      </header>

      <div className="mb-4 text-sm text-gray-600">
        問題 {currentIndex + 1} / {examData.questions.length}（回答済み {answeredCount} 問）
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-4 whitespace-pre-wrap text-sm text-gray-900">{currentQuestion.body}</p>
        <ul className="space-y-2">
          {currentQuestion.choices.map((choice, idx) => (
            <li key={idx}>
              <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 p-3 hover:bg-gray-50">
                <input
                  type="radio"
                  name={`q-${currentQuestion.id}`}
                  value={idx}
                  checked={answers[currentQuestion.id] === idx}
                  onChange={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: idx }))}
                  className="mt-1"
                />
                <span className="text-sm text-gray-900">{choice}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <nav className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          disabled={currentIndex === 0}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          前へ
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded bg-green-600 px-4 py-1 text-sm text-white hover:bg-green-700 disabled:bg-gray-300"
          >
            {isSubmitting ? "提出中..." : "提出する"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(i + 1, examData.questions.length - 1))}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            次へ
          </button>
        )}
      </nav>

      {error !== null && (
        <p role="alert" className="mt-4 text-xs text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
