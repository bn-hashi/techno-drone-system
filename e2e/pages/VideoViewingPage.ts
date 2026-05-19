import { type Page, expect } from "@playwright/test";

/**
 * Page Object Model for the /courses/[courseId]/videos/[videoId] page.
 *
 * Video playback page. Direct access to unpublished videos triggers
 * `notFound()`, which Next.js renders as a 404 page.
 */
export class VideoViewingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 未公開動画 ID または存在しない URL に直接アクセスし、404 ページが
   * 表示されることを検証する。
   *
   * Next.js の notFound() は本文に "404" を含む組み込みエラーページ
   * (or app/not-found.tsx) を返す。
   */
  async gotoExpectingNotFound(courseId: string, videoId: string): Promise<void> {
    const response = await this.page.goto(`/courses/${courseId}/videos/${videoId}`);
    // notFound() は 404 ステータスを返す
    expect(response?.status()).toBe(404);
  }
}
