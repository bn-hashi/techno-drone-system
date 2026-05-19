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
    // choices は Prisma の Json 型のため string[] にキャストする
    choices: Array.isArray(q.choices) ? (q.choices as string[]) : [],
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
