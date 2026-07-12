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

  /**
   * 一覧は plannedAt 降順のため、繰り返し実行で蓄積した過去の E2E データに
   * よってページネーションから対象計画が外れうる。ID直指定で確実に開く。
   */
  async gotoDetail(id: string): Promise<void> {
    await this.page.goto(`/flight/plans/${id}`);
  }

  /** 飛行計画作成フォームに入力して送信し、詳細ページへの遷移を待つ。作成された計画IDを返す */
  async create(data: {
    title: string;
    location: string;
    plannedAtLocal: string; // "YYYY-MM-DDTHH:mm" 形式 (datetime-local)
    durationMin: number;
    purpose: string;
  }): Promise<string> {
    await this.page.getByLabel("タイトル").fill(data.title);
    await this.page.getByLabel("飛行場所").fill(data.location);
    await this.page.getByLabel("飛行予定日時").fill(data.plannedAtLocal);
    await this.page.getByLabel("飛行時間（分）").fill(String(data.durationMin));
    await this.page.getByLabel("飛行目的").fill(data.purpose);
    await this.page.getByRole("button", { name: "飛行計画を作成" }).click();
    // "new" 自体も [^/]+ にマッチしてしまうため、遷移完了前の /flight/plans/new に
    // 対して false positive で expect が通り、誤った ID ("new") を返してしまう。
    // negative lookahead で除外する。
    await expect(this.page).toHaveURL(/\/flight\/plans\/(?!new$)[^/]+$/);
    const match = this.page.url().match(/\/flight\/plans\/([^/]+)$/);
    if (!match) {
      throw new Error(`Could not extract flight plan ID from URL: ${this.page.url()}`);
    }
    return match[1];
  }

  async expectStatus(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  async clickStatusAction(label: string): Promise<void> {
    await this.page.getByRole("button", { name: label }).click();
  }

  async clickEdit(): Promise<void> {
    await this.page.getByRole("link", { name: "編集" }).click();
    await expect(this.page).toHaveURL(/\/flight\/plans\/[^/]+\/edit$/);
  }

  /** 編集フォームの一部フィールドのみ更新して送信し、詳細ページへの遷移を待つ */
  async editTitleAndLocation(data: { title: string; location: string }): Promise<void> {
    await this.page.getByLabel("タイトル").fill(data.title);
    await this.page.getByLabel("飛行場所").fill(data.location);
    await this.page.getByRole("button", { name: "更新する" }).click();
    await expect(this.page).toHaveURL(/\/flight\/plans\/[^/]+$/);
  }
}
