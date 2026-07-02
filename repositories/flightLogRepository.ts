import { getPrisma } from "@/lib/db";
import type {
  FlightLog,
  FlightInspection,
  InspectionPhase,
  InspectionResult,
  Prisma,
} from "@prisma/client";
import type { InspectionItemKey } from "@/lib/constants/inspectionItems";

export interface CreateFlightLogInput {
  userId: string;
  aircraftId: string;
  flightPlanId?: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  location: string;
  pilotNote?: string | null;
  incidentNote?: string | null;
}

export interface CreateInspectionInput {
  phase: InspectionPhase;
  itemKey: InspectionItemKey;
  result: InspectionResult;
  note?: string | null;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export type FlightLogWithInspections = FlightLog & { inspections: FlightInspection[] };

/** PDF (様式1) 出力に必要な関連情報込みの飛行日誌 */
export type FlightLogForPdf = FlightLogWithInspections & {
  user: { name: string };
  aircraft: { name: string; manufacturer: string; registrationNumber: string | null };
  flightPlan: { title: string; purpose: string } | null;
};

export interface PaginatedFlightLogs {
  items: FlightLog[];
  total: number;
}

export interface IFlightLogRepository {
  findAllByUser(userId: string, pagination: PaginationParams): Promise<PaginatedFlightLogs>;
  findAll(pagination: PaginationParams): Promise<PaginatedFlightLogs>;
  findById(id: string): Promise<FlightLogWithInspections | null>;
  findByIdForPdf(id: string): Promise<FlightLogForPdf | null>;
  createWithInspections(
    data: CreateFlightLogInput,
    inspections: CreateInspectionInput[]
  ): Promise<FlightLogWithInspections>;
}

/** createdAt が同一時刻になり得る (ネストした create のバッチ挿入) ため id を第2ソートキーにして順序を安定させる */
const INSPECTION_ORDER_BY: Prisma.FlightInspectionOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

export class FlightLogRepository implements IFlightLogRepository {
  async findAllByUser(userId: string, pagination: PaginationParams): Promise<PaginatedFlightLogs> {
    const prisma = getPrisma();
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      prisma.flightLog.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        skip,
        take: pagination.limit,
      }),
      prisma.flightLog.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  async findAll(pagination: PaginationParams): Promise<PaginatedFlightLogs> {
    const prisma = getPrisma();
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      prisma.flightLog.findMany({
        orderBy: { startedAt: "desc" },
        skip,
        take: pagination.limit,
      }),
      prisma.flightLog.count(),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<FlightLogWithInspections | null> {
    const prisma = getPrisma();
    return prisma.flightLog.findUnique({
      where: { id },
      include: { inspections: { orderBy: INSPECTION_ORDER_BY } },
    });
  }

  async findByIdForPdf(id: string): Promise<FlightLogForPdf | null> {
    const prisma = getPrisma();
    return prisma.flightLog.findUnique({
      where: { id },
      include: {
        inspections: { orderBy: INSPECTION_ORDER_BY },
        user: { select: { name: true } },
        aircraft: { select: { name: true, manufacturer: true, registrationNumber: true } },
        flightPlan: { select: { title: true, purpose: true } },
      },
    });
  }

  async createWithInspections(
    data: CreateFlightLogInput,
    inspections: CreateInspectionInput[]
  ): Promise<FlightLogWithInspections> {
    const prisma = getPrisma();
    // Prisma のネストした create は単一トランザクションで実行されるため、
    // 日誌と点検記録の整合性が保証される
    return prisma.flightLog.create({
      data: {
        ...data,
        inspections: { create: inspections },
      },
      include: { inspections: { orderBy: INSPECTION_ORDER_BY } },
    });
  }
}
