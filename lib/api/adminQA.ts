import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { QARecordItem } from "@/lib/api/studentQA";

export interface QARecordWithUserItem extends QARecordItem {
  user: { id: string; name: string; email: string };
}

export interface ListAllQAResponse {
  records: QARecordWithUserItem[];
}

export interface AnswerQAResponse {
  record: QARecordItem;
  mailSent: boolean;
}

export async function fetchAdminQAList(
  unansweredOnly = false
): Promise<ListAllQAResponse> {
  const params = new URLSearchParams();
  if (unansweredOnly) params.set("unansweredOnly", "true");
  const query = params.toString();
  const url = query ? `/api/admin/qa?${query}` : "/api/admin/qa";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "質疑応答一覧の取得に失敗しました"));
  }
  return (await response.json()) as ListAllQAResponse;
}

export async function postAdminAnswer(
  qaId: string,
  answer: string
): Promise<AnswerQAResponse> {
  const response = await fetch(`/api/admin/qa/${qaId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "回答の送信に失敗しました"));
  }
  return (await response.json()) as AnswerQAResponse;
}
