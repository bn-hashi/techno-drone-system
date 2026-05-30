import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { buildStudentCertificateDownloadUrl } from "@/lib/api/studentCertificate";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

// 修了証明書 DL を許可する受講者ステータスの allowlist
// API ルート (/api/student/certificate/download) と allowlist を統一
const ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.CERTIFIED,
  UserStatus.DIPS_LINKED,
];

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function StudentCertificatePage() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    !ALLOWED_STATUSES.includes(session.user.status)
  ) {
    redirect("/login");
  }

  const data = await getCertificateService().getCertificateData(session.user.id);
  const { certificate } = data;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">修了証明書</h1>

      {certificate === null ? (
        <p className="text-sm text-gray-600">修了証明書はまだ発行されていません。</p>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">証明書番号</dt>
              <dd className="text-gray-900">{certificate.certificateNumber}</dd>
            </div>
            <div>
              <dt className="text-gray-500">発行日時</dt>
              <dd className="text-gray-900">{formatDate(certificate.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">有効期限</dt>
              <dd className="text-gray-900">{formatDate(certificate.expiresAt)}</dd>
            </div>
          </dl>

          {certificate.pdfPath !== null ? (
            <a
              href={buildStudentCertificateDownloadUrl()}
              className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              PDF をダウンロード
            </a>
          ) : (
            <p className="mt-4 text-xs text-amber-700">
              PDF がまだ生成されていません。事務局までお問い合わせください。
            </p>
          )}
        </section>
      )}
    </main>
  );
}
