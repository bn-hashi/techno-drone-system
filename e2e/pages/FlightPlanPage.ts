import { type Page, expect } from "@playwright/test";

/**
 * Page Object Model for /flight/plans/* pages.
 */
export class FlightPlanPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoList(): Promise<void> {
    await this.page.goto("/flight/plans");
  }

  async gotoNew(): Promise<void> {
    await this.page.goto("/flight/plans/new");
  }

  async openByTitle(title: string): Promise<void> {
    await this.page.getByRole("link", { name: title }).click();
  }

  /** 飛行計画作成フォームに入力して送信し、詳細ページへの遷移を待つ */
  async create(data: {
    title: string;
    location: string;
    plannedAtLocal: string; // "YYYY-MM-DDTHH:mm" 形式 (datetime-local)
    durationMin: number;
    purpose: string;
  }): Promise<void> {
    await this.page.getByLabel("タイトル").fill(data.title);
    await this.page.getByLabel("飛行場所").fill(data.location);
    await this.page.getByLabel("飛行予定日時").fill(data.plannedAtLocal);
    await this.page.getByLabel("飛行時間（分）").fill(String(data.durationMin));
    await this.page.getByLabel("飛行目的").fill(data.purpose);
    await this.page.getByRole("button", { name: "飛行計画を作成" }).click();
    await expect(this.page).toHaveURL(/\/flight\/plans\/[^/]+$/);
  }

  async expectStatus(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  async clickStatusAction(label: string): Promise<void> {
    await this.page.getByRole("button", { name: label }).click();
  }
}
