import { extractErrorMessage } from "@/lib/api/errorHelpers";
import type { JudgmentResult } from "@/types/prisma";

export interface JudgmentRecordItem {
  id: string;
  userId: string;
  result: JudgmentResult;
  comment: string | null;
  judgedBy: string;
  judgedAt: string;
}

export interface JudgmentRejectResponse {
  record: JudgmentRecordItem;
  mailSent: boolean;
}

export interface JudgmentAcceptResponse {
  record: JudgmentRecordItem;
}

export async function postJudgeAccepted(
  userId: string,
  comment?: string
): Promise<JudgmentAcceptResponse> {
  const response = await fetch(`/api/admin/students/${userId}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "ACCEPTED", comment }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "受講成立判定の送信に失敗しました"));
  }
  return (await response.json()) as JudgmentAcceptResponse;
}

export async function postJudgeRejected(
  userId: string,
  comment?: string
): Promise<JudgmentRejectResponse> {
  const response = await fetch(`/api/admin/students/${userId}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "REJECTED", comment }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "受講不成立判定の送信に失敗しました"));
  }
  return (await response.json()) as JudgmentRejectResponse;
}
