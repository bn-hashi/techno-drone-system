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
}

export interface IFlightPlanRepository {
  findAllByUser(userId: string): Promise<FlightPlan[]>;
  findAll(): Promise<FlightPlan[]>;
  findById(id: string): Promise<FlightPlan | null>;
  create(data: CreateFlightPlanInput): Promise<FlightPlan>;
  update(id: string, data: UpdateFlightPlanInput): Promise<FlightPlan>;
  updateStatus(id: string, status: FlightPlanStatus): Promise<FlightPlan>;
}

export class FlightPlanRepository implements IFlightPlanRepository {
  async findAllByUser(userId: string): Promise<FlightPlan[]> {
    const prisma = getPrisma();
    return prisma.flightPlan.findMany({
      where: { userId },
      orderBy: { plannedAt: "desc" },
    });
  }

  async findAll(): Promise<FlightPlan[]> {
    const prisma = getPrisma();
    return prisma.flightPlan.findMany({
      orderBy: { plannedAt: "desc" },
    });
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
}
