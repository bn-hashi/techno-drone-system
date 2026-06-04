import { extractErrorMessage } from "@/lib/api/errorHelpers";

export interface QARecordItem {
  id: string;
  userId: string;
  question: string;
  answer: string | null;
  questionedAt: string;
  answeredAt: string | null;
  answeredBy: string | null;
}

export interface ListQAResponse {
  records: QARecordItem[];
}

export interface CreateQAResponse {
  record: QARecordItem;
}

export async function fetchStudentQAList(): Promise<ListQAResponse> {
  const response = await fetch("/api/student/qa");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "質問履歴の取得に失敗しました"));
  }
  return (await response.json()) as ListQAResponse;
}

export async function postStudentQuestion(question: string): Promise<CreateQAResponse> {
  const response = await fetch("/api/student/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "質問の送信に失敗しました"));
  }
  return (await response.json()) as CreateQAResponse;
}
