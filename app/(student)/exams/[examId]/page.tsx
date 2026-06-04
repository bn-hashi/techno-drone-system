import { ExamRunner } from "@/components/student/exams/ExamRunner";

interface Props {
  params: { examId: string };
}

export default function ExamRunnerPage({ params }: Props) {
  return <ExamRunner examId={params.examId} />;
}
