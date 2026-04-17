import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("test_Badge_on_render_children_text_is_displayed", () => {
    // Arrange / Act
    render(<Badge variant="active">有効</Badge>);

    // Assert
    expect(screen.getByText("有効")).toBeInTheDocument();
  });

  it("test_Badge_with_active_variant_applies_green_style", () => {
    // Arrange / Act
    render(<Badge variant="active">有効</Badge>);

    // Assert
    expect(screen.getByText("有効")).toHaveClass("bg-green-100");
  });

  it("test_Badge_with_pending_variant_applies_yellow_style", () => {
    // Arrange / Act
    render(<Badge variant="pending">保留</Badge>);

    // Assert
    expect(screen.getByText("保留")).toHaveClass("bg-yellow-100");
  });

  it("test_Badge_with_danger_variant_applies_red_style", () => {
    // Arrange / Act
    render(<Badge variant="danger">危険</Badge>);

    // Assert
    expect(screen.getByText("危険")).toHaveClass("bg-red-100");
  });
});
