/**
 * E2E test content (courses, videos)
 *
 * These IDs must exist in the database before running E2E tests that exercise
 * the student progress / video-list flows. Run `npm run e2e:seed` to create
 * them along with E2E users.
 *
 * IMPORTANT: All IDs are prefixed with "e2e-" so they cannot collide with the
 * production seed data ("seed-" prefix). Storing test-only data in a test
 * database keeps the schema constraints honest.
 */

export const E2E_COURSE = {
  id: "e2e-course-1",
  name: "E2E テストコース",
  type: "BEGINNER" as const,
};

// 動画完了閾値が 80% のため、duration 100 秒なら 80 秒視聴で完了扱い。
// 短い duration を選び、テストで「未視聴 → ロック」の状態を作りやすくする。
export const E2E_VIDEOS = {
  // 視聴順 1 番目 (sortOrder = 0): 常に解放
  first: {
    id: "e2e-video-first",
    title: "E2E 1 本目（解放済み）",
    sortOrder: 0,
    duration: 100,
    isPublished: true,
  },
  // 視聴順 2 番目 (sortOrder = 1): 1 本目を 80% 視聴するまでロック
  second: {
    id: "e2e-video-second",
    title: "E2E 2 本目（前未完了でロック）",
    sortOrder: 1,
    duration: 100,
    isPublished: true,
  },
  // 未公開: 直接アクセスで 404 を返すことの検証用
  unpublished: {
    id: "e2e-video-unpublished",
    title: "E2E 未公開動画",
    sortOrder: 2,
    duration: 100,
    isPublished: false,
  },
} as const;
