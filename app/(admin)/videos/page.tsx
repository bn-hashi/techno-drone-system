import { getCourseService, getSubjectService, getVideoService } from "@/lib/serviceFactory";
import { VideoPageClient } from "@/components/admin/videos/VideoPageClient";

export default async function VideosPage() {
  const [videos, subjects, courses] = await Promise.all([
    getVideoService().listVideos(),
    getSubjectService().listSubjects(),
    getCourseService().listCourses(),
  ]);

  const videoData = videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    subjectId: v.subjectId,
    courseId: v.courseId,
    filePath: v.filePath,
    duration: v.duration,
    sortOrder: v.sortOrder,
    isPublished: v.isPublished,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  const subjectData = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    requiredMinutesBeginner: s.requiredMinutesBeginner,
    requiredMinutesExperienced: s.requiredMinutesExperienced,
  }));

  const courseData = courses.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <VideoPageClient videos={videoData} subjects={subjectData} courses={courseData} />
    </div>
  );
}
