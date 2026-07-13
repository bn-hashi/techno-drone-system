import { test, expect } from "@playwright/test";
import type { Page, Browser } from "@playwright/test";
import { TEST_USERS, STORAGE_STATE } from "../fixtures/test-users";
import { resetExamStudentState } from "../fixtures/exam-state";

/**
 * 修了確認試験 → 受講成立判定 → 修了証明書発行 → 受講者ダウンロード の E2E
 *
 * 法的要件の中核フロー (試験の合否判定・証明書交付) を UI 経由で検証する。
 * 専用の EXAM STUDENT (e2e:seed で全科目の視聴時間を充足済み) を使用し、
 * 標準 student のテスト (student-progress 系) とは状態を共有しない。
 *
 * 状態遷移テストのため 1 つの自己完結テストで実行する
 * (シリアルグループはリトライ時に先頭からやり直され状態共有が壊れるため)。
 */

/**
 * 出題 5 問の正答マップ (prisma/seed-data.ts の SEED_QUESTIONS と一致させる)。
 * 出題順はランダムのため、画面に表示された問題文から正答を引く。
 */
const QUESTION_CORRECT_ANSWERS: ReadonlyArray<{ body: string; correctIndex: number }> = [
  {
    body: "無人航空機を飛行させる際に、航空法上の飛行禁止空域として正しいものはどれか。",
    correctIndex: 0,
  },
  {
    body: "無人航空機の操縦者が遵守すべき「飛行の方法」として誤っているものはどれか。",
    correctIndex: 1,
  },
  {
    body: "マルチローター型無人航空機の飛行制御システムに関する説明として正しいものはどれか。",
    correctIndex: 0,
  },
  {
    body: "無人航空機の運航管理体制における「機体の整備責任者」の役割として正しいものはどれか。",
    correctIndex: 1,
  },
  {
    body: "無人航空機の飛行前のリスク評価において確認すべき事項として最も重要なものはどれか。",
    correctIndex: 1,
  },
];

