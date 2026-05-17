export interface VideoData {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  courseId: string;
  filePath: string;
  duration: number;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupervisorData {
  id: string;
  videoId: string;
  name: string;
  instructorRegistrationNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVideoInput {
  title: string;
  description?: string;
  subjectId: string;
  courseId: string;
  filePath: string;
  duration: number;
  sortOrder?: number;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string;
  subjectId?: string;
  courseId?: string;
  filePath?: string;
  duration?: number;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface AddSupervisorInput {
  name: string;
  instructorRegistrationNumber: string;
}

export interface UpdateSupervisorInput {
  name?: string;
  instructorRegistrationNumber?: string;
}

export interface VideoFilter {
  courseId?: string;
  isPublished?: boolean;
}

export async function fetchVideos(filter?: VideoFilter): Promise<VideoData[]> {
  const params = new URLSearchParams();
  if (filter?.courseId !== undefined) params.set("courseId", filter.courseId);
  if (filter?.isPublished !== undefined) params.set("isPublished", String(filter.isPublished));

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/admin/videos${query}`);
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "動画一覧の取得に失敗しました");
  }
  const body = await response.json();
  return body.videos as VideoData[];
}

export async function postCreateVideo(input: CreateVideoInput): Promise<VideoData> {
  const response = await fetch("/api/admin/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "動画作成に失敗しました");
  }
  const body = await response.json();
  return body.video as VideoData;
}

export async function patchVideo(id: string, input: UpdateVideoInput): Promise<VideoData> {
  const response = await fetch(`/api/admin/videos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "動画更新に失敗しました");
  }
  const body = await response.json();
  return body.video as VideoData;
}

export async function deleteVideo(id: string): Promise<void> {
  const response = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "動画削除に失敗しました");
  }
}

export async function postAddSupervisor(
  videoId: string,
  input: AddSupervisorInput
): Promise<SupervisorData> {
  const response = await fetch(`/api/admin/videos/${videoId}/supervisors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "監修者追加に失敗しました");
  }
  const body = await response.json();
  return body.supervisor as SupervisorData;
}

export async function patchSupervisor(
  videoId: string,
  supervisorId: string,
  input: UpdateSupervisorInput
): Promise<SupervisorData> {
  const response = await fetch(`/api/admin/videos/${videoId}/supervisors/${supervisorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "監修者更新に失敗しました");
  }
  const body = await response.json();
  return body.supervisor as SupervisorData;
}

export async function deleteSupervisor(videoId: string, supervisorId: string): Promise<void> {
  const response = await fetch(`/api/admin/videos/${videoId}/supervisors/${supervisorId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "監修者削除に失敗しました");
  }
}
