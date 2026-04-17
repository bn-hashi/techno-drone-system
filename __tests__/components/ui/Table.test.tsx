import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "@/components/ui/Table";

type User = { id: string; name: string; email: string };

const COLUMNS = [
  { key: "name", header: "名前" },
  { key: "email", header: "メール" },
];

const SAMPLE_DATA: User[] = [
  { id: "1", name: "田中太郎", email: "tanaka@example.com" },
  { id: "2", name: "鈴木花子", email: "suzuki@example.com" },
];

describe("Table", () => {
  it("test_Table_on_render_column_headers_are_displayed", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={2}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByText("名前")).toBeInTheDocument();
    expect(screen.getByText("メール")).toBeInTheDocument();
  });

  it("test_Table_on_render_row_data_is_displayed", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={2}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByText("田中太郎")).toBeInTheDocument();
  });

  it("test_Table_with_empty_data_empty_state_message_is_displayed", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={[]}
        totalCount={0}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });

  it("test_Table_with_multiple_pages_pagination_controls_are_displayed", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={25}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前へ" })).toBeInTheDocument();
  });

  it("test_Table_with_single_page_pagination_controls_are_not_displayed", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={2}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.queryByRole("button", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("test_Table_on_next_button_click_onPageChange_is_called_with_next_page", async () => {
    // Arrange
    const handlePageChange = vi.fn();
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={25}
        page={1}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );

    // Act
    await userEvent.click(screen.getByRole("button", { name: "次へ" }));

    // Assert
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("test_Table_on_prev_button_click_onPageChange_is_called_with_prev_page", async () => {
    // Arrange
    const handlePageChange = vi.fn();
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={25}
        page={2}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );

    // Act
    await userEvent.click(screen.getByRole("button", { name: "前へ" }));

    // Assert
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it("test_Table_on_first_page_prev_button_is_disabled", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={25}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: "前へ" })).toBeDisabled();
  });

  it("test_Table_on_last_page_next_button_is_disabled", () => {
    // Arrange / Act
    render(
      <Table
        columns={COLUMNS}
        data={SAMPLE_DATA}
        totalCount={25}
        page={3}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByRole("button", { name: "次へ" })).toBeDisabled();
  });
});
