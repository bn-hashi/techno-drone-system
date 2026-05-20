import { getQuestionService, getSubjectService } from "@/lib/serviceFactory";
import { QuestionPageClient } from "@/components/admin/questions/QuestionPageClient";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const [questions, subjects] = await Promise.all([
    getQuestionService().listQuestions(),
    getSubjectService().listSubjects(),
  ]);

  const questionData = questions.map((q) => ({
    id: q.id,
    subjectId: q.subjectId,
    body: q.body,
    // choices は Prisma の Json 型なので、要素単位で string だけを抽出する
    // (DB に非文字列が混入してもクライアント描画が落ちないようにする防御)
    choices: Array.isArray(q.choices)
      ? (q.choices as unknown[]).filter((c): c is string => typeof c === "string")
      : [],
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));

  const subjectData = subjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <QuestionPageClient questions={questionData} subjects={subjectData} />
    </div>
  );
}
