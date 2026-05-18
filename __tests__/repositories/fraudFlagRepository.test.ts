import { describe, it, expect, beforeEach, vi } from "vitest";
import { FraudFlagRepository } from "@/repositories/fraudFlagRepository";
import { FraudFlagType } from "@/types/prisma";

const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    fraudFlag: {
      create: mockCreate,
    },
  }),
}));

describe("FraudFlagRepository", () => {
  let repository: FraudFlagRepository;

  const createInput = {
    userId: "user-1",
    type: FraudFlagType.TAB_LEAVE,
    description: "65 seconds away",
  };

  const mockFlag = {
    id: "flag-1",
    ...createInput,
    detectedAt: new Date(),
    resolvedAt: null,
  };

  beforeEach(() => {
    mockCreate.mockReset();
    repository = new FraudFlagRepository();
  });

  it("test_create_returns_created_flag", async () => {
    mockCreate.mockResolvedValue(mockFlag);

    const result = await repository.create(createInput);

    expect(result).toEqual(mockFlag);
  });

  it("test_create_passes_input_to_prisma", async () => {
    mockCreate.mockResolvedValue(mockFlag);

    await repository.create(createInput);

    expect(mockCreate).toHaveBeenCalledWith({ data: createInput });
  });
});
