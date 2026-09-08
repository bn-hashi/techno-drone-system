import { Prisma, type Aircraft } from "@prisma/client";
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
/** DIPS 機体の種類コードの範囲 (FPRガイドライン 2.3.8 No.66: 1〜6) */
const MIN_DIPS_UA_TYPE = 1;
const MAX_DIPS_UA_TYPE = 6;
/** DIPS 総重量(kg)算出用の最大離陸重量 (g) の下限 */
const MIN_MAX_TAKEOFF_WEIGHT_GRAMS = 1;

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

    try {
      return await this.repo.create(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AircraftDuplicateSerialError(input.serialNumber);
      }
      throw error;
    }
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

  private validateNumericField(value: number | undefined, min: number, errorMessage: string): void {
    if (value !== undefined && (!Number.isFinite(value) || value < min)) {
      throw new BusinessError(errorMessage);
    }
  }

  /**
   * DIPS 機体の種類コード (1〜6) の値域を検証する。未入力 (null/undefined) は許可する
   * (機体登録時点では任意。DIPS 通報時に DipsService が別途必須チェックする)。
   */
  private validateDipsUaType(value: number | null | undefined): void {
    if (value === undefined || value === null) return;
    if (!Number.isInteger(value) || value < MIN_DIPS_UA_TYPE || value > MAX_DIPS_UA_TYPE) {
      throw new BusinessError(
        `機体の種類は${MIN_DIPS_UA_TYPE}〜${MAX_DIPS_UA_TYPE}の範囲で指定してください`
      );
    }
  }

  private validateUpdateInput(data: UpdateAircraftInput): void {
    this.validateNumericField(
      data.weightGrams,
      MIN_WEIGHT_GRAMS,
      "機体重量は 1g 以上で入力してください"
    );
    this.validateNumericField(
      data.maxFlightTimeMin,
      MIN_FLIGHT_TIME_MIN,
      "最大飛行時間は 1 分以上で入力してください"
    );
    this.validateNumericField(
      data.maxTakeoffWeightGrams ?? undefined,
      MIN_MAX_TAKEOFF_WEIGHT_GRAMS,
      "最大離陸重量は 1g 以上で入力してください"
    );
    this.validateDipsUaType(data.dipsUaType);
  }

  private validateCreateInput(input: CreateAircraftInput): void {
    this.validateNumericField(
      input.weightGrams,
      MIN_WEIGHT_GRAMS,
      "機体重量は 1g 以上で入力してください"
    );
    this.validateNumericField(
      input.maxFlightTimeMin,
      MIN_FLIGHT_TIME_MIN,
      "最大飛行時間は 1 分以上で入力してください"
    );
    this.validateNumericField(
      input.maxTakeoffWeightGrams ?? undefined,
      MIN_MAX_TAKEOFF_WEIGHT_GRAMS,
      "最大離陸重量は 1g 以上で入力してください"
    );
    this.validateDipsUaType(input.dipsUaType);
  }
}
