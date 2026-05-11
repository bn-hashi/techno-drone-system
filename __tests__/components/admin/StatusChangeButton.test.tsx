import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusChangeButton } from "@/components/admin/StatusChangeButton";
import { UserStatus } from "@/types/prisma";

// router.refresh() を検証するため useRouter をモック
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// vi.mock はファイル先頭にホイストされるため vi.hoisted で変数を事前に宣言する
const mockPatchUserStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminUsers", () => ({
  patchUserStatus: mockPatchUserStatus,
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("StatusChangeButton", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockPatchUserStatus.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("test_StatusChangeButton_renders_next_status_label_for_ACTIVE", () => {
    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />);

    expect(screen.getByRole("button", { name: /EXAM_PASSED/ })).toBeInTheDocument();
  });

  it("test_StatusChangeButton_renders_disabled_button_for_DIPS_LINKED", () => {
    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.DIPS_LINKED} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("test_StatusChangeButton_click_shows_confirm_dialog", () => {
    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />);

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    expect(window.confirm).toHaveBeenCalled();
  });

  it("test_StatusChangeButton_click_confirmed_calls_patchUserStatus_with_correct_args", async () => {
    mockPatchUserStatus.mockResolvedValue(undefined);

    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />);

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    await waitFor(() => {
      expect(mockPatchUserStatus).toHaveBeenCalledWith("user-1", UserStatus.EXAM_PASSED);
    });
  });

  it("test_StatusChangeButton_click_confirmed_calls_router_refresh_on_success", async () => {
    mockPatchUserStatus.mockResolvedValue(undefined);

    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />);

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("test_StatusChangeButton_click_error_shows_error_message", async () => {
    mockPatchUserStatus.mockRejectedValue(new Error("無効なステータス遷移です"));

    renderWithQuery(<StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />);

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("無効なステータス遷移です");
    });
  });
});
