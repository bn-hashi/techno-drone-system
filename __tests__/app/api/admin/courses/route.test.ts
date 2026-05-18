import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, CourseType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getCourseService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getCourseService } from "@/lib/serviceFactory";
import { GET, POST } from "@/app/api/admin/courses/route";

const mockListCourses = vi.fn();
const mockCreateCourse = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

const mockCourse = {
  id: "course-1",
  name: "初学者コース",
  type: CourseType.BEGINNER,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/admin/courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseService).mockReturnValue({
      listCourses: mockListCourses,
      getCourse: vi.fn(),
      createCourse: mockCreateCourse,
      updateCourse: vi.fn(),
      deleteCourse: vi.fn(),
    } as unknown as ReturnType<typeof getCourseService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/courses"));

    expect(response.status).toBe(401);
  });

  it("test_GET_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await GET(new Request("http://localhost/api/admin/courses"));

    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListCourses.mockResolvedValue([mockCourse]);

    const response = await GET(new Request("http://localhost/api/admin/courses"));

    expect(response.status).toBe(200);
  });

  it("test_GET_admin_returns_courses_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListCourses.mockResolvedValue([mockCourse]);

    const response = await GET(new Request("http://localhost/api/admin/courses"));
    const body = await response.json();

    expect(body.courses).toHaveLength(1);
  });
});

describe("POST /api/admin/courses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseService).mockReturnValue({
      listCourses: mockListCourses,
      getCourse: vi.fn(),
      createCourse: mockCreateCourse,
      updateCourse: vi.fn(),
      deleteCourse: vi.fn(),
    } as unknown as ReturnType<typeof getCourseService>);
  });

  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makePostRequest({ name: "test", type: CourseType.BEGINNER }));

    expect(response.status).toBe(401);
  });

  it("test_POST_missing_name_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makePostRequest({ type: CourseType.BEGINNER }));

    expect(response.status).toBe(400);
  });

  it("test_POST_invalid_type_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makePostRequest({ name: "test", type: "INVALID" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_valid_body_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateCourse.mockResolvedValue(mockCourse);

    const response = await POST(
      makePostRequest({ name: "初学者コース", type: CourseType.BEGINNER })
    );

    expect(response.status).toBe(201);
  });

  it("test_POST_valid_body_returns_course_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateCourse.mockResolvedValue(mockCourse);

    const response = await POST(
      makePostRequest({ name: "初学者コース", type: CourseType.BEGINNER })
    );
    const body = await response.json();

    expect(body.course).toEqual(mockCourse);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateCourse.mockRejectedValue(new BusinessError("コース名は必須です"));

    const response = await POST(makePostRequest({ name: "", type: CourseType.BEGINNER }));

    expect(response.status).toBe(400);
  });
});
