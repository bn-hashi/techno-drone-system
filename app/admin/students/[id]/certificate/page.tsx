import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { IssueCertificateButton } from "@/components/admin/certificate/IssueCertificateButton";
import { buildAdminCertificateDownloadUrl } from "@/lib/api/adminCertificate";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

export const dynamic = "force-dynamic";

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REGISTRATION: "入学申請受付前",
  PENDING_ACTIVATION: "本登録待ち",
  ACTIVE: "受講中",
  EXAM_PASSED: "試験合格",
  COMPLETED: "修了",
  CERTIFIED: "資格取得",
  DIPS_LINKED: "DIPS連携済",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function AdminCertificatePage({ params }: CertificatePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const { id } = await params;
  let data;
  try {
    data = await getCertificateService().getCertificateData(id);
  } catch (err) {
    if (err instanceof BusinessError) {
      notFound();
    }
    throw err;
  }

  const { user, certificate, canIssue } = data;

  return (
    <AdminLayout>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">修了証明書</h1>
        <p className="mb-6 text-sm text-gray-500">
          受講者: {user.name} ({user.email})
        </p>

        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">基本情報</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-gray-500">現在のステータス</dt>
              <dd className="text-gray-900">{STATUS_LABELS[user.status] ?? user.status}</dd>
            </div>
          </dl>
        </section>

        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-gray-700">発行状況</h2>
          {certificate !== null ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
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
                <div>
                  <dt className="text-gray-500">PDF</dt>
                  <dd className="text-gray-900">
                    {certificate.pdfPath !== null ? "生成済" : "未生成 (要事務局対応)"}
                  </dd>
                </div>
              </dl>
              {certificate.pdfPath !== null && (
                <a
                  href={buildAdminCertificateDownloadUrl(user.id)}
                  className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  PDF をダウンロード
                </a>
              )}
            </div>
          ) : canIssue ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                修了 (COMPLETED) 状態の受講者です。修了証明書を発行できます。
              </p>
              <IssueCertificateButton userId={user.id} />
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              修了証明書は発行されていません。発行は受講者が修了 (COMPLETED)
              状態のときのみ可能です。
            </p>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}
