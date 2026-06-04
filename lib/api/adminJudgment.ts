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
  // userId は cuid だが defensive practice として encodeURIComponent を通す
  // (将来 ID 形式が変わって "/" や "?" を含んだ場合の URL 破壊を防ぐ)
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`/api/admin/students/${encodedUserId}/judge`, {
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
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`/api/admin/students/${encodedUserId}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result: "REJECTED", comment }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "受講不成立判定の送信に失敗しました"));
  }
  return (await response.json()) as JudgmentRejectResponse;
}
