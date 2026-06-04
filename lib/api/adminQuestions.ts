import { extractErrorMessage } from "@/lib/api/errorHelpers";

export interface QuestionData {
  id: string;
  subjectId: string;
  body: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface CreateQuestionInput {
  subjectId: string;
  body: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface UpdateQuestionInput {
  subjectId?: string;
  body?: string;
  choices?: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface QuestionFilter {
  subjectId?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function fetchQuestions(filter?: QuestionFilter): Promise<QuestionData[]> {
  const params = new URLSearchParams();
  if (filter?.subjectId) params.set("subjectId", filter.subjectId);
  const query = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(`/api/admin/questions${query}`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "問題一覧の取得に失敗しました"));
  }
  const body = await response.json();
  return body.questions as QuestionData[];
}

export async function postCreateQuestion(input: CreateQuestionInput): Promise<QuestionData> {
  const response = await fetch("/api/admin/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "問題作成に失敗しました"));
  }
  const body = await response.json();
  return body.question as QuestionData;
}

export async function patchQuestion(
  id: string,
  input: UpdateQuestionInput
): Promise<QuestionData> {
  const response = await fetch(`/api/admin/questions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "問題更新に失敗しました"));
  }
  const body = await response.json();
  return body.question as QuestionData;
}

export async function deleteQuestion(id: string): Promise<void> {
  const response = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "問題削除に失敗しました"));
  }
}

export async function postImportCsv(csvText: string): Promise<ImportResult> {
  const response = await fetch("/api/admin/questions/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "CSV インポートに失敗しました"));
  }
  return (await response.json()) as ImportResult;
}
