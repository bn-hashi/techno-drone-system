import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeleteVideoButton } from "@/components/admin/videos/DeleteVideoButton";

const mockDeleteVideo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminVideos", () => ({
  deleteVideo: mockDeleteVideo,
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

describe("DeleteVideoButton", () => {
  beforeEach(() => {
    mockDeleteVideo.mockReset();
    mockRefresh.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("test_DeleteVideoButton_renders_delete_button", () => {
    renderWithQuery(<DeleteVideoButton id="video-1" title="ドローン基礎講座" />);
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("test_DeleteVideoButton_confirm_calls_deleteVideo", async () => {
    mockDeleteVideo.mockResolvedValue(undefined);
    renderWithQuery(<DeleteVideoButton id="video-1" title="ドローン基礎講座" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(mockDeleteVideo).toHaveBeenCalledWith("video-1");
    });
  });

  it("test_DeleteVideoButton_cancel_does_not_call_deleteVideo", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<DeleteVideoButton id="video-1" title="ドローン基礎講座" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockDeleteVideo).not.toHaveBeenCalled();
  });

  it("test_DeleteVideoButton_success_calls_router_refresh", async () => {
    mockDeleteVideo.mockResolvedValue(undefined);
    renderWithQuery(<DeleteVideoButton id="video-1" title="ドローン基礎講座" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
