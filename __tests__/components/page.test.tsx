import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "@/app/page";

describe("Home ページ", () => {
  it("test_home_renders_without_crash", () => {
    // Arrange / Act
    const { container } = render(<Home />);

    // Assert
    expect(container.firstChild).toBeInTheDocument();
  });

  it("test_home_displays_site_heading", () => {
    // Arrange / Act
    render(<Home />);

    // Assert
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it("test_home_displays_drone_school_name", () => {
    // Arrange / Act
    render(<Home />);

    // Assert
    expect(screen.getByText(/ドローンスクール/)).toBeInTheDocument();
  });

  it("test_home_has_login_link", () => {
    // Arrange / Act
    render(<Home />);

    // Assert
    const loginLink = screen.getByRole("link", { name: /ログイン/ });
    expect(loginLink).toBeInTheDocument();
  });
});
