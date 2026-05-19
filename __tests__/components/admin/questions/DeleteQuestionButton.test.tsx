import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeleteQuestionButton } from "@/components/admin/questions/DeleteQuestionButton";

const mockDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminQuestions", () => ({
  deleteQuestion: mockDelete,
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

describe("DeleteQuestionButton", () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockRefresh.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("test_renders_delete_button", () => {
    renderWithQuery(<DeleteQuestionButton id="q-1" body="問題本文" />);
    expect(screen.getByRole("button", { name: "削除" })).toBeInTheDocument();
  });

  it("test_confirm_calls_delete", async () => {
    mockDelete.mockResolvedValue(undefined);
    renderWithQuery(<DeleteQuestionButton id="q-1" body="問題本文" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("q-1"));
  });

  it("test_cancel_does_not_call_delete", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<DeleteQuestionButton id="q-1" body="問題本文" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("test_success_calls_router_refresh", async () => {
    mockDelete.mockResolvedValue(undefined);
    renderWithQuery(<DeleteQuestionButton id="q-1" body="問題本文" />);

    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
