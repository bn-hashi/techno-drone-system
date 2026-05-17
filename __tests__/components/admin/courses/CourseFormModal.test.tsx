import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourseType } from "@/types/prisma";
import { CourseFormModal } from "@/components/admin/courses/CourseFormModal";

const mockPostCreateCourse = vi.hoisted(() => vi.fn());
const mockPatchCourse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminCourses", () => ({
  postCreateCourse: mockPostCreateCourse,
  patchCourse: mockPatchCourse,
}));

const mockRefresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const noop = () => undefined;

describe("CourseFormModal — 新規作成モード", () => {
  beforeEach(() => {
    mockPostCreateCourse.mockReset();
    mockPatchCourse.mockReset();
    mockRefresh.mockReset();
  });

  it("test_CourseFormModal_create_renders_name_input", () => {
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);
    expect(screen.getByLabelText("コース名")).toBeInTheDocument();
  });

  it("test_CourseFormModal_create_renders_type_select", () => {
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);
    expect(screen.getByLabelText("コースタイプ")).toBeInTheDocument();
  });

  it("test_CourseFormModal_create_renders_submit_button", () => {
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("test_CourseFormModal_create_empty_name_shows_validation_error", async () => {
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "作成" }));
    await waitFor(() => expect(screen.getByText("コース名は必須です")).toBeInTheDocument());
  });

  it("test_CourseFormModal_create_valid_submission_calls_postCreateCourse", async () => {
    mockPostCreateCourse.mockResolvedValue(undefined);
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);

    fireEvent.change(screen.getByLabelText("コース名"), {
      target: { value: "初学者コース" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockPostCreateCourse).toHaveBeenCalledWith(
        { name: "初学者コース", type: CourseType.BEGINNER },
        expect.anything()
      );
    });
  });

  it("test_CourseFormModal_create_success_calls_router_refresh", async () => {
    mockPostCreateCourse.mockResolvedValue(undefined);
    renderWithQuery(<CourseFormModal mode="create" onClose={noop} />);

    fireEvent.change(screen.getByLabelText("コース名"), {
      target: { value: "初学者コース" },
    });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});

describe("CourseFormModal — 編集モード", () => {
  const existingCourse = {
    id: "course-1",
    name: "初学者コース",
    type: CourseType.BEGINNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    mockPostCreateCourse.mockReset();
    mockPatchCourse.mockReset();
    mockRefresh.mockReset();
  });

  it("test_CourseFormModal_edit_prefills_name", () => {
    renderWithQuery(<CourseFormModal mode="edit" course={existingCourse} onClose={noop} />);
    expect(screen.getByRole("textbox", { name: "コース名" })).toHaveValue("初学者コース");
  });

  it("test_CourseFormModal_edit_renders_update_button", () => {
    renderWithQuery(<CourseFormModal mode="edit" course={existingCourse} onClose={noop} />);
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("test_CourseFormModal_edit_submission_calls_patchCourse", async () => {
    mockPatchCourse.mockResolvedValue(undefined);
    renderWithQuery(<CourseFormModal mode="edit" course={existingCourse} onClose={noop} />);

    fireEvent.change(screen.getByLabelText("コース名"), {
      target: { value: "改訂版コース" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(mockPatchCourse).toHaveBeenCalledWith("course-1", {
        name: "改訂版コース",
        type: CourseType.BEGINNER,
      });
    });
  });
});
