import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

describe("LoadingSpinner", () => {
  describe("on render", () => {
    it("test_LoadingSpinner_on_render_spinner_element_is_visible", () => {
      // Arrange / Act
      render(<LoadingSpinner />);

      // Assert
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("test_LoadingSpinner_on_render_accessible_label_is_set", () => {
      // Arrange / Act
      render(<LoadingSpinner />);

      // Assert
      expect(screen.getByRole("status")).toHaveAttribute("aria-label", "読み込み中");
    });
  });
});
