import { type Page, expect } from "@playwright/test";

/**
 * Page Object Model for /flight/aircraft/* pages.
 */
export class AircraftPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoList(): Promise<void> {
    await this.page.goto("/flight/aircraft");
  }

  async gotoNew(): Promise<void> {
    await this.page.goto("/flight/aircraft/new");
  }

  async expectListedByName(name: string): Promise<void> {
    await expect(this.page.getByRole("link", { name })).toBeVisible();
  }

  /** 機体登録フォームに入力して送信し、詳細ページへの遷移を待つ */
  async register(data: {
    name: string;
    manufacturer: string;
    modelNumber: string;
    serialNumber: string;
    weightGrams: number;
    maxFlightTimeMin: number;
    registrationNumber?: string;
  }): Promise<void> {
    await this.page.getByLabel("機体名").fill(data.name);
    await this.page.getByLabel("製造メーカー").fill(data.manufacturer);
    await this.page.getByLabel("型式番号").fill(data.modelNumber);
    await this.page.getByLabel("シリアル番号").fill(data.serialNumber);
    await this.page.getByLabel("機体重量 (g)").fill(String(data.weightGrams));
    await this.page.getByLabel("最大飛行時間 (分)").fill(String(data.maxFlightTimeMin));
    if (data.registrationNumber) {
      await this.page.getByLabel("登録記号（国土交通省）").fill(data.registrationNumber);
    }
    await this.page.getByRole("button", { name: "登録する" }).click();
    await expect(this.page).toHaveURL(/\/flight\/aircraft\/[^/]+$/);
  }
}
