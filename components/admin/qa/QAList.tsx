import type { QARecordWithUserItem } from "@/lib/api/adminQA";
import { AnswerForm } from "@/components/admin/qa/AnswerForm";

interface QAListProps {
  records: QARecordWithUserItem[];
}

function formatDate(date: string | null): string {
  if (date === null) return "-";
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export function QAList({ records }: QAListProps) {
  if (records.length === 0) {
    return <p className="text-sm text-gray-500">該当する質疑応答はありません。</p>;
  }
  return (
    <ul data-testid="qa-list" className="space-y-4">
      {records.map((rec) => {
        const isAnswered = rec.answer !== null;
        return (
          <li
            key={rec.id}
            className="rounded-lg border border-gray-200 bg-white p-4 text-sm"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <div className="text-gray-700">
                <span className="font-medium text-gray-900">{rec.user.name}</span>
                <span className="ml-2 text-gray-500">{rec.user.email}</span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  isAnswered ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {isAnswered ? "回答済み" : "未回答"}
              </span>
            </div>
            <div className="mb-2 text-xs text-gray-500">
              投稿日時: {formatDate(rec.questionedAt)}
            </div>
            <p className="mb-3 whitespace-pre-wrap text-gray-900">{rec.question}</p>
            {isAnswered && (
              <div className="rounded bg-blue-50 p-3 text-xs">
                <div className="mb-1 font-medium text-blue-700">
                  現在の回答 ({formatDate(rec.answeredAt)} / {rec.answeredBy ?? "未設定"})
                </div>
                <p className="whitespace-pre-wrap text-gray-900">{rec.answer}</p>
              </div>
            )}
            <AnswerForm qaId={rec.id} initialAnswer={rec.answer} />
          </li>
        );
      })}
    </ul>
  );
}
