import { type Page, expect } from "@playwright/test";

/**
 * Page Object Model for the /courses/[courseId] page.
 *
 * Lists all published videos for the course with lock status badges.
 * Locked videos display a 🔒 badge; unlocked videos display a "視聴" link.
 */
export class CourseDetailPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(courseId: string): Promise<void> {
    await this.page.goto(`/courses/${courseId}`);
  }

  /** ロック表示（🔒 バッジ）が指定動画 ID で表示されている */
  async expectVideoLocked(videoId: string): Promise<void> {
    await expect(this.page.getByTestId(`video-locked-${videoId}`)).toBeVisible();
  }

  /** 視聴リンクが指定動画 ID で表示されている */
  async expectVideoUnlocked(videoId: string): Promise<void> {
    await expect(this.page.getByTestId(`video-link-${videoId}`)).toBeVisible();
  }
}
