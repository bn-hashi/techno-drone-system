"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { postImportCsv, type ImportResult } from "@/lib/api/adminQuestions";

interface Props {
  onClose: () => void;
}

export function CsvImportModal({ onClose }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation<ImportResult, Error, string>({
    mutationFn: postImportCsv,
    onSuccess: () => {
      router.refresh();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file === null) return;
    // FileReader を使う（jsdom 互換性向上 + sendBeacon 等と一貫した方式）
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      mutation.mutate(text);
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-modal-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="csv-import-modal-title" className="mb-4 text-lg font-semibold">
          CSV インポート
        </h2>

        <p className="mb-3 text-xs text-gray-600">
          ヘッダー: subjectCode, body, choice1, choice2, choice3, correctIndex(1-3), explanation
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700">
              CSV ファイル
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </div>

          {mutation.isSuccess && (
            <p className="rounded bg-green-50 p-3 text-sm text-green-800" role="status">
              {mutation.data.imported} 件登録、{mutation.data.skipped} 件スキップ（重複）
            </p>
          )}
          {mutation.isError && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
              {mutation.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={file === null || mutation.isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              インポート
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
