"use client";

import { useMemo, useState } from "react";
import type { QuestionData } from "@/lib/api/adminQuestions";
import { QuestionFormModal, type SubjectOption } from "@/components/admin/questions/QuestionFormModal";
import { DeleteQuestionButton } from "@/components/admin/questions/DeleteQuestionButton";
import { CsvImportModal } from "@/components/admin/questions/CsvImportModal";

interface Props {
  questions: QuestionData[];
  subjects: SubjectOption[];
}

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; question: QuestionData }
  | { kind: "import" };

export function QuestionPageClient({ questions, subjects }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [filterSubjectId, setFilterSubjectId] = useState<string>("");

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s.name])),
    [subjects]
  );

  const filtered = useMemo(() => {
    if (filterSubjectId === "") return questions;
    return questions.filter((q) => q.subjectId === filterSubjectId);
  }, [questions, filterSubjectId]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">問題バンク</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ kind: "import" })}
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            CSV インポート
          </button>
          <button
            onClick={() => setModal({ kind: "create" })}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            新規作成
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="filter-subject" className="text-sm text-gray-700">
          科目フィルタ
        </label>
        <select
          id="filter-subject"
          value={filterSubjectId}
          onChange={(e) => setFilterSubjectId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">すべて</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                科目
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                問題文
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                正答
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  問題が登録されていません
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {subjectMap[q.subjectId] ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    <div className="max-w-md truncate">{q.body}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {q.choices[q.correctIndex] ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal({ kind: "edit", question: q })}
                        className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        編集
                      </button>
                      <DeleteQuestionButton id={q.id} body={q.body} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal.kind === "create" && (
        <QuestionFormModal
          mode="create"
          subjects={subjects}
          onClose={() => setModal({ kind: "closed" })}
        />
      )}
      {modal.kind === "edit" && (
        <QuestionFormModal
          mode="edit"
          question={modal.question}
          subjects={subjects}
          onClose={() => setModal({ kind: "closed" })}
        />
      )}
      {modal.kind === "import" && (
        <CsvImportModal onClose={() => setModal({ kind: "closed" })} />
      )}
    </div>
  );
}
