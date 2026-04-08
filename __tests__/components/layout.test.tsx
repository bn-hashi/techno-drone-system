import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--font-mock", className: "font-mock" }),
}));

import RootLayout from "@/app/layout";
import { metadata } from "@/app/layout";

describe("RootLayout", () => {
  it("test_root_layout_renders_children", () => {
    // Arrange / Act
    render(
      <RootLayout>
        <div data-testid="child-content">テストコンテンツ</div>
      </RootLayout>
    );

    // Assert
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("test_root_layout_children_text_visible", () => {
    // Arrange / Act
    render(
      <RootLayout>
        <p>子要素テキスト</p>
      </RootLayout>
    );

    // Assert
    expect(screen.getByText("子要素テキスト")).toBeInTheDocument();
  });
});

describe("メタデータ", () => {
  it("test_metadata_title_contains_drone_school", () => {
    // Assert
    expect(String(metadata.title)).toContain("ドローンスクール");
  });

  it("test_metadata_description_is_defined", () => {
    // Assert
    expect(metadata.description).toBeTruthy();
  });
});
