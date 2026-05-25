import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { ExamStatus } from "@/types/prisma";

export interface SubjectProgressItem {
  subjectId: string;
  subjectName: string;
  totalWatchedMinutes: number;
  requiredMinutes: number;
  isFulfilled: boolean;
}

export interface EligibilityResponse {
  eligible: boolean;
  progress: SubjectProgressItem[];
}

export interface ExamQuestionItem {
  id: string;
  subjectId: string;
  body: string;
  choices: string[];
}

export interface StartExamResponse {
  examId: string;
  startedAt: string;
  durationMinutes: number;
  totalQuestions: number;
  questions: ExamQuestionItem[];
}

export interface ExamSummary {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  score: number | null;
  totalQuestions: number;
  passed: boolean | null;
  status: ExamStatus;
  createdAt: string;
}

export interface ExamAnswerItem {
  id: string;
  examId: string;
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

export interface ExamResultResponse {
  exam: ExamSummary;
  answers: ExamAnswerItem[];
}

export interface SubmitAnswerItem {
  questionId: string;
  selectedIndex: number;
}

export async function fetchEligibility(): Promise<EligibilityResponse> {
  const response = await fetch("/api/student/exams/eligibility");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "受験条件の取得に失敗しました"));
  }
  return (await response.json()) as EligibilityResponse;
}

export async function postStartExam(): Promise<StartExamResponse> {
  const response = await fetch("/api/student/exams", { method: "POST" });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "試験の開始に失敗しました"));
  }
  return (await response.json()) as StartExamResponse;
}

export async function fetchExam(examId: string): Promise<ExamResultResponse> {
  const response = await fetch(`/api/student/exams/${examId}`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "試験の取得に失敗しました"));
  }
  return (await response.json()) as ExamResultResponse;
}

export async function postSubmitExam(
  examId: string,
  answers: SubmitAnswerItem[]
): Promise<{ exam: ExamSummary }> {
  const response = await fetch(`/api/student/exams/${examId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "試験の提出に失敗しました"));
  }
  return (await response.json()) as { exam: ExamSummary };
}

export async function fetchExamResult(examId: string): Promise<ExamResultResponse> {
  const response = await fetch(`/api/student/exams/${examId}/result`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "試験結果の取得に失敗しました"));
  }
  return (await response.json()) as ExamResultResponse;
}
