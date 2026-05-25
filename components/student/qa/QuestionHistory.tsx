import type { QARecordItem } from "@/lib/api/studentQA";

interface QuestionHistoryProps {
  records: QARecordItem[];
}

function formatDate(date: string | null): string {
  if (date === null) return "-";
  return new Date(date).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

export function QuestionHistory({ records }: QuestionHistoryProps) {
  if (records.length === 0) {
    return <p className="text-sm text-gray-500">まだ質問がありません。</p>;
  }
  return (
    <ul data-testid="qa-history" className="space-y-3">
      {records.map((rec) => (
        <li
          key={rec.id}
          className="rounded-lg border border-gray-200 bg-white p-4 text-sm"
        >
          <div className="mb-2 text-xs text-gray-500">
            投稿日時: {formatDate(rec.questionedAt)}
          </div>
          <p className="mb-3 whitespace-pre-wrap text-gray-900">{rec.question}</p>
          {rec.answer !== null ? (
            <div className="rounded bg-blue-50 p-3">
              <div className="mb-1 text-xs font-medium text-blue-700">
                回答 ({formatDate(rec.answeredAt)})
              </div>
              <p className="whitespace-pre-wrap text-gray-900">{rec.answer}</p>
            </div>
          ) : (
            <p className="rounded bg-gray-50 p-3 text-xs text-gray-500">
              回答待ちです。回答が届くとメールでお知らせします。
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
