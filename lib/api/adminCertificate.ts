import { extractErrorMessage } from "@/lib/api/errorHelpers";

/**
 * クライアント向けの修了証明書 DTO。
 *
 * サーバ内の絶対パスである pdfPath は意図的に含めない (情報漏えい防止)。
 * PDF の有無は API レスポンスの pdfGenerated フラグで判定し、
 * 実体は専用 DL エンドポイント経由で取得する。
 */
export interface CertificateRecordItem {
  id: string;
  userId: string;
  certificateNumber: string;
  issuedAt: string;
  expiresAt: string;
}

export interface IssueCertificateResponse {
  certificate: CertificateRecordItem;
  pdfGenerated: boolean;
  mailSent: boolean;
}

export async function postIssueCertificate(userId: string): Promise<IssueCertificateResponse> {
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

export function buildAdminCertificateLedgerUrl(userId: string): string {
  const encodedUserId = encodeURIComponent(userId);
  return `/api/admin/students/${encodedUserId}/certificate/ledger`;
}
