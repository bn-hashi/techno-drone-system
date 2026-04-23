import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusChangeButton } from "@/components/admin/StatusChangeButton";
import { UserStatus } from "@/types/prisma";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("StatusChangeButton", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // window.confirm をモック（確認ダイアログ）
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders_next_status_label_for_ACTIVE", () => {
    renderWithQuery(
      <StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />
    );

    expect(screen.getByRole("button", { name: /EXAM_PASSED/ })).toBeInTheDocument();
  });

  it("renders_disabled_button_for_DIPS_LINKED", () => {
    renderWithQuery(
      <StatusChangeButton
        userId="user-1"
        currentStatus={UserStatus.DIPS_LINKED}
      />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("click_shows_confirm_dialog", () => {
    renderWithQuery(
      <StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />
    );

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    expect(window.confirm).toHaveBeenCalled();
  });

  it("click_confirmed_calls_patch_api", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ user: {} }) });

    renderWithQuery(
      <StatusChangeButton userId="user-1" currentStatus={UserStatus.ACTIVE} />
    );

    fireEvent.click(screen.getByRole("button", { name: /EXAM_PASSED/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-1/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
        })
      );
    });
  });
});
