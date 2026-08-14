import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
  it("test_Modal_when_isOpen_false_dialog_is_not_rendered", () => {
    // Arrange / Act
    render(
      <Modal isOpen={false} onClose={vi.fn()} ariaLabel="テストモーダル">
        コンテンツ
      </Modal>
    );

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("test_Modal_when_isOpen_true_dialog_is_rendered", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()} ariaLabel="テストモーダル">
        コンテンツ
      </Modal>
    );

    // Assert
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("test_Modal_when_isOpen_true_children_content_is_displayed", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()} ariaLabel="テストモーダル">
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

  it("test_Modal_with_ariaLabel_prop_dialog_has_accessible_name", () => {
    // Arrange / Act
    render(
      <Modal isOpen={true} onClose={vi.fn()} ariaLabel="カスタムラベル">
        コンテンツ
      </Modal>
    );

    // Assert — title がないとき aria-label が付与されること
    expect(screen.getByRole("dialog", { name: "カスタムラベル" })).toBeInTheDocument();
  });

  it("test_Modal_on_close_button_click_onClose_is_called", async () => {
    // Arrange
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} ariaLabel="テストモーダル">
        コンテンツ
      </Modal>
    );

    // Act
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

    // Assert
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("test_Modal_close_button_has_type_button_so_it_does_not_submit_a_parent_form", () => {
    // Arrange
    // Modal はポータルを使わないため、<form> の内側に置かれると DOM 上も form の子孫になる。
    // type 属性がない <button> は HTML 仕様上 既定で type="submit" になり、意図せず
    // 親フォームの送信を引き起こす (回帰: DipsAircraftPickerModal を機体編集フォーム内で
    // 使ったときに ✕ クリックで updateAircraft が走った不具合)。
    render(
      <Modal isOpen={true} onClose={vi.fn()} ariaLabel="テストモーダル">
        コンテンツ
      </Modal>
    );

    // Act / Assert
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveAttribute("type", "button");
  });
});
