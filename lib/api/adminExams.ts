import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { ExamStatus } from "@/types/prisma";

export interface AdminExamUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminExamResultItem {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  score: number | null;
  totalQuestions: number;
  passed: boolean | null;
  status: ExamStatus;
  createdAt: string;
  user: AdminExamUser;
}

export interface FetchExamResultsResponse {
  examResults: AdminExamResultItem[];
}

export async function fetchExamResults(): Promise<FetchExamResultsResponse> {
  const response = await fetch("/api/admin/exam-results");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "試験結果一覧の取得に失敗しました"));
  }
  return (await response.json()) as FetchExamResultsResponse;
}
