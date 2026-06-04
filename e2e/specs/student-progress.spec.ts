import { test } from "@playwright/test";
import { StudentDashboardPage } from "../pages/StudentDashboardPage";
import { CourseDetailPage } from "../pages/CourseDetailPage";
import { VideoViewingPage } from "../pages/VideoViewingPage";
import { STORAGE_STATE } from "../fixtures/test-users";
import { E2E_COURSE, E2E_VIDEOS } from "../fixtures/test-content";

/**
 * Issue #10「科目別進捗管理・受講順序制御」の E2E テスト
 *
 * 検証項目:
 *   1. /student ダッシュボードで科目別進捗バーが表示される
 *   2. コース内動画一覧で前動画未完了の動画がロック表示される
 *   3. 未公開動画への直接アクセスが 404 を返す
 *
 * 前提:
 *   - `make e2e-seed` で本番 seed + E2E content (e2e-course-1 + 3 videos) が
 *     投入されていること
 *   - シード時に E2E student の視聴ログがクリアされる
 *     (ロック表示テストが新規ユーザー前提のため)
 */

test.describe("Issue #10: 科目別進捗管理・受講順序制御", () => {
  // E2E student の認証済 storage state を利用
  test.use({ storageState: STORAGE_STATE.student });

  test("test_dashboard_shows_progress_bars", async ({ page }) => {
    // 項目 1: ダッシュボードで進捗バーが表示される
    const dashboard = new StudentDashboardPage(page);
    await dashboard.goto();
    await dashboard.expectProgressBarVisible();
  });

  test("test_course_videos_show_lock_status_when_previous_incomplete", async ({ page }) => {
    // 項目 2: 1 本目未視聴の状態で 2 本目がロック表示される
    const course = new CourseDetailPage(page);
    await course.goto(E2E_COURSE.id);

    // 視聴ログがゼロなので 1 本目は解放、2 本目はロック
    await course.expectVideoUnlocked(E2E_VIDEOS.first.id);
    await course.expectVideoLocked(E2E_VIDEOS.second.id);
  });

  test("test_unpublished_video_returns_404", async ({ page }) => {
    // 項目 4: 未公開動画 ID への直接アクセスで 404
    const videoPage = new VideoViewingPage(page);
    await videoPage.gotoExpectingNotFound(E2E_COURSE.id, E2E_VIDEOS.unpublished.id);
  });
});
