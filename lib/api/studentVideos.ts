import { extractErrorMessage } from "@/lib/api/errorHelpers";

export interface StudentVideoData {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  courseId: string;
  filePath: string;
  duration: number;
  sortOrder: number;
  isPublished: boolean;
}

export interface FetchStudentVideoResponse {
  video: StudentVideoData;
  maxWatchedSeconds: number;
}

export interface PostViewingLogInput {
  videoId: string;
  startedAt: string;
  endedAt: string;
  watchedSeconds: number;
  rawLog?: unknown;
}

export interface PostFraudFlagInput {
  type: "TAB_LEAVE";
  durationSeconds: number;
}

export async function fetchStudentVideo(id: string): Promise<FetchStudentVideoResponse> {
  const response = await fetch(`/api/student/videos/${id}`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "動画の取得に失敗しました"));
  }
  return (await response.json()) as FetchStudentVideoResponse;
}

export async function postViewingLog(input: PostViewingLogInput): Promise<void> {
  const response = await fetch("/api/student/viewing-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "視聴ログの保存に失敗しました"));
  }
}

export async function postFraudFlag(input: PostFraudFlagInput): Promise<void> {
  const response = await fetch("/api/student/fraud-flag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "不正フラグの送信に失敗しました"));
  }
}
