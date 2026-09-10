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
  /** DIPS 機体の種類 (1〜6)。未入力なら DIPS 通報前に設定が必須になる */
  dipsUaType?: number | null;
  /** DIPS 機体認証(第一種) の取得有無。省略時は Prisma スキーマの既定値 (false=未取得) */
  hasDipsCertification1?: boolean;
  /** DIPS 機体認証(第二種) の取得有無。省略時は Prisma スキーマの既定値 (false=未取得) */
  hasDipsCertification2?: boolean;
  dipsCertificationNumber?: string | null;
  maxTakeoffWeightGrams?: number | null;
}

export interface UpdateAircraftInput {
  name?: string;
  manufacturer?: string;
  modelNumber?: string;
  weightGrams?: number;
  maxFlightTimeMin?: number;
  registrationNumber?: string | null;
  dipsUaType?: number | null;
  hasDipsCertification1?: boolean;
  hasDipsCertification2?: boolean;
  dipsCertificationNumber?: string | null;
  maxTakeoffWeightGrams?: number | null;
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
