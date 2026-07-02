import { FlightPlanStatus } from "@prisma/client";
import type { FlightPlan, Aircraft } from "@prisma/client";
import type {
  IFlightPlanRepository,
  CreateFlightPlanInput,
  UpdateFlightPlanInput,
} from "@/repositories/flightPlanRepository";
import type { AircraftService } from "@/services/aircraftService";
import {
  FlightPlanNotFoundError,
  FlightPlanInvalidTransitionError,
  AircraftNotFoundError,
  BusinessError,
} from "@/services/errors";
import { calcFallDistance } from "@/lib/utils/fallDistance";
import { getRiskStub } from "@/lib/stubs/weatherStub";
import type { RiskInfo } from "@/lib/stubs/weatherStub";
import { STUB_ALTITUDE_METERS } from "@/lib/constants/flightPlan";

const MIN_DURATION_MIN = 1;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginatedFlightPlanList {
  plans: FlightPlan[];
  total: number;
  page: number;
  limit: number;
}

// Transitions allowed for ADMIN: DRAFT→APPROVED, DRAFT→REJECTED, APPROVED→REJECTED
// Transitions allowed for PILOT (own plan): APPROVED→COMPLETED
const ADMIN_TRANSITIONS: Partial<Record<FlightPlanStatus, FlightPlanStatus[]>> = {
  [FlightPlanStatus.DRAFT]: [FlightPlanStatus.APPROVED, FlightPlanStatus.REJECTED],
  [FlightPlanStatus.APPROVED]: [FlightPlanStatus.REJECTED],
};

const PILOT_TRANSITIONS: Partial<Record<FlightPlanStatus, FlightPlanStatus[]>> = {
  [FlightPlanStatus.APPROVED]: [FlightPlanStatus.COMPLETED],
};

export class FlightPlanService {
  constructor(
    private readonly repo: IFlightPlanRepository,
    private readonly aircraftService: AircraftService
  ) {}

  async list(context: AccessContext, pagination: PaginationInput = {}): Promise<PaginatedFlightPlanList> {
    const page = Math.max(pagination.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(pagination.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const { items, total } = context.isAdmin
      ? await this.repo.findAll({ page, limit })
      : await this.repo.findAllByUser(context.userId, { page, limit });

    return { plans: items, total, page, limit };
  }

  async findById(id: string, context: AccessContext): Promise<FlightPlan> {
    const plan = await this.repo.findById(id);
    if (plan === null || (!context.isAdmin && plan.userId !== context.userId)) {
      throw new FlightPlanNotFoundError(id);
    }
    return plan;
  }

  async create(input: CreateFlightPlanInput, context: AccessContext): Promise<FlightPlan> {
    this.validateCreateInput(input);
    await this.aircraftService.findById(input.aircraftId, context);
    return this.repo.create(input);
  }

  async update(
    id: string,
    data: UpdateFlightPlanInput,
    context: AccessContext
  ): Promise<FlightPlan> {
    const plan = await this.repo.findById(id);
    if (plan === null || (!context.isAdmin && plan.userId !== context.userId)) {
      throw new FlightPlanNotFoundError(id);
    }
    return this.repo.update(id, data);
  }

  async updateStatus(
    id: string,
    newStatus: FlightPlanStatus,
    context: AccessContext
  ): Promise<FlightPlan> {
    const plan = await this.repo.findById(id);
    if (plan === null || (!context.isAdmin && plan.userId !== context.userId)) {
      throw new FlightPlanNotFoundError(id);
    }

    this.validateTransition(plan.status, newStatus, context.isAdmin);

    return this.repo.updateStatus(id, newStatus);
  }

  /** 飛行計画に紐づく機体を取得する。既に飛行計画への閲覧権限は確認済みという前提で所有権チェックはスキップする */
  async getAircraftForPlan(plan: FlightPlan): Promise<Aircraft | null> {
    try {
      return await this.aircraftService.findById(plan.aircraftId, {
        userId: plan.userId,
        isAdmin: true,
      });
    } catch (error) {
      if (error instanceof AircraftNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  async getRisk(id: string, context: AccessContext): Promise<RiskInfo> {
    const plan = await this.findById(id, context);
    const aircraft = await this.getAircraftForPlan(plan);
    if (!aircraft) {
      throw new AircraftNotFoundError(plan.aircraftId);
    }
    const fallDistanceM = calcFallDistance(aircraft.weightGrams, STUB_ALTITUDE_METERS);
    return getRiskStub(fallDistanceM);
  }

  private validateCreateInput(input: CreateFlightPlanInput): void {
    if (!input.title.trim()) {
      throw new BusinessError("飛行計画のタイトルを入力してください");
    }
    if (!input.location.trim()) {
      throw new BusinessError("飛行場所を入力してください");
    }
    if (input.durationMin < MIN_DURATION_MIN) {
      throw new BusinessError("飛行時間は1分以上で入力してください");
    }
    if (!input.purpose.trim()) {
      throw new BusinessError("飛行目的を入力してください");
    }
  }

  private validateTransition(
    current: FlightPlanStatus,
    next: FlightPlanStatus,
    isAdmin: boolean
  ): void {
    const allowed = isAdmin
      ? (ADMIN_TRANSITIONS[current] ?? [])
      : (PILOT_TRANSITIONS[current] ?? []);

    if (!allowed.includes(next)) {
      throw new FlightPlanInvalidTransitionError(current, next);
    }
  }
}
