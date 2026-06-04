"use client";

import { useState } from "react";
import type { CourseData } from "@/lib/api/adminCourses";
import { CourseType } from "@/types/prisma";
import { CourseFormModal } from "@/components/admin/courses/CourseFormModal";
import { DeleteCourseButton } from "@/components/admin/courses/DeleteCourseButton";

const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  [CourseType.BEGINNER]: "初学者コース",
  [CourseType.EXPERIENCED]: "経験者コース",
};

interface Props {
  courses: CourseData[];
}

export function CoursePageClient({ courses }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseData | null>(null);

  function openCreateModal() {
    setEditingCourse(null);
    setModalOpen(true);
  }

  function openEditModal(course: CourseData) {
    setEditingCourse(course);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCourse(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">コース管理</h1>
        <button
          onClick={openCreateModal}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          新規コース作成
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                コース名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                タイプ
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                  コースが登録されていません
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{course.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {COURSE_TYPE_LABELS[course.type] ?? course.type}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(course)}
                        className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        編集
                      </button>
                      <DeleteCourseButton id={course.id} name={course.name} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen &&
        (editingCourse ? (
          <CourseFormModal mode="edit" course={editingCourse} onClose={closeModal} />
        ) : (
          <CourseFormModal mode="create" onClose={closeModal} />
        ))}
    </div>
  );
}
