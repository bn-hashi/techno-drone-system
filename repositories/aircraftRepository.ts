import { getPrisma } from "@/lib/db";
import type { Aircraft } from "@prisma/client";

export interface CreateAircraftInput {
  userId: string;
  name: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  weightGrams: number;
  maxFlightTimeMin: number;
  registrationNumber?: string | null;
}

export interface UpdateAircraftInput {
  name?: string;
  manufacturer?: string;
  modelNumber?: string;
  weightGrams?: number;
  maxFlightTimeMin?: number;
  registrationNumber?: string | null;
}

export interface IAircraftRepository {
  findAllByUser(userId: string, activeOnly: boolean): Promise<Aircraft[]>;
  findAll(activeOnly: boolean): Promise<Aircraft[]>;
  findById(id: string): Promise<Aircraft | null>;
  findBySerialNumber(serialNumber: string): Promise<Aircraft | null>;
  create(data: CreateAircraftInput): Promise<Aircraft>;
  update(id: string, data: UpdateAircraftInput): Promise<Aircraft>;
  deactivate(id: string): Promise<Aircraft>;
}

export class AircraftRepository implements IAircraftRepository {
  async findAllByUser(userId: string, activeOnly: boolean): Promise<Aircraft[]> {
    const prisma = getPrisma();
    return prisma.aircraft.findMany({
      where: { userId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAll(activeOnly: boolean): Promise<Aircraft[]> {
    const prisma = getPrisma();
    return prisma.aircraft.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Aircraft | null> {
    const prisma = getPrisma();
    return prisma.aircraft.findUnique({ where: { id } });
  }

  async findBySerialNumber(serialNumber: string): Promise<Aircraft | null> {
    const prisma = getPrisma();
    return prisma.aircraft.findUnique({ where: { serialNumber } });
  }

  async create(data: CreateAircraftInput): Promise<Aircraft> {
    const prisma = getPrisma();
    return prisma.aircraft.create({ data });
  }

  async update(id: string, data: UpdateAircraftInput): Promise<Aircraft> {
    const prisma = getPrisma();
    return prisma.aircraft.update({ where: { id }, data });
  }

  async deactivate(id: string): Promise<Aircraft> {
    const prisma = getPrisma();
    return prisma.aircraft.update({ where: { id }, data: { isActive: false } });
  }
}
