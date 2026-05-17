import { getCourseService } from "@/lib/serviceFactory";
import { CoursePageClient } from "@/components/admin/courses/CoursePageClient";

export default async function CoursesPage() {
  const courses = await getCourseService().listCourses();

  const courseData = courses.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <CoursePageClient courses={courseData} />
    </div>
  );
}
