import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, CourseType } from "@/types/prisma";
import { CourseNotFoundError, BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getCourseService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getCourseService } from "@/lib/serviceFactory";
import { GET, PATCH, DELETE } from "@/app/api/admin/courses/[id]/route";

const mockGetCourse = vi.fn();
const mockUpdateCourse = vi.fn();
const mockDeleteCourse = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };
const params = { id: "course-1" };

const mockCourse = {
  id: "course-1",
  name: "初学者コース",
  type: CourseType.BEGINNER,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeRequest = (method: string, body?: unknown) =>
  new Request(`http://localhost/api/admin/courses/${params.id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

describe("GET /api/admin/courses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseService).mockReturnValue({
      listCourses: vi.fn(),
      getCourse: mockGetCourse,
      createCourse: vi.fn(),
      updateCourse: mockUpdateCourse,
      deleteCourse: mockDeleteCourse,
    } as unknown as ReturnType<typeof getCourseService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_existing_course_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCourse.mockResolvedValue(mockCourse);

    const response = await GET(makeRequest("GET"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.course).toEqual(mockCourse);
  });

  it("test_GET_course_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCourse.mockRejectedValue(new CourseNotFoundError("course-1"));

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/admin/courses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseService).mockReturnValue({
      listCourses: vi.fn(),
      getCourse: mockGetCourse,
      createCourse: vi.fn(),
      updateCourse: mockUpdateCourse,
      deleteCourse: mockDeleteCourse,
    } as unknown as ReturnType<typeof getCourseService>);
  });

  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await PATCH(makeRequest("PATCH", { name: "new" }), { params });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_valid_body_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateCourse.mockResolvedValue({ ...mockCourse, name: "改訂版" });

    const response = await PATCH(makeRequest("PATCH", { name: "改訂版" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.course.name).toBe("改訂版");
  });

  it("test_PATCH_course_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateCourse.mockRejectedValue(new CourseNotFoundError("course-1"));

    const response = await PATCH(makeRequest("PATCH", { name: "test" }), { params });

    expect(response.status).toBe(404);
  });

  it("test_PATCH_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateCourse.mockRejectedValue(new BusinessError("コース名は必須です"));

    const response = await PATCH(makeRequest("PATCH", { name: "" }), { params });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/courses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCourseService).mockReturnValue({
      listCourses: vi.fn(),
      getCourse: mockGetCourse,
      createCourse: vi.fn(),
      updateCourse: mockUpdateCourse,
      deleteCourse: mockDeleteCourse,
    } as unknown as ReturnType<typeof getCourseService>);
  });

  it("test_DELETE_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(401);
  });

  it("test_DELETE_existing_course_returns_204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDeleteCourse.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(204);
  });

  it("test_DELETE_course_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDeleteCourse.mockRejectedValue(new CourseNotFoundError("course-1"));

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(404);
  });
});
