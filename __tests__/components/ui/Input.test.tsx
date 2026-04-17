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

  it("test_Input_with_label_prop_label_text_is_displayed", () => {
    // Arrange / Act
    render(<Input label="メールアドレス" />);

    // Assert
    expect(screen.getByText("メールアドレス")).toBeInTheDocument();
  });

  it("test_Input_with_error_prop_error_message_is_displayed", () => {
    // Arrange / Act
    render(<Input error="入力が必要です" />);

    // Assert
    expect(screen.getByText("入力が必要です")).toBeInTheDocument();
  });

  it("test_Input_without_error_prop_error_message_is_not_displayed", () => {
    // Arrange / Act
    render(<Input />);

    // Assert
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("test_Input_with_error_prop_error_border_style_is_applied", () => {
    // Arrange / Act
    render(<Input error="入力が必要です" />);

    // Assert
    expect(screen.getByRole("textbox")).toHaveClass("border-red-500");
  });
});
