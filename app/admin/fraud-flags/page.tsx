import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getFraudFlagService } from "@/lib/serviceFactory";
import { UserRole, FraudFlagType } from "@/types/prisma";

export const dynamic = "force-dynamic";

const FRAUD_TYPE_LABELS: Record<FraudFlagType, string> = {
  [FraudFlagType.TAB_LEAVE]: "タブ離脱",
  [FraudFlagType.CONCURRENT_LOGIN]: "同時ログイン",
  [FraudFlagType.SPEED_VIOLATION]: "再生速度違反",
};

function formatDate(date: Date | string | null): string {
  if (date === null) return "-";
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export default async function FraudFlagsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const flags = await getFraudFlagService().listAllFlags();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">不正フラグ一覧</h1>

      {flags.length === 0 ? (
        <p className="text-sm text-gray-500">不正フラグは登録されていません。</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">受講者</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">種別</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">詳細</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">検出日時</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">解消日時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{flag.user.name ?? "-"}</div>
                    <div className="text-gray-500">{flag.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{FRAUD_TYPE_LABELS[flag.type]}</td>
                  <td className="px-4 py-3 text-gray-700">{flag.description ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(flag.detectedAt)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(flag.resolvedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
