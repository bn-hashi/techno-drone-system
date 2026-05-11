import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

describe("Card", () => {
  it("test_Card_on_render_children_are_displayed", () => {
    // Arrange / Act
    render(<Card>コンテンツ</Card>);

    // Assert
    expect(screen.getByText("コンテンツ")).toBeInTheDocument();
  });

  it("test_Card_on_render_shadow_style_is_applied", () => {
    // Arrange / Act
    render(<Card>コンテンツ</Card>);

    // Assert
    expect(screen.getByText("コンテンツ").closest("div")).toHaveClass("shadow");
  });

  it("test_Card_with_title_prop_title_text_is_displayed", () => {
    // Arrange / Act
    render(<Card title="カードタイトル">コンテンツ</Card>);

    // Assert
    expect(screen.getByText("カードタイトル")).toBeInTheDocument();
  });
});
