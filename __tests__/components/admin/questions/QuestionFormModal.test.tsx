import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuestionFormModal } from "@/components/admin/questions/QuestionFormModal";

const mockPostCreate = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminQuestions", () => ({
  postCreateQuestion: mockPostCreate,
  patchQuestion: mockPatch,
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
    code: "SUBJECT_01",
    name: "規則",
  },
];

describe("QuestionFormModal — create mode", () => {
  beforeEach(() => {
    mockPostCreate.mockReset();
    mockPatch.mockReset();
    mockRefresh.mockReset();
  });

  it("test_create_renders_body_input", () => {
    renderWithQuery(<QuestionFormModal mode="create" subjects={subjects} onClose={noop} />);
    expect(screen.getByLabelText("問題文")).toBeInTheDocument();
  });

  it("test_create_renders_three_choice_inputs", () => {
    renderWithQuery(<QuestionFormModal mode="create" subjects={subjects} onClose={noop} />);
    expect(screen.getByLabelText("選択肢1")).toBeInTheDocument();
    expect(screen.getByLabelText("選択肢2")).toBeInTheDocument();
    expect(screen.getByLabelText("選択肢3")).toBeInTheDocument();
  });

  it("test_create_empty_body_shows_validation_error", async () => {
    renderWithQuery(<QuestionFormModal mode="create" subjects={subjects} onClose={noop} />);

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(screen.getByText("問題文は必須です")).toBeInTheDocument());
  });

  it("test_create_valid_submission_calls_post", async () => {
    mockPostCreate.mockResolvedValue(undefined);
    renderWithQuery(<QuestionFormModal mode="create" subjects={subjects} onClose={noop} />);

    fireEvent.change(screen.getByLabelText("問題文"), { target: { value: "問題本文" } });
    fireEvent.change(screen.getByLabelText("選択肢1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("選択肢2"), { target: { value: "B" } });
    fireEvent.change(screen.getByLabelText("選択肢3"), { target: { value: "C" } });
    fireEvent.change(screen.getByLabelText("解説"), { target: { value: "解説本文" } });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() =>
      expect(mockPostCreate).toHaveBeenCalledWith(
        expect.objectContaining({ body: "問題本文" }),
        expect.anything()
      )
    );
  });
});

describe("QuestionFormModal — edit mode", () => {
  const existing = {
    id: "q-1",
    subjectId: "subject-1",
    body: "既存問題",
    choices: ["A", "B", "C"],
    correctIndex: 0,
    explanation: "既存解説",
  };

  beforeEach(() => {
    mockPostCreate.mockReset();
    mockPatch.mockReset();
    mockRefresh.mockReset();
  });

  it("test_edit_prefills_body", () => {
    renderWithQuery(
      <QuestionFormModal mode="edit" question={existing} subjects={subjects} onClose={noop} />
    );
    expect(screen.getByRole("textbox", { name: "問題文" })).toHaveValue("既存問題");
  });

  it("test_edit_renders_update_button", () => {
    renderWithQuery(
      <QuestionFormModal mode="edit" question={existing} subjects={subjects} onClose={noop} />
    );
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("test_edit_submission_calls_patch", async () => {
    mockPatch.mockResolvedValue(undefined);
    renderWithQuery(
      <QuestionFormModal mode="edit" question={existing} subjects={subjects} onClose={noop} />
    );

    fireEvent.change(screen.getByLabelText("問題文"), { target: { value: "更新後" } });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        "q-1",
        expect.objectContaining({ body: "更新後" })
      )
    );
  });
});
