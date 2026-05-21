import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CsvImportModal } from "@/components/admin/questions/CsvImportModal";

const mockImport = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminQuestions", () => ({
  postImportCsv: mockImport,
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

function makeCsvFile(content: string): File {
  return new File([content], "questions.csv", { type: "text/csv" });
}

describe("CsvImportModal", () => {
  beforeEach(() => {
    mockImport.mockReset();
    mockRefresh.mockReset();
  });

  it("test_renders_file_input", () => {
    renderWithQuery(<CsvImportModal onClose={noop} />);
    expect(screen.getByLabelText("CSV ファイル")).toBeInTheDocument();
  });

  it("test_renders_import_button_disabled_initially", () => {
    renderWithQuery(<CsvImportModal onClose={noop} />);
    expect(screen.getByRole("button", { name: "インポート" })).toBeDisabled();
  });

  it("test_select_file_enables_import_button", async () => {
    renderWithQuery(<CsvImportModal onClose={noop} />);
    const input = screen.getByLabelText("CSV ファイル") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeCsvFile("dummy")] } });

    await waitFor(() => expect(screen.getByRole("button", { name: "インポート" })).toBeEnabled());
  });

  it("test_successful_import_shows_counts", async () => {
    mockImport.mockResolvedValue({ imported: 5, skipped: 2 });
    renderWithQuery(<CsvImportModal onClose={noop} />);
    const input = screen.getByLabelText("CSV ファイル") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeCsvFile("csv content")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "インポート" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "インポート" }));

    await waitFor(() => expect(screen.getByText(/5 件登録/)).toBeInTheDocument());
  });

  it("test_failed_import_shows_error_message", async () => {
    mockImport.mockRejectedValue(new Error("line 3: 不正な correctIndex"));
    renderWithQuery(<CsvImportModal onClose={noop} />);
    const input = screen.getByLabelText("CSV ファイル") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [makeCsvFile("csv content")] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "インポート" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "インポート" }));

    await waitFor(() => expect(screen.getByText(/line 3/)).toBeInTheDocument());
  });

  it("test_filereader_error_shows_error_message", async () => {
    // FileReader が読み込み失敗 (onerror) した場合のフォールバック表示
    const originalReader = window.FileReader;
    class FailingReader {
      onerror: ((event: ProgressEvent) => void) | null = null;
      onload: ((event: ProgressEvent) => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsText(): void {
        setTimeout(() => this.onerror?.(new ProgressEvent("error")), 0);
      }
    }
    window.FileReader = FailingReader as unknown as typeof FileReader;

    try {
      renderWithQuery(<CsvImportModal onClose={noop} />);
      const input = screen.getByLabelText("CSV ファイル") as HTMLInputElement;

      fireEvent.change(input, { target: { files: [makeCsvFile("ok")] } });
      await waitFor(() => expect(screen.getByRole("button", { name: "インポート" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "インポート" }));

      await waitFor(() => expect(screen.getByText(/ファイル読み込みに失敗/)).toBeInTheDocument());
    } finally {
      window.FileReader = originalReader;
    }
  });
});
