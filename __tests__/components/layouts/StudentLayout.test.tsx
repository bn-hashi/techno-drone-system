import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentLayout } from "@/components/layouts/StudentLayout";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button>ログアウト</button>,
}));

describe("StudentLayout", () => {
  it("test_StudentLayout_on_render_children_are_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>メインコンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("メインコンテンツ")).toBeInTheDocument();
  });

  it("test_StudentLayout_on_render_navigation_links_are_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
    expect(screen.getByText("受講")).toBeInTheDocument();
    expect(screen.getByText("試験")).toBeInTheDocument();
  });

  it("test_StudentLayout_on_render_logout_button_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });
});
