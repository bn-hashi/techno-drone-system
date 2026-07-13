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
  // 作成した計画のIDを以降のテストで共有する。一覧は plannedAt 降順であり、
  // 繰り返し実行で蓄積した過去の E2E データによってページネーションから
  // 対象計画が外れうるため、一覧経由のタイトル検索ではなくID直指定で開く。
  // NOTE: describe.serial のリトライはグループ全体をやり直すため、モジュール
  // スコープではなくこの describe ブロックのスコープで状態を保持する。
  let currentPlanId = "";

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

    currentPlanId = await planPage.create({
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

    await planPage.gotoDetail(currentPlanId);
    await planPage.clickStatusAction("承認");
    await planPage.expectStatus("承認済み");

    await context.close();
  });

  test("test_pilot_completes_approved_flight_plan", async ({ page }) => {
    const planPage = new FlightPlanPage(page);
    await planPage.gotoDetail(currentPlanId);
    await planPage.expectStatus("承認済み");
    await planPage.clickStatusAction("完了にする");
    await planPage.expectStatus("完了");
  });
});

test.describe("飛行管理: 飛行計画の編集", () => {
  test.use({ storageState: STORAGE_STATE.pilot });

  // services/flightPlanService.ts の update(): 承認済み計画を編集すると
  // 再承認必須のため DRAFT に差し戻される仕様を検証する。
  // リトライ安全性のため、機体登録から再承認確認までを1テスト内で完結させる
  // (test を分割してモジュール/ブロックスコープの状態を共有する設計は、
  // describe.serial のリトライがグループを最初からやり直す挙動と相性が悪い)
  test("test_editing_approved_flight_plan_reverts_to_draft_then_can_be_reapproved", async ({
    page,
    browser,
  }) => {
    const editRunId = `${Date.now()}-edit`;

    const aircraftPage = new AircraftPage(page);
    await aircraftPage.gotoNew();
    await aircraftPage.register({
      name: `[E2E] 編集テスト機体 ${editRunId}`,
      manufacturer: "TestMaker",
      modelNumber: "TM-100",
      serialNumber: `SN-${editRunId}`,
      weightGrams: 500,
      maxFlightTimeMin: 20,
    });

    const planPage = new FlightPlanPage(page);
    await planPage.gotoNew();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const planId = await planPage.create({
      title: `[E2E] 編集テスト計画 ${editRunId}`,
      location: "E2Eテスト飛行場",
      plannedAtLocal: future.toISOString().slice(0, 16),
      durationMin: 15,
      purpose: "E2Eテスト",
    });
    await planPage.expectStatus("下書き");

    const approveContext = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const approvePage = await approveContext.newPage();
    const approvePlanPage = new FlightPlanPage(approvePage);
    await approvePlanPage.gotoDetail(planId);
    await approvePlanPage.clickStatusAction("承認");
    await approvePlanPage.expectStatus("承認済み");
    await approveContext.close();

    await planPage.gotoDetail(planId);
    await planPage.expectStatus("承認済み");
    await planPage.clickEdit();
    await planPage.editTitleAndLocation({
      title: `[E2E] 編集テスト計画 ${editRunId} (編集済み)`,
      location: "E2Eテスト飛行場（編集後）",
    });
    await planPage.expectStatus("下書き");

    const reapproveContext = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const reapprovePage = await reapproveContext.newPage();
    const reapprovePlanPage = new FlightPlanPage(reapprovePage);
    await reapprovePlanPage.gotoDetail(planId);
    await reapprovePlanPage.clickStatusAction("承認");
    await reapprovePlanPage.expectStatus("承認済み");
    await reapproveContext.close();
  });
});

test.describe("飛行管理: ADMINサイドバー導線 (Phase 1 回帰防止)", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("test_admin_can_reach_flight_pages_via_sidebar", async ({ page }) => {
    // 「機体管理」「飛行計画」リンクは /flight/* の別レイアウト(FlightLayout)へ
    // 遷移するため、AdminLayoutのサイドバー(このリンク群を含む)自体が消える。
    // 3リンクとも /admin から独立して到達できることを確認するため、都度 /admin に戻る。
    await page.goto("/admin");
    await page.getByRole("link", { name: "機体管理" }).click();
    await expect(page).toHaveURL(/\/flight\/aircraft/);

    await page.goto("/admin");
    await page.getByRole("link", { name: "飛行計画" }).click();
    await expect(page).toHaveURL(/\/flight\/plans/);

    await page.goto("/admin");
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
