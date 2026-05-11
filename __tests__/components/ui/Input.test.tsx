import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("test_Input_on_render_input_element_is_visible", () => {
    // Arrange / Act
    render(<Input />);

    // Assert
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("test_Input_with_label_prop_label_is_associated_with_input", () => {
    // Arrange / Act
    render(<Input label="メールアドレス" />);

    // Assert: getByLabelText でラベルと input の関連付けを検証する
    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("test_Input_with_error_prop_error_message_is_displayed_as_alert", () => {
    // Arrange / Act
    render(<Input error="入力が必要です" />);

    // Assert: role="alert" でスクリーンリーダーへの通知を検証する
    expect(screen.getByRole("alert")).toHaveTextContent("入力が必要です");
  });

  it("test_Input_without_error_prop_error_message_is_not_displayed", () => {
    // Arrange / Act
    render(<Input />);

    // Assert: role="alert" で error メッセージが表示されていないことを検証する
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test_Input_with_error_prop_error_border_style_is_applied", () => {
    // Arrange / Act
    render(<Input error="入力が必要です" />);

    // Assert
    expect(screen.getByRole("textbox")).toHaveClass("border-red-500");
  });
});
