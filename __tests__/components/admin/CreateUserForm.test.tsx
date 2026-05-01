import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

// vi.mock はファイル先頭にホイストされるため vi.hoisted で変数を事前に宣言する
const mockPostCreateUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminUsers", () => ({
  postCreateUser: mockPostCreateUser,
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("CreateUserForm", () => {
  beforeEach(() => {
    mockPostCreateUser.mockReset();
  });

  it("test_CreateUserForm_renders_email_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("test_CreateUserForm_renders_name_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("氏名")).toBeInTheDocument();
  });

  it("test_CreateUserForm_renders_password_input_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("パスワード")).toBeInTheDocument();
  });

  it("test_CreateUserForm_renders_courseType_select_field", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByLabelText("コースタイプ")).toBeInTheDocument();
  });

  it("test_CreateUserForm_renders_submit_button", () => {
    renderWithQuery(<CreateUserForm />);

    expect(screen.getByRole("button", { name: "受講者を登録" })).toBeInTheDocument();
  });

  it("test_CreateUserForm_submit_calls_postCreateUser_with_correct_email", async () => {
    mockPostCreateUser.mockResolvedValue(undefined);

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
      expect(mockPostCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "new@example.com" }),
        expect.anything()
      );
    });
  });

  it("test_CreateUserForm_submit_calls_postCreateUser_with_correct_name", async () => {
    mockPostCreateUser.mockResolvedValue(undefined);

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
      expect(mockPostCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: "新しい受講者" }),
        expect.anything()
      );
    });
  });

  it("test_CreateUserForm_submit_success_shows_success_message", async () => {
    mockPostCreateUser.mockResolvedValue(undefined);

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

  it("test_CreateUserForm_empty_email_shows_validation_error", async () => {
    renderWithQuery(<CreateUserForm />);

    fireEvent.change(screen.getByLabelText("氏名"), {
      target: { value: "テスト" },
    });
    fireEvent.change(screen.getByLabelText("パスワード"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "受講者を登録" }));

    await waitFor(() => {
      expect(screen.getByText("メールアドレスは必須です")).toBeInTheDocument();
    });
  });
});
