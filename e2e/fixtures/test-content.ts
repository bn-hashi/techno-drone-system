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

/**
 * 修了確認試験 E2E 専用のコース。
 * 既存の e2e-course-1 とは分離し、student-progress 系テスト
 * (動画のロック状態検証など) に影響を与えないようにする。
 */
export const E2E_EXAM_COURSE = {
  id: "e2e-exam-course-1",
  name: "E2E 試験用コース",
  type: "BEGINNER" as const,
};

/**
 * 試験の受験条件 (全4科目の必要視聴分数) を満たすための科目別動画。
 * requiredMinutes は prisma/seed-data.ts の SEED_SUBJECTS
 * (BEGINNER の requiredMinutesBeginner) と一致させること。
 * 視聴ログは watchedSeconds = requiredMinutes * 60 で挿入し、
 * 科目別合計がちょうど必要分に達する状態を作る。
 */
export const E2E_EXAM_VIDEOS = [
  { id: "e2e-exam-video-01", subjectCode: "SUBJECT_01", title: "E2E 試験用動画 1", requiredMinutes: 180 },
  { id: "e2e-exam-video-02", subjectCode: "SUBJECT_02", title: "E2E 試験用動画 2", requiredMinutes: 210 },
  { id: "e2e-exam-video-03", subjectCode: "SUBJECT_03", title: "E2E 試験用動画 3", requiredMinutes: 120 },
  { id: "e2e-exam-video-04", subjectCode: "SUBJECT_04", title: "E2E 試験用動画 4", requiredMinutes: 90 },
] as const;
