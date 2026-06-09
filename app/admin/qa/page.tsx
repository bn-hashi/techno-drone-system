import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getQAService } from "@/lib/serviceFactory";
import { UserRole } from "@/types/prisma";
import { QAList } from "@/components/admin/qa/QAList";
import type { QARecordWithUserItem } from "@/lib/api/adminQA";

export const dynamic = "force-dynamic";

interface QAPageProps {
  searchParams: Promise<{ unansweredOnly?: string }>;
}

export default async function AdminQAPage({ searchParams }: QAPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const params = await searchParams;
  const unansweredOnly = params.unansweredOnly === "true";

  const records = await getQAService().listAll(unansweredOnly);
  const items: QARecordWithUserItem[] = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    question: r.question,
    answer: r.answer,
    questionedAt: r.questionedAt.toISOString(),
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    answeredBy: r.answeredBy,
    user: r.user,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">質疑応答管理</h1>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-600">表示:</span>
        <Link
          href="/admin/qa"
          className={`rounded px-3 py-1 ${
            !unansweredOnly
              ? "bg-blue-600 text-white"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          全件
        </Link>
        <Link
          href="/admin/qa?unansweredOnly=true"
          className={`rounded px-3 py-1 ${
            unansweredOnly
              ? "bg-blue-600 text-white"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          未回答のみ
        </Link>
      </div>

      <QAList records={items} />
    </div>
  );
}
