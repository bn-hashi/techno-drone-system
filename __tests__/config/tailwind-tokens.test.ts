import { describe, it, expect } from "vitest";
import config from "@/tailwind.config";

describe("Tailwindデザイントークン", () => {
  it("test_tailwind_has_primary_color_token", () => {
    // Arrange / Act
    const colors = config.theme?.extend?.colors as Record<string, unknown>;

    // Assert
    expect(colors).toHaveProperty("primary");
  });

  it("test_tailwind_primary_color_is_string", () => {
    // Arrange / Act
    const colors = config.theme?.extend?.colors as Record<string, unknown>;

    // Assert
    expect(typeof colors["primary"]).toBe("string");
  });

  it("test_tailwind_has_content_paths_for_app_dir", () => {
    // Arrange / Act
    const content = config.content as string[];

    // Assert
    expect(content.some((p) => p.includes("app/**"))).toBe(true);
  });

  it("test_tailwind_has_content_paths_for_components_dir", () => {
    // Arrange / Act
    const content = config.content as string[];

    // Assert
    expect(content.some((p) => p.includes("components/**"))).toBe(true);
  });
});
