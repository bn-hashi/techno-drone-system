import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
  it("test_Modal_when_isOpen_false_dialog_is_not_rendered", () => {
    // Arrange / Act
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        コンテンツ
      </Modal>
    );

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_Modal_when_isOpen_true_dialog_is_rendered", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        コンテンツ
      </Modal>
    );

    // Assert
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("test_Modal_when_isOpen_true_children_content_is_displayed", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        モーダルの内容
      </Modal>
    );

    // Assert
    expect(screen.getByText("モーダルの内容")).toBeInTheDocument();
  });

  it("test_Modal_with_title_prop_title_text_is_displayed", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="確認">
        コンテンツ
      </Modal>
    );

    // Assert
    expect(screen.getByText("確認")).toBeInTheDocument();
  });

  it("test_Modal_on_close_button_click_onClose_is_called", async () => {
    // Arrange
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        コンテンツ
      </Modal>
    );

    // Act
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

    // Assert
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
