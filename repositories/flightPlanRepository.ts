import { getPrisma } from "@/lib/db";
import type { FlightPlan, FlightPlanStatus } from "@prisma/client";

export interface CreateFlightPlanInput {
  userId: string;
  aircraftId: string;
  title: string;
  location: string;
  plannedAt: Date;
  durationMin: number;
  purpose: string;
}

export interface UpdateFlightPlanInput {
  title?: string;
  location?: string;
  plannedAt?: Date;
  durationMin?: number;
  purpose?: string;
  /** 承認済み・却下済みの計画を編集した際に Service 層が DRAFT へ戻すために使う */
  status?: FlightPlanStatus;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedFlightPlans {
  items: FlightPlan[];
  total: number;
}

export interface IFlightPlanRepository {
  findAllByUser(userId: string, pagination: PaginationParams): Promise<PaginatedFlightPlans>;
  findAll(pagination: PaginationParams): Promise<PaginatedFlightPlans>;
  findById(id: string): Promise<FlightPlan | null>;
  create(data: CreateFlightPlanInput): Promise<FlightPlan>;
  update(id: string, data: UpdateFlightPlanInput): Promise<FlightPlan>;
  updateStatus(id: string, status: FlightPlanStatus): Promise<FlightPlan>;
  recordDipsNotification(id: string, dipsFlightPlanId: string): Promise<FlightPlan>;
}

export class FlightPlanRepository implements IFlightPlanRepository {
  async findAllByUser(userId: string, pagination: PaginationParams): Promise<PaginatedFlightPlans> {
    const prisma = getPrisma();
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      prisma.flightPlan.findMany({
        where: { userId },
        orderBy: { plannedAt: "desc" },
        skip,
        take: pagination.limit,
      }),
      prisma.flightPlan.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  async findAll(pagination: PaginationParams): Promise<PaginatedFlightPlans> {
    const prisma = getPrisma();
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      prisma.flightPlan.findMany({
        orderBy: { plannedAt: "desc" },
        skip,
        take: pagination.limit,
      }),
      prisma.flightPlan.count(),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<FlightPlan | null> {
    const prisma = getPrisma();
    return prisma.flightPlan.findUnique({ where: { id } });
  }

  async create(data: CreateFlightPlanInput): Promise<FlightPlan> {
    const prisma = getPrisma();
    return prisma.flightPlan.create({ data });
  }

  async update(id: string, data: UpdateFlightPlanInput): Promise<FlightPlan> {
    const prisma = getPrisma();
    return prisma.flightPlan.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: FlightPlanStatus): Promise<FlightPlan> {
    const prisma = getPrisma();
    return prisma.flightPlan.update({ where: { id }, data: { status } });
  }

  async recordDipsNotification(id: string, dipsFlightPlanId: string): Promise<FlightPlan> {
    const prisma = getPrisma();
    return prisma.flightPlan.update({
      where: { id },
      data: { dipsFlightPlanId },
    });
  }
}
