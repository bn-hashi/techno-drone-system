import type { IDashboardRepository, DashboardStats } from "@/repositories/dashboardRepository";

export class DashboardService {
  constructor(private readonly repository: IDashboardRepository) {}

  async getStats(): Promise<DashboardStats> {
    return this.repository.getStats();
  }
}
