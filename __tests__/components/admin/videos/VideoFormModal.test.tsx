import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VideoFormModal } from "@/components/admin/videos/VideoFormModal";

const mockPostCreateVideo = vi.hoisted(() => vi.fn());
const mockPatchVideo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminVideos", () => ({
  postCreateVideo: mockPostCreateVideo,
  patchVideo: mockPatchVideo,
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

const subjects = [
  {
    id: "subject-1",
    name: "地上基礎知識",
    requiredMinutesBeginner: 60,
    requiredMinutesExperienced: 30,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
const courses = [
  {
    id: "course-1",
    name: "初学者コース",
    type: "BEGINNER" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("VideoFormModal — 新規作成モード", () => {
  beforeEach(() => {
    mockPostCreateVideo.mockReset();
    mockPatchVideo.mockReset();
    mockRefresh.mockReset();
  });

  it("test_VideoFormModal_create_renders_title_input", () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );
    expect(screen.getByLabelText("タイトル")).toBeInTheDocument();
  });

  it("test_VideoFormModal_create_renders_subject_select", () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );
    expect(screen.getByLabelText("科目")).toBeInTheDocument();
  });

  it("test_VideoFormModal_create_renders_course_select", () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );
    expect(screen.getByLabelText("コース")).toBeInTheDocument();
  });

  it("test_VideoFormModal_create_renders_submit_button", () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
  });

  it("test_VideoFormModal_create_empty_title_shows_validation_error", async () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "作成" }));
    await waitFor(() => expect(screen.getByText("タイトルは必須です")).toBeInTheDocument());
  });

  it("test_VideoFormModal_create_empty_filepath_shows_validation_error", async () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "ドローン基礎" } });
    fireEvent.change(screen.getByLabelText("視聴時間（秒）"), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(screen.getByText("ファイルパスは必須です")).toBeInTheDocument());
  });

  it("test_VideoFormModal_create_empty_subject_shows_validation_error", async () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={[]} courses={courses} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "ドローン基礎" } });
    fireEvent.change(screen.getByLabelText("ファイルパス"), {
      target: { value: "/videos/basic.mp4" },
    });
    fireEvent.change(screen.getByLabelText("視聴時間（秒）"), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(screen.getByText("科目を選択してください")).toBeInTheDocument());
  });

  it("test_VideoFormModal_create_empty_course_shows_validation_error", async () => {
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={[]} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "ドローン基礎" } });
    fireEvent.change(screen.getByLabelText("ファイルパス"), {
      target: { value: "/videos/basic.mp4" },
    });
    fireEvent.change(screen.getByLabelText("視聴時間（秒）"), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(screen.getByText("コースを選択してください")).toBeInTheDocument());
  });

  it("test_VideoFormModal_create_valid_submission_calls_postCreateVideo", async () => {
    mockPostCreateVideo.mockResolvedValue(undefined);
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "ドローン基礎" } });
    fireEvent.change(screen.getByLabelText("ファイルパス"), {
      target: { value: "/videos/basic.mp4" },
    });
    fireEvent.change(screen.getByLabelText("視聴時間（秒）"), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => {
      expect(mockPostCreateVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "ドローン基礎",
          filePath: "/videos/basic.mp4",
          duration: 3600,
        }),
        expect.anything()
      );
    });
  });

  it("test_VideoFormModal_create_success_calls_router_refresh", async () => {
    mockPostCreateVideo.mockResolvedValue(undefined);
    renderWithQuery(
      <VideoFormModal mode="create" subjects={subjects} courses={courses} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "ドローン基礎" } });
    fireEvent.change(screen.getByLabelText("ファイルパス"), {
      target: { value: "/videos/basic.mp4" },
    });
    fireEvent.change(screen.getByLabelText("視聴時間（秒）"), { target: { value: "3600" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});

describe("VideoFormModal — 編集モード", () => {
  const existingVideo = {
    id: "video-1",
    title: "ドローン基礎講座",
    description: null,
    subjectId: "subject-1",
    courseId: "course-1",
    filePath: "/videos/basic.mp4",
    duration: 3600,
    sortOrder: 0,
    isPublished: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    mockPostCreateVideo.mockReset();
    mockPatchVideo.mockReset();
    mockRefresh.mockReset();
  });

  it("test_VideoFormModal_edit_prefills_title", () => {
    renderWithQuery(
      <VideoFormModal
        mode="edit"
        video={existingVideo}
        subjects={subjects}
        courses={courses}
        onClose={noop}
      />
    );
    expect(screen.getByRole("textbox", { name: "タイトル" })).toHaveValue("ドローン基礎講座");
  });

  it("test_VideoFormModal_edit_renders_update_button", () => {
    renderWithQuery(
      <VideoFormModal
        mode="edit"
        video={existingVideo}
        subjects={subjects}
        courses={courses}
        onClose={noop}
      />
    );
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("test_VideoFormModal_edit_submission_calls_patchVideo", async () => {
    mockPatchVideo.mockResolvedValue(undefined);
    renderWithQuery(
      <VideoFormModal
        mode="edit"
        video={existingVideo}
        subjects={subjects}
        courses={courses}
        onClose={noop}
      />
    );

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "更新済みタイトル" } });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(mockPatchVideo).toHaveBeenCalledWith(
        "video-1",
        expect.objectContaining({ title: "更新済みタイトル" })
      );
    });
  });
});
