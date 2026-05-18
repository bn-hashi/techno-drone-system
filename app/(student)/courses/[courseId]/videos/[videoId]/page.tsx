import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVideoService, getViewingLogService } from "@/lib/serviceFactory";
import { UserRole, UserStatus } from "@/types/prisma";
import { VideoNotFoundError } from "@/services/errors";
import { VideoPlayer } from "@/components/student/VideoPlayer";

export const dynamic = "force-dynamic";

interface Props {
  params: { courseId: string; videoId: string };
}

export default async function StudentVideoViewingPage({ params }: Props) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    session.user.role !== UserRole.STUDENT ||
    session.user.status !== UserStatus.ACTIVE
  ) {
    notFound();
  }

  let video;
  try {
    video = await getVideoService().getVideo(params.videoId);
  } catch (err) {
    if (err instanceof VideoNotFoundError) notFound();
    throw err;
  }

  if (!video.isPublished || video.courseId !== params.courseId) {
    notFound();
  }

  const maxWatchedSeconds = await getViewingLogService().getMaxWatchedSeconds(
    session.user.id,
    video.id
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">{video.title}</h1>
      {video.description && (
        <p className="mb-4 whitespace-pre-wrap text-sm text-gray-700">{video.description}</p>
      )}
      <VideoPlayer
        videoId={video.id}
        src={`/videos/${video.filePath}`}
        duration={video.duration}
        initialMaxWatchedSeconds={maxWatchedSeconds}
      />
    </div>
  );
}
