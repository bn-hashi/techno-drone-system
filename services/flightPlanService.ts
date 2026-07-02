import { FlightPlanStatus } from "@prisma/client";
import type { FlightPlan } from "@prisma/client";
import type {
  IFlightPlanRepository,
  CreateFlightPlanInput,
  UpdateFlightPlanInput,
} from "@/repositories/flightPlanRepository";
import {
  FlightPlanNotFoundError,
  FlightPlanInvalidTransitionError,
  BusinessError,
} from "@/services/errors";

const MIN_DURATION_MIN = 1;

interface AccessContext {
  userId: string;
  isAdmin: boolean;
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
  constructor(private readonly repo: IFlightPlanRepository) {}

  async list(context: AccessContext): Promise<FlightPlan[]> {
    if (context.isAdmin) {
      return this.repo.findAll();
    }
    return this.repo.findAllByUser(context.userId);
  }

  async findById(id: string, context: AccessContext): Promise<FlightPlan> {
    const plan = await this.repo.findById(id);
    if (plan === null || (!context.isAdmin && plan.userId !== context.userId)) {
      throw new FlightPlanNotFoundError(id);
    }
    return plan;
  }

  async create(input: CreateFlightPlanInput): Promise<FlightPlan> {
    this.validateCreateInput(input);
    return this.repo.create(input);
  }

  async update(
    id: string,
    data: UpdateFlightPlanInput,
    context: AccessContext,
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
    context: AccessContext,
  ): Promise<FlightPlan> {
    const plan = await this.repo.findById(id);
    if (plan === null || (!context.isAdmin && plan.userId !== context.userId)) {
      throw new FlightPlanNotFoundError(id);
    }

    this.validateTransition(plan.status, newStatus, context.isAdmin);

    return this.repo.updateStatus(id, newStatus);
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
    isAdmin: boolean,
  ): void {
    const allowed = isAdmin
      ? ADMIN_TRANSITIONS[current] ?? []
      : PILOT_TRANSITIONS[current] ?? [];

    if (!allowed.includes(next)) {
      throw new FlightPlanInvalidTransitionError(current, next);
    }
  }
}
