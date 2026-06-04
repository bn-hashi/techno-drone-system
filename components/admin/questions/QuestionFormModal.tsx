"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  postCreateQuestion,
  patchQuestion,
  type QuestionData,
  type CreateQuestionInput,
  type UpdateQuestionInput,
} from "@/lib/api/adminQuestions";

export interface SubjectOption {
  id: string;
  code: string;
  name: string;
}

type CreateMode = { mode: "create"; question?: undefined };
type EditMode = { mode: "edit"; question: QuestionData };

type Props = (CreateMode | EditMode) & {
  subjects: SubjectOption[];
  onClose: () => void;
};

export function QuestionFormModal({ mode, question, subjects, onClose }: Props) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(question?.subjectId ?? subjects[0]?.id ?? "");
  const [body, setBody] = useState(question?.body ?? "");
  const [choice1, setChoice1] = useState(question?.choices?.[0] ?? "");
  const [choice2, setChoice2] = useState(question?.choices?.[1] ?? "");
  const [choice3, setChoice3] = useState(question?.choices?.[2] ?? "");
  const [correctIndex, setCorrectIndex] = useState(question?.correctIndex ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useMutation<QuestionData, Error, CreateQuestionInput>({
    mutationFn: postCreateQuestion,
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  const updateMutation = useMutation<QuestionData, Error, { id: string; input: UpdateQuestionInput }>({
    mutationFn: ({ id, input }) => patchQuestion(id, input),
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!body.trim()) {
      setValidationError("問題文は必須です");
      return;
    }
    if (!subjectId) {
      setValidationError("科目を選択してください");
      return;
    }
    if (!choice1.trim() || !choice2.trim() || !choice3.trim()) {
      setValidationError("選択肢は 3 つすべて入力してください");
      return;
    }

    const payload = {
      subjectId,
      body: body.trim(),
      choices: [choice1.trim(), choice2.trim(), choice3.trim()],
      correctIndex,
      explanation: explanation.trim(),
    };

    if (mode === "edit" && question) {
      updateMutation.mutate({ id: question.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-form-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="question-form-modal-title" className="mb-4 text-lg font-semibold">
          {mode === "edit" ? "問題を編集" : "問題を作成"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="question-subject" className="block text-sm font-medium text-gray-700">
              科目
            </label>
            <select
              id="question-subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="question-body" className="block text-sm font-medium text-gray-700">
              問題文
            </label>
            <textarea
              id="question-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {[
            { label: "選択肢1", id: "question-choice-1", value: choice1, setValue: setChoice1, index: 0 },
            { label: "選択肢2", id: "question-choice-2", value: choice2, setValue: setChoice2, index: 1 },
            { label: "選択肢3", id: "question-choice-3", value: choice3, setValue: setChoice3, index: 2 },
          ].map(({ label, id, value, setValue, index }) => (
            <div key={id} className="flex items-center gap-3">
              <input
                type="radio"
                name="correct-choice"
                id={`${id}-correct`}
                checked={correctIndex === index}
                onChange={() => setCorrectIndex(index)}
                aria-label={`${label} を正解にする`}
              />
              <div className="flex-1">
                <label htmlFor={id} className="block text-sm font-medium text-gray-700">
                  {label}
                </label>
                <input
                  id={id}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}

          <div>
            <label htmlFor="question-explanation" className="block text-sm font-medium text-gray-700">
              解説
            </label>
            <textarea
              id="question-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}
          {mutationError instanceof Error && (
            <p className="text-sm text-red-600" role="alert">
              {mutationError.message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mode === "edit" ? "更新" : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
