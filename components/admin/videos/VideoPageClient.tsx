"use client";

import { useState } from "react";
import type { VideoData } from "@/lib/api/adminVideos";
import type { SubjectData } from "@/lib/api/adminSubjects";
import type { CourseData } from "@/lib/api/adminCourses";
import { VideoFormModal } from "@/components/admin/videos/VideoFormModal";
import { DeleteVideoButton } from "@/components/admin/videos/DeleteVideoButton";

interface Props {
  videos: VideoData[];
  subjects: SubjectData[];
  courses: CourseData[];
}

export function VideoPageClient({ videos, subjects, courses }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoData | null>(null);

  function openCreateModal() {
    setEditingVideo(null);
    setModalOpen(true);
  }

  function openEditModal(video: VideoData) {
    setEditingVideo(video);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingVideo(null);
  }

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c.name]));

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">動画管理</h1>
        <button
          onClick={openCreateModal}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          新規動画登録
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                タイトル
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                科目
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                コース
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                時間
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                公開
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {videos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  動画が登録されていません
                </td>
              </tr>
            ) : (
              videos.map((video) => (
                <tr key={video.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    <div className="max-w-xs truncate">{video.title}</div>
                    <div className="text-xs text-gray-400">順序: {video.sortOrder}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {subjectMap[video.subjectId] ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {courseMap[video.courseId] ?? "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {formatDuration(video.duration)}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        video.isPublished
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {video.isPublished ? "公開" : "非公開"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(video)}
                        className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        編集
                      </button>
                      <DeleteVideoButton id={video.id} title={video.title} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        editingVideo ? (
          <VideoFormModal
            mode="edit"
            video={editingVideo}
            subjects={subjects}
            courses={courses}
            onClose={closeModal}
          />
        ) : (
          <VideoFormModal
            mode="create"
            subjects={subjects}
            courses={courses}
            onClose={closeModal}
          />
        )
      )}
    </div>
  );
}
