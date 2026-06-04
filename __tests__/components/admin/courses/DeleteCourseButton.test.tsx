import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeleteCourseButton } from "@/components/admin/courses/DeleteCourseButton";

const mockDeleteCourse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminCourses", () => ({
  deleteCourse: mockDeleteCourse,
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

describe("DeleteCourseButton", () => {
  beforeEach(() => {
    mockDeleteCourse.mockReset();
    mockRefresh.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("test_DeleteCourseButton_renders_delete_button", () => {
    renderWithQuery(<DeleteCourseButton id="course-1" name="初学者コース" />);
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("test_DeleteCourseButton_confirm_calls_deleteCourse", async () => {
    mockDeleteCourse.mockResolvedValue(undefined);
    renderWithQuery(<DeleteCourseButton id="course-1" name="初学者コース" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockDeleteCourse).toHaveBeenCalledWith("course-1");
    });
  });

  it("test_DeleteCourseButton_cancel_does_not_call_deleteCourse", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<DeleteCourseButton id="course-1" name="初学者コース" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockDeleteCourse).not.toHaveBeenCalled();
  });

  it("test_DeleteCourseButton_success_calls_router_refresh", async () => {
    mockDeleteCourse.mockResolvedValue(undefined);
    renderWithQuery(<DeleteCourseButton id="course-1" name="初学者コース" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
