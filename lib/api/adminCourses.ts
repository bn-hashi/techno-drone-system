import { CourseType } from "@/types/prisma";

export interface CourseData {
  id: string;
  name: string;
  type: CourseType;
}

export interface CreateCourseInput {
  name: string;
  type: CourseType;
}

export interface UpdateCourseInput {
  name?: string;
  type?: CourseType;
}

export async function fetchCourses(): Promise<CourseData[]> {
  const response = await fetch("/api/admin/courses");
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "コース一覧の取得に失敗しました");
  }
  const body = await response.json();
  return body.courses as CourseData[];
}

export async function postCreateCourse(input: CreateCourseInput): Promise<CourseData> {
  const response = await fetch("/api/admin/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "コース作成に失敗しました");
  }
  const body = await response.json();
  return body.course as CourseData;
}

export async function patchCourse(id: string, input: UpdateCourseInput): Promise<CourseData> {
  const response = await fetch(`/api/admin/courses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "コース更新に失敗しました");
  }
  const body = await response.json();
  return body.course as CourseData;
}

export async function deleteCourse(id: string): Promise<void> {
  const response = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "コース削除に失敗しました");
  }
}
