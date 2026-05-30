import { extractErrorMessage } from "@/lib/api/errorHelpers";

export interface CertificateRecordItem {
  id: string;
  userId: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string;
  pdfPath: string | null;
}

export interface IssueCertificateResponse {
  certificate: CertificateRecordItem;
  pdfGenerated: boolean;
  mailSent: boolean;
}

export async function postIssueCertificate(
  userId: string
): Promise<IssueCertificateResponse> {
  const encodedUserId = encodeURIComponent(userId);
  const response = await fetch(`/api/admin/students/${encodedUserId}/certificate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "修了証明書の発行に失敗しました"));
  }
  return (await response.json()) as IssueCertificateResponse;
}

export function buildAdminCertificateDownloadUrl(userId: string): string {
  const encodedUserId = encodeURIComponent(userId);
  return `/api/admin/students/${encodedUserId}/certificate/download`;
}
