import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getQAService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { QuestionForm } from "@/components/student/qa/QuestionForm";
import { QuestionHistory } from "@/components/student/qa/QuestionHistory";
import type { QARecordItem } from "@/lib/api/studentQA";

export const dynamic = "force-dynamic";

export default async function StudentQAPage() {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    redirect("/login");
  }

  const records = await getQAService().listByUser(session.user.id);
  const items: QARecordItem[] = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    question: r.question,
    answer: r.answer,
    questionedAt: r.questionedAt.toISOString(),
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    answeredBy: r.answeredBy,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">質疑応答</h1>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-gray-700">新しい質問を送る</h2>
        <QuestionForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-gray-700">質問履歴</h2>
        <QuestionHistory records={items} />
      </section>
    </main>
  );
}
