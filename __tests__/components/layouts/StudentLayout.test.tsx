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

  it("test_StudentLayout_on_render_navigation_link_dashboard_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("ダッシュボード")).toBeInTheDocument();
  });

  it("test_StudentLayout_on_render_navigation_link_course_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("受講")).toBeInTheDocument();
  });

  it("test_StudentLayout_on_render_navigation_link_exam_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("試験")).toBeInTheDocument();
  });

  it("test_StudentLayout_on_render_logout_button_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("test_StudentLayout_dashboard_link_href_points_to_student", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("link", { name: "ダッシュボード" })).toHaveAttribute(
      "href",
      "/student"
    );
  });

  it("test_StudentLayout_course_link_href_points_to_courses", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("link", { name: "受講" })).toHaveAttribute("href", "/courses");
  });

  it("test_StudentLayout_exam_link_href_points_to_exams", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("link", { name: "試験" })).toHaveAttribute("href", "/exams");
  });

  it("test_StudentLayout_on_render_navigation_link_qa_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("質疑応答")).toBeInTheDocument();
  });

  it("test_StudentLayout_qa_link_href_points_to_qa", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("link", { name: "質疑応答" })).toHaveAttribute("href", "/qa");
  });

  it("test_StudentLayout_on_render_navigation_link_certificate_is_displayed", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByText("修了証明書")).toBeInTheDocument();
  });

  it("test_StudentLayout_certificate_link_href_points_to_certificate", () => {
    // Arrange / Act
    render(<StudentLayout>コンテンツ</StudentLayout>);

    // Assert
    expect(screen.getByRole("link", { name: "修了証明書" })).toHaveAttribute(
      "href",
      "/certificate"
    );
  });
});
