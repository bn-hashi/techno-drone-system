import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminLayout } from "@/components/layouts/AdminLayout";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button>ログアウト</button>,
}));

describe("AdminLayout", () => {
  it("test_AdminLayout_on_render_children_are_displayed", () => {
    // Arrange / Act
    render(<AdminLayout>管理コンテンツ</AdminLayout>);

    // Assert
    expect(screen.getByText("管理コンテンツ")).toBeInTheDocument();
  });

  it("test_AdminLayout_on_render_navigation_link_student_list_is_displayed", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert
    expect(screen.getByText("受講者一覧")).toBeInTheDocument();
  });

  it("test_AdminLayout_on_render_navigation_link_applications_is_displayed", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert
    expect(screen.getByText("入学申請")).toBeInTheDocument();
  });

  it("test_AdminLayout_on_render_logout_button_is_displayed", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("test_AdminLayout_course_link_points_to_existing_courses_url", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert: コース管理ページの実体は /courses (route group はURLに出ない)
    expect(screen.getByRole("link", { name: "コース管理" })).toHaveAttribute("href", "/courses");
  });

  it("test_AdminLayout_video_link_points_to_existing_videos_url", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert: 動画管理ページの実体は /videos
    expect(screen.getByRole("link", { name: "動画管理" })).toHaveAttribute("href", "/videos");
  });

  it("test_AdminLayout_question_link_points_to_existing_questions_url", () => {
    // Arrange / Act
    render(<AdminLayout>コンテンツ</AdminLayout>);

    // Assert: 問題バンクページの実体は /questions
    expect(screen.getByRole("link", { name: "問題バンク" })).toHaveAttribute("href", "/questions");
  });
});
