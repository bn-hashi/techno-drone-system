import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEnrollmentService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "入学申請一覧" };

function formatAcceptedStatus(acceptedAt: Date | null): string {
  if (acceptedAt === null) return "未受理";
  return `受理済 ${new Date(acceptedAt).toISOString().slice(0, 10)}`;
}

export default async function AdminApplicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const applications = await getEnrollmentService().listEnrollments();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">入学申請一覧</h1>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">氏名</th>
            <th className="border border-gray-300 px-4 py-2 text-left">メール</th>
            <th className="border border-gray-300 px-4 py-2 text-left">申請日</th>
            <th className="border border-gray-300 px-4 py-2 text-left">受理状況</th>
            <th className="border border-gray-300 px-4 py-2 text-left">身分証</th>
            <th className="border border-gray-300 px-4 py-2 text-left">写真</th>
            <th className="border border-gray-300 px-4 py-2 text-left">経験証明</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id}>
              <td className="border border-gray-300 px-4 py-2">{app.user.name}</td>
              <td className="border border-gray-300 px-4 py-2">{app.user.email}</td>
              <td className="border border-gray-300 px-4 py-2">
                {new Date(app.applicationDate).toISOString().slice(0, 10)}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {formatAcceptedStatus(app.acceptedAt)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {app.idDocumentPath !== null ? "✓" : "✗"}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {app.photoPath !== null ? "✓" : "✗"}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {app.experienceCertPath !== null ? "✓" : "✗"}
              </td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="border border-gray-300 px-4 py-2 text-center text-gray-500"
              >
                入学申請がありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
