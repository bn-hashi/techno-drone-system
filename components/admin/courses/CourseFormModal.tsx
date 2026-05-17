"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CourseType } from "@/types/prisma";
import {
  postCreateCourse,
  patchCourse,
  type CourseData,
  type CreateCourseInput,
  type UpdateCourseInput,
} from "@/lib/api/adminCourses";

type CreateMode = { mode: "create"; course?: undefined };
type EditMode = { mode: "edit"; course: CourseData };

type Props = (CreateMode | EditMode) & { onClose: () => void };

export function CourseFormModal({ mode, course, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState(course?.name ?? "");
  const [type, setType] = useState<CourseType>(course?.type ?? CourseType.BEGINNER);
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useMutation<CourseData, Error, CreateCourseInput>({
    mutationFn: postCreateCourse,
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  const updateMutation = useMutation<CourseData, Error, { id: string; input: UpdateCourseInput }>({
    mutationFn: ({ id, input }) => patchCourse(id, input),
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

    if (!name.trim()) {
      setValidationError("コース名は必須です");
      return;
    }

    if (mode === "edit" && course) {
      updateMutation.mutate({ id: course.id, input: { name: name.trim(), type } });
    } else {
      createMutation.mutate({ name: name.trim(), type });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {mode === "edit" ? "コースを編集" : "コースを作成"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="course-name" className="block text-sm font-medium text-gray-700">
              コース名
            </label>
            <input
              id="course-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="course-type" className="block text-sm font-medium text-gray-700">
              コースタイプ
            </label>
            <select
              id="course-type"
              value={type}
              onChange={(e) => setType(e.target.value as CourseType)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={CourseType.BEGINNER}>初学者コース</option>
              <option value={CourseType.EXPERIENCED}>経験者コース</option>
            </select>
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