/** NextAuth API 直叩きでログインする (setup fixtures と同じ CSRF 対応パターン) */
async function loginAs(page: Page, email: string, password: string): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok()).toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const signInRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}/auth/role-redirect`,
      json: "true",
    },
  });
  expect(signInRes.ok()).toBeTruthy();
  const data = (await signInRes.json()) as { url: string };
  expect(data.url).not.toContain("error=");
}

/** 画面に表示中の問題文に対応する正答ラジオを選択する */
async function answerVisibleQuestionCorrectly(page: Page): Promise<void> {
  for (const question of QUESTION_CORRECT_ANSWERS) {
    const bodyLocator = page.getByText(question.body);
    if (await bodyLocator.isVisible()) {
      await page.getByRole("radio").nth(question.correctIndex).check();
      return;
    }
  }
  throw new Error("表示中の問題文が正答マップに見つかりません (seed と不一致)");
}

async function newLoggedInStudentPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, TEST_USERS.examStudent.email, TEST_USERS.examStudent.password);
  return page;
}

test.describe("修了確認試験と修了証明書", () => {
  test("test_ineligible_student_sees_disabled_exam_start", async ({ browser }) => {
    // 標準 student は e2e:seed が視聴ログをクリーンアップするため常に不適格
    const context = await browser.newContext({ storageState: STORAGE_STATE.student });
    const page = await context.newPage();

    await page.goto("/exams");

    await expect(page.getByTestId("eligibility-ng")).toBeVisible();
    await expect(page.getByRole("button", { name: "試験を開始" })).toBeDisabled();
    await context.close();
  });

  test("test_exam_pass_judgment_certificate_issue_and_student_download", async ({ browser }) => {
    // 試験5問 + 判定 + 発行 + 再ログイン確認まで通すため余裕を持たせる
    test.setTimeout(240_000);

    // 状態遷移テストのため、リトライ時も既知の初期状態 (ACTIVE + 受験適格) から始める
    await resetExamStudentState();

    // --- 1. 受講者: 試験を受験し合格する ---
    const studentPage = await newLoggedInStudentPage(browser);
    await studentPage.goto("/exams");
    await expect(studentPage.getByTestId("eligibility-ok")).toBeVisible();

    await studentPage.getByRole("button", { name: "試験を開始" }).click();
    await expect(studentPage).toHaveURL(/\/exams\/(?!new$)[^/]+$/);

    // 5 問すべて正答して提出する (最終問のみボタンが「提出する」になる)
    const totalQuestions = QUESTION_CORRECT_ANSWERS.length;
    for (let i = 0; i < totalQuestions; i++) {
      await answerVisibleQuestionCorrectly(studentPage);
      if (i < totalQuestions - 1) {
        await studentPage.getByRole("button", { name: "次へ" }).click();
      } else {
        await studentPage.getByRole("button", { name: "提出する" }).click();
      }
    }

    await expect(studentPage).toHaveURL(/\/result$/);
    await expect(studentPage.getByTestId("exam-pass-status")).toHaveText("合格");
    await studentPage.context().close();

    // --- 2. 管理者: 受講成立判定 → 修了証明書発行 ---
    const adminContext = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const adminPage = await adminContext.newPage();
    // 「成立」「発行」の window.confirm を自動承諾する
    adminPage.on("dialog", (dialog) => void dialog.accept());

    await adminPage.goto("/admin/students");
    // 一覧の氏名セルはリンクではないため、対象行の「詳細」リンクをクリックする
    const examStudentRow = adminPage
      .getByRole("row")
      .filter({ hasText: TEST_USERS.examStudent.email });
    await examStudentRow.getByRole("link", { name: "詳細" }).click();
    await expect(adminPage).toHaveURL(/\/admin\/students\/[^/]+$/);
    const studentDetailUrl = adminPage.url();

    // 受講成立判定 (EXAM_PASSED → COMPLETED)
    await adminPage.getByRole("link", { name: "受講確認画面へ" }).click();
    await expect(adminPage.getByRole("heading", { name: "受講確認・成立判定" })).toBeVisible();
    await adminPage.getByRole("button", { name: "成立", exact: true }).click();
    // 判定後は canJudge=false となり判定フォームが消える
    await expect(adminPage.getByText("判定対象外のステータスです。")).toBeVisible();

    // 修了証明書発行 (COMPLETED → CERTIFIED)
    await adminPage.goto(`${studentDetailUrl}/certificate`);
    await adminPage.getByRole("button", { name: "修了証明書を発行" }).click();
    // 発行 API はサーバー側で PDF 実レンダリング (フォント埋め込みで数十秒) を
    // 行うため、完了表示までの待ち時間を大きく取る
    await expect(adminPage.getByText("証明書番号")).toBeVisible({ timeout: 120_000 });
    // CERTIFICATE_OUTPUT_DIR を書き込み可能な場所に設定しているため PDF も生成される
    await expect(adminPage.getByText("PDF の生成に失敗しました。")).not.toBeVisible();
    await adminContext.close();

    // --- 3. 受講者: 再ログインして証明書を確認・PDF ダウンロード ---
    // (ステータスは JWT に焼き込まれるため、CERTIFIED を反映した新セッションが必要)
    const certifiedStudentPage = await newLoggedInStudentPage(browser);
    await certifiedStudentPage.goto("/certificate");

    await expect(certifiedStudentPage.getByText("証明書番号")).toBeVisible();
    await expect(
      certifiedStudentPage.getByRole("link", { name: "PDF をダウンロード" })
    ).toBeVisible();

    const downloadRes = await certifiedStudentPage.request.get(
      "/api/student/certificate/download"
    );
    expect(downloadRes.status()).toBe(200);
    expect(downloadRes.headers()["content-type"]).toContain("pdf");
    // PDF 実体であることも確認する
    const body = await downloadRes.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    await certifiedStudentPage.context().close();
  });
});
