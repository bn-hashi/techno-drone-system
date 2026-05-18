import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService, getProgressService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: { courseId: string };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function CourseVideosPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    notFound();
  }

  const videos = await getVideoService().listVideos({
    courseId: params.courseId,
    isPublished: true,
  });

  if (videos.length === 0) {
    notFound();
  }

  const progressService = getProgressService();
  const userId = session.user.id;
  const videosWithLock = await Promise.all(
    videos
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(async (video) => ({
        video,
        isLocked: !(await progressService.canWatchVideo(userId, video.id)),
      }))
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">動画一覧</h1>
      <ul className="space-y-3">
        {videosWithLock.map(({ video, isLocked }) => (
          <li key={video.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium text-gray-900">{video.title}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  順序: {video.sortOrder} / 時間: {formatDuration(video.duration)}
                </p>
              </div>
              {isLocked ? (
                <span className="inline-flex rounded bg-gray-100 px-3 py-1 text-xs text-gray-500">
                  🔒 ロック中
                </span>
              ) : (
                <Link
                  href={`/courses/${params.courseId}/videos/${video.id}`}
                  className="inline-flex rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                >
                  視聴
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
