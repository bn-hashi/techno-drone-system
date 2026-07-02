import type {
  IFlightLogRepository,
  CreateFlightLogInput,
  CreateInspectionInput,
  FlightLogWithInspections,
  FlightLogForPdf,
} from "@/repositories/flightLogRepository";
import type { FlightLog } from "@prisma/client";
import type { AircraftService } from "@/services/aircraftService";
import type { FlightPlanService } from "@/services/flightPlanService";
import { FlightLogNotFoundError, BusinessError } from "@/services/errors";
import { calcDurationMin } from "@/lib/utils/flightDuration";

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

export interface PaginatedFlightLogList {
  logs: FlightLog[];
  total: number;
  page: number;
  limit: number;
}

/** durationMin は Service が startedAt/endedAt から算出するため入力には含めない */
export type CreateFlightLogServiceInput = Omit<CreateFlightLogInput, "durationMin">;

export class FlightLogService {
  constructor(
    private readonly repo: IFlightLogRepository,
    private readonly aircraftService: AircraftService,
    private readonly flightPlanService: FlightPlanService
  ) {}

  async list(
    context: AccessContext,
    pagination: PaginationInput = {}
  ): Promise<PaginatedFlightLogList> {
    const page = Math.max(pagination.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(pagination.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const { items, total } = context.isAdmin
      ? await this.repo.findAll({ page, limit })
      : await this.repo.findAllByUser(context.userId, { page, limit });

    return { logs: items, total, page, limit };
  }

  async findById(id: string, context: AccessContext): Promise<FlightLogWithInspections> {
    const log = await this.repo.findById(id);
    return this.assertOwnership(log, id, context);
  }

  /** PDF (様式1) 出力用に関連情報込みで取得する。アクセス制御は findById と同一 */
  async findByIdForPdf(id: string, context: AccessContext): Promise<FlightLogForPdf> {
    const log = await this.repo.findByIdForPdf(id);
    return this.assertOwnership(log, id, context);
  }

  async create(
    input: CreateFlightLogServiceInput,
    inspections: CreateInspectionInput[],
    context: AccessContext
  ): Promise<FlightLogWithInspections> {
    this.validateCreateInput(input, inspections);

    await this.aircraftService.findById(input.aircraftId, context);
    if (input.flightPlanId) {
      await this.flightPlanService.findById(input.flightPlanId, context);
    }

    const durationMin = calcDurationMin(input.startedAt, input.endedAt);
    return this.repo.createWithInspections(
      { ...input, location: input.location.trim(), durationMin },
      inspections
    );
  }

  private assertOwnership<T extends { userId: string }>(
    log: T | null,
    id: string,
    context: AccessContext
  ): T {
    if (log === null || (!context.isAdmin && log.userId !== context.userId)) {
      throw new FlightLogNotFoundError(id);
    }
    return log;
  }

  private validateCreateInput(
    input: CreateFlightLogServiceInput,
    inspections: CreateInspectionInput[]
  ): void {
    if (input.endedAt.getTime() <= input.startedAt.getTime()) {
      throw new BusinessError("飛行終了日時は飛行開始日時より後にしてください");
    }
    if (!input.location.trim()) {
      throw new BusinessError("飛行場所を入力してください");
    }
    if (inspections.length === 0) {
      throw new BusinessError("点検記録を1件以上入力してください");
    }
  }
}
