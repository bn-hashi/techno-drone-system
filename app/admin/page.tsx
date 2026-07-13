import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getDashboardService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";

export const dynamic = "force-dynamic";

interface AlertTileProps {
  label: string;
  value: number;
  sub?: string;
  href?: string;
  /** 値が1件以上あるときに強調する色 (要対応系) */
  urgent?: boolean;
}

function AlertTile({ label, value, sub, href, urgent = false }: AlertTileProps) {
  const isUrgent = urgent && value > 0;
  const valueColor = isUrgent ? "text-danger" : "text-heading";
  const dotColor = isUrgent ? "bg-danger" : "bg-accent";
  const content = (
    <div className="rounded-card border border-line bg-white p-4 px-[18px] shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-[12.5px] text-muted">{label}</span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={`text-[32px] font-bold leading-none tracking-tight ${valueColor}`}>
          {value}
        </span>
        {sub && <span className="text-xs text-faint">{sub}</span>}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
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

  const statusRows = [
    { label: "仮登録", value: studentsByStatus.pendingRegistration },
    { label: "本登録待ち", value: studentsByStatus.pendingActivation },
    { label: "受講中", value: studentsByStatus.active },
    { label: "試験合格", value: studentsByStatus.examPassed },
    { label: "受講成立", value: studentsByStatus.completed },
    { label: "修了証発行済", value: studentsByStatus.certified },
    { label: "DIPS連携済", value: studentsByStatus.dipsLinked },
  ];

  const quickLinks = [
    { label: "受講者管理", href: "/admin/users" },
    { label: "コース管理", href: "/admin/courses" },
    { label: "成績・修了判定", href: "/admin/judgments" },
    { label: "飛行日誌", href: "/admin/flight-logs" },
  ];

  return (
    <div>
      {/* 要対応アラートタイル (デザイン案A アラート型) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AlertTile
          label="未受理の入学申請"
          value={pendingApplications}
          sub="件"
          href="/admin/applications"
          urgent
        />
        <AlertTile
          label="未解消の不正フラグ"
          value={unresolvedFraudFlags}
          sub="件"
          href="/admin/fraud-flags"
          urgent
        />
        <AlertTile label="未回答の質問" value={unansweredQAs} sub="件" href="/admin/qa" urgent />
        <AlertTile label="受講者数" value={totalStudents} sub="名" href="/admin/users" />
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        {/* 受講生ステータス内訳 */}
        <section className="rounded-card border border-line bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-heading">受講生ステータス</h2>
            <span className="text-xs text-faint">合計 {totalStudents} 名</span>
          </div>
          {statusRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3.5 border-t border-line-soft py-3"
            >
              <span className="flex-1 text-sm text-heading">{row.label}</span>
              <span className="rounded-full bg-line-soft px-2.5 py-0.5 text-xs text-[#475467]">
                {row.value} 名
              </span>
            </div>
          ))}
        </section>

        {/* クイックリンク */}
        <section className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3.5 text-[15px] font-bold text-heading">クイックリンク</h2>
          <div className="flex flex-col gap-2">
            {quickLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-[9px] border border-line bg-white px-4 py-2.5 text-sm text-[#475467] hover:bg-surface"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
