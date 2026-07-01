import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getDashboardService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";

export const dynamic = "force-dynamic";

interface StatCardProps {
  label: string;
  value: number;
  href?: string;
  urgent?: boolean;
}

function StatCard({ label, value, href, urgent = false }: StatCardProps) {
  const valueClass = urgent && value > 0 ? "text-red-600" : "text-gray-900";
  const content = (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const stats = await getDashboardService().getStats();
  const { studentsByStatus, pendingApplications, unresolvedFraudFlags, unansweredQAs } = stats;

  const totalStudents = Object.values(studentsByStatus).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">管理者ダッシュボード</h1>

      {/* 要対応 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">要対応</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="未受理の入学申請"
            value={pendingApplications}
            href="/admin/enrollment-applications"
            urgent
          />
          <StatCard
            label="未解消の不正フラグ"
            value={unresolvedFraudFlags}
            href="/admin/fraud-flags"
            urgent
          />
          <StatCard label="未回答の質問" value={unansweredQAs} href="/admin/qa" urgent />
        </div>
      </section>

      {/* 受講生ステータス */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
          受講生（合計: {totalStudents}名）
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="仮登録" value={studentsByStatus.pendingRegistration} />
          <StatCard label="本登録待ち" value={studentsByStatus.pendingActivation} />
          <StatCard label="受講中" value={studentsByStatus.active} />
          <StatCard label="試験合格" value={studentsByStatus.examPassed} />
          <StatCard label="受講成立" value={studentsByStatus.completed} />
          <StatCard label="修了証発行済" value={studentsByStatus.certified} />
          <StatCard label="DIPS連携済" value={studentsByStatus.dipsLinked} />
        </div>
      </section>

      {/* クイックリンク */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
          クイックリンク
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "ユーザー管理", href: "/admin/users" },
            { label: "機体管理", href: "/admin/aircraft" },
            { label: "コース管理", href: "/admin/courses" },
            { label: "成績・修了判定", href: "/admin/judgments" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
