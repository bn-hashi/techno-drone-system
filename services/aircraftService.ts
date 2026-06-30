import type { Aircraft } from "@prisma/client";
import type {
  IAircraftRepository,
  CreateAircraftInput,
  UpdateAircraftInput,
} from "@/repositories/aircraftRepository";
import {
  AircraftNotFoundError,
  AircraftDuplicateSerialError,
  BusinessError,
} from "@/services/errors";

const MIN_WEIGHT_GRAMS = 1;
const MIN_FLIGHT_TIME_MIN = 1;

interface AccessContext {
  userId: string;
  isAdmin: boolean;
}

interface ListOptions extends AccessContext {
  activeOnly?: boolean;
}

export class AircraftService {
  constructor(private readonly repo: IAircraftRepository) {}

  async list(options: ListOptions): Promise<Aircraft[]> {
    const activeOnly = options.activeOnly ?? true;
    if (options.isAdmin) {
      return this.repo.findAll(activeOnly);
    }
    return this.repo.findAllByUser(options.userId, activeOnly);
  }

  async findById(id: string, context: AccessContext): Promise<Aircraft> {
    const aircraft = await this.repo.findById(id);
    if (aircraft === null || (!context.isAdmin && aircraft.userId !== context.userId)) {
      throw new AircraftNotFoundError(id);
    }
    return aircraft;
  }

  async create(input: CreateAircraftInput): Promise<Aircraft> {
    this.validateCreateInput(input);

    const existing = await this.repo.findBySerialNumber(input.serialNumber);
    if (existing !== null) {
      throw new AircraftDuplicateSerialError(input.serialNumber);
    }

    return this.repo.create(input);
  }

  async update(id: string, data: UpdateAircraftInput, context: AccessContext): Promise<Aircraft> {
    await this.findById(id, context);
    this.validateUpdateInput(data);
    return this.repo.update(id, data);
  }

  async deactivate(id: string, context: AccessContext): Promise<Aircraft> {
    await this.findById(id, context);
    return this.repo.deactivate(id);
  }

  private validateUpdateInput(data: UpdateAircraftInput): void {
    if (data.weightGrams !== undefined && data.weightGrams < MIN_WEIGHT_GRAMS) {
      throw new BusinessError("機体重量は 1g 以上で入力してください");
    }
    if (data.maxFlightTimeMin !== undefined && data.maxFlightTimeMin < MIN_FLIGHT_TIME_MIN) {
      throw new BusinessError("最大飛行時間は 1 分以上で入力してください");
    }
  }

  private validateCreateInput(input: CreateAircraftInput): void {
    if (input.weightGrams < MIN_WEIGHT_GRAMS) {
      throw new BusinessError("機体重量は 1g 以上で入力してください");
    }
    if (input.maxFlightTimeMin < MIN_FLIGHT_TIME_MIN) {
      throw new BusinessError("最大飛行時間は 1 分以上で入力してください");
    }
  }
}
