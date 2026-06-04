"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  postCreateVideo,
  patchVideo,
  type VideoData,
  type CreateVideoInput,
  type UpdateVideoInput,
} from "@/lib/api/adminVideos";
import type { SubjectData } from "@/lib/api/adminSubjects";
import type { CourseData } from "@/lib/api/adminCourses";

type CreateMode = { mode: "create"; video?: undefined };
type EditMode = { mode: "edit"; video: VideoData };

type Props = (CreateMode | EditMode) & {
  subjects: SubjectData[];
  courses: CourseData[];
  onClose: () => void;
};

export function VideoFormModal({ mode, video, subjects, courses, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(video?.title ?? "");
  const [description, setDescription] = useState(video?.description ?? "");
  const [subjectId, setSubjectId] = useState(video?.subjectId ?? subjects[0]?.id ?? "");
  const [courseId, setCourseId] = useState(video?.courseId ?? courses[0]?.id ?? "");
  const [filePath, setFilePath] = useState(video?.filePath ?? "");
  const [duration, setDuration] = useState(video?.duration?.toString() ?? "");
  const [sortOrder, setSortOrder] = useState(video?.sortOrder?.toString() ?? "0");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createMutation = useMutation<VideoData, Error, CreateVideoInput>({
    mutationFn: postCreateVideo,
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  const updateMutation = useMutation<VideoData, Error, { id: string; input: UpdateVideoInput }>({
    mutationFn: ({ id, input }) => patchVideo(id, input),
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

    if (!title.trim()) {
      setValidationError("タイトルは必須です");
      return;
    }

    if (!subjectId) {
      setValidationError("科目を選択してください");
      return;
    }

    if (!courseId) {
      setValidationError("コースを選択してください");
      return;
    }

    if (!filePath.trim()) {
      setValidationError("ファイルパスは必須です");
      return;
    }

    const durationNumber = Number(duration);
    if (!Number.isInteger(durationNumber) || durationNumber <= 0) {
      setValidationError("視聴時間は1以上の整数を入力してください");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      subjectId,
      courseId,
      filePath: filePath.trim(),
      duration: durationNumber,
      sortOrder: Number(sortOrder) || 0,
    };

    if (mode === "edit" && video) {
      updateMutation.mutate({ id: video.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-form-modal-title"
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
      >
        <h2 id="video-form-modal-title" className="mb-4 text-lg font-semibold">
          {mode === "edit" ? "動画を編集" : "動画を作成"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="video-title" className="block text-sm font-medium text-gray-700">
              タイトル
            </label>
            <input
              id="video-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="video-description" className="block text-sm font-medium text-gray-700">
              説明
            </label>
            <textarea
              id="video-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="video-subject" className="block text-sm font-medium text-gray-700">
              科目
            </label>
            <select
              id="video-subject"
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
            <label htmlFor="video-course" className="block text-sm font-medium text-gray-700">
              コース
            </label>
            <select
              id="video-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="video-filepath" className="block text-sm font-medium text-gray-700">
              ファイルパス
            </label>
            <input
              id="video-filepath"
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="video-duration" className="block text-sm font-medium text-gray-700">
                視聴時間（秒）
              </label>
              <input
                id="video-duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="video-sort-order" className="block text-sm font-medium text-gray-700">
                表示順
              </label>
              <input
                id="video-sort-order"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
