import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

// fetch のグローバルモック
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

describe("CreateUserForm", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("renders_email_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("renders_name_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("氏名")).toBeInTheDocument();
  });

  it("renders_password_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
  });

  it("renders_courseType_select_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("コースタイプ")).toBeInTheDocument();
  });

  it("renders_submit_button", () => {
    renderWithQuery(<CreateUserForm />);

    expect(
      screen.getByRole("button", { name: "受講者を登録" })
    ).toBeInTheDocument();
  });

  it("submit_calls_fetch_with_correct_data", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ user: {} }) });

    renderWithQuery(<CreateUserForm />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("氏名"), {
      target: { value: "新しい受講者" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "受講者を登録" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("submit_success_shows_success_message", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ user: {} }) });

    renderWithQuery(<CreateUserForm />);

    fireEvent.change(screen.getByLabelText("メールアドレス"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("氏名"), {
      target: { value: "新しい受講者" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "受講者を登録" }));

    await waitFor(() => {
      expect(screen.getByText("受講者を登録しました")).toBeInTheDocument();
    });
  });

  it("empty_email_shows_validation_error", async () => {
    renderWithQuery(<CreateUserForm />);

    fireEvent.change(screen.getByLabelText("氏名"), {
      target: { value: "テスト" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "受講者を登録" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスは必須です")
      ).toBeInTheDocument();
    });
  });
});
