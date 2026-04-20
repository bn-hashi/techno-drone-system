import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("test_Button_on_render_children_text_is_displayed", () => {
    // Arrange / Act
    render(<Button>送信</Button>);

    // Assert
    expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
  });

  it("test_Button_with_default_variant_applies_primary_style", () => {
    // Arrange / Act
    render(<Button>送信</Button>);

    // Assert
    expect(screen.getByRole("button")).toHaveClass("bg-blue-600");
  });

  it("test_Button_with_secondary_variant_applies_gray_style", () => {
    // Arrange / Act
    render(<Button variant="secondary">キャンセル</Button>);

    // Assert
    expect(screen.getByRole("button")).toHaveClass("bg-gray-200");
  });

  it("test_Button_with_danger_variant_applies_red_style", () => {
    // Arrange / Act
    render(<Button variant="danger">削除</Button>);

    // Assert
    expect(screen.getByRole("button")).toHaveClass("bg-red-600");
  });

  it("test_Button_with_isLoading_true_button_is_disabled", () => {
    // Arrange / Act
    render(<Button isLoading>送信</Button>);

    // Assert
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("test_Button_with_isLoading_true_spinner_is_visible", () => {
    // Arrange / Act
    render(<Button isLoading>送信</Button>);

    // Assert
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("test_Button_on_click_calls_onClick_handler", async () => {
    // Arrange
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>送信</Button>);

    // Act
    await userEvent.click(screen.getByRole("button"));

    // Assert
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("test_Button_when_disabled_click_does_not_call_onClick", async () => {
    // Arrange
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        送信
      </Button>
    );

    // Act
    await userEvent.click(screen.getByRole("button"));

    // Assert
    expect(handleClick).not.toHaveBeenCalled();
  });
});
