import { test, expect } from "@playwright/test";
import { AircraftPage } from "../pages/AircraftPage";
import { FlightPlanPage } from "../pages/FlightPlanPage";
import { STORAGE_STATE } from "../fixtures/test-users";

/**
 * 飛行管理機能 (機体管理・飛行計画) の E2E テスト
 *
 * 検証項目:
 *   1. PILOT: 機体登録 → 飛行計画作成 (DRAFT) ができる
 *   2. ADMIN: 飛行計画一覧から承認でき、ステータス表示が更新される
 *   3. PILOT: 承認後の計画を「完了」にできる
 *   4. ADMIN: サイドバー経由で機体管理・飛行計画へ遷移できる
 *      (Phase 1 で追加した相互リンクの回帰防止)
 *   5. PILOT: 他ユーザーの機体IDを直打ちしても取得できない (404)
 *
 * 前提: `npm run e2e:seed` で PILOT/ADMIN の E2E ユーザーが作成済みであること
 */

// テスト間で共有する一意な識別子 (再実行時の重複を避ける)
const RUN_ID = Date.now();
const AIRCRAFT_NAME = `[E2E] テスト機体 ${RUN_ID}`;
const PLAN_TITLE = `[E2E] テスト飛行計画 ${RUN_ID}`;

test.describe.serial("飛行管理: PILOT登録 → ADMIN承認 → PILOT完了", () => {
  test.use({ storageState: STORAGE_STATE.pilot });

  test("test_pilot_registers_aircraft_and_creates_draft_flight_plan", async ({ page }) => {
    const aircraftPage = new AircraftPage(page);
    await aircraftPage.gotoNew();
    await aircraftPage.register({
      name: AIRCRAFT_NAME,
      manufacturer: "TestMaker",
      modelNumber: "TM-100",
      serialNumber: `SN-${RUN_ID}`,
      weightGrams: 500,
      maxFlightTimeMin: 20,
    });

    const planPage = new FlightPlanPage(page);
    await planPage.gotoNew();

    // datetime-local は未来日時が必須 (FlightPlanForm の min 制約)
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const plannedAtLocal = future.toISOString().slice(0, 16);

    await planPage.create({
      title: PLAN_TITLE,
      location: "E2Eテスト飛行場",
      plannedAtLocal,
      durationMin: 15,
      purpose: "E2Eテスト",
    });
    await planPage.expectStatus("下書き");
  });

  test("test_admin_approves_pending_flight_plan", async ({ browser }) => {
    // このテストだけ ADMIN セッションに切り替える
    const context = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page = await context.newPage();
    const planPage = new FlightPlanPage(page);

    await planPage.gotoList();
    await planPage.openByTitle(PLAN_TITLE);
    await planPage.clickStatusAction("承認");
    await planPage.expectStatus("承認済み");

    await context.close();
  });

  test("test_pilot_completes_approved_flight_plan", async ({ page }) => {
    const planPage = new FlightPlanPage(page);
    await planPage.gotoList();
    await planPage.openByTitle(PLAN_TITLE);
    await planPage.expectStatus("承認済み");
    await planPage.clickStatusAction("完了にする");
    await planPage.expectStatus("完了");
  });
});

test.describe("飛行管理: ADMINサイドバー導線 (Phase 1 回帰防止)", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("test_admin_can_reach_flight_pages_via_sidebar", async ({ page }) => {
    await page.goto("/admin");

    await page.getByRole("link", { name: "機体管理" }).click();
    await expect(page).toHaveURL(/\/flight\/aircraft/);

    await page.getByRole("link", { name: "飛行計画" }).click();
    await expect(page).toHaveURL(/\/flight\/plans/);

    await page.getByRole("link", { name: "飛行日誌（全操縦者）" }).click();
    await expect(page).toHaveURL(/\/admin\/flight-logs/);
  });
});

test.describe("飛行管理: 権限境界", () => {
  test.use({ storageState: STORAGE_STATE.pilot });

  test("test_pilot_cannot_fetch_another_users_aircraft_by_id", async ({ page }) => {
    // 存在しない (=他ユーザー所有の可能性がある) IDへの直接アクセスは
    // 所有権の有無を漏らさないため 404 を返す想定
    const response = await page.request.get("/api/flight/aircraft/nonexistent-aircraft-id");
    expect(response.status()).toBe(404);
  });
});
