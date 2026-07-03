import { describe, it, expect, beforeEach, vi } from "vitest";
import { DipsTokenRepository } from "@/repositories/dipsTokenRepository";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  getPrisma: () => ({
    dipsToken: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      deleteMany: mockDeleteMany,
    },
  }),
}));

describe("DipsTokenRepository", () => {
  let repository: DipsTokenRepository;

  const upsertInput = {
    userId: "user-1",
    realm: "fpl" as const,
    encryptedAccessToken: "enc-access",
    encryptedRefreshToken: "enc-refresh",
    accessTokenExpiresAt: new Date("2026-07-03T10:05:00Z"),
    refreshTokenExpiresAt: new Date("2026-07-03T11:00:00Z"),
  };

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockDeleteMany.mockReset();
    repository = new DipsTokenRepository();
  });

  it("test_findByUserAndRealm_queries_composite_unique_key", async () => {
    mockFindUnique.mockResolvedValue(null);

    await repository.findByUserAndRealm("user-1", "fpl");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId_realm: { userId: "user-1", realm: "fpl" } },
    });
  });

  it("test_upsert_targets_composite_unique_key", async () => {
    mockUpsert.mockResolvedValue({ id: "token-1", ...upsertInput });

    await repository.upsert(upsertInput);

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId_realm: { userId: "user-1", realm: "fpl" } });
  });

  it("test_upsert_create_payload_contains_token_fields", async () => {
    mockUpsert.mockResolvedValue({ id: "token-1", ...upsertInput });

    await repository.upsert(upsertInput);

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.create.encryptedAccessToken).toBe("enc-access");
  });

  it("test_upsert_update_payload_contains_token_fields", async () => {
    mockUpsert.mockResolvedValue({ id: "token-1", ...upsertInput });

    await repository.upsert(upsertInput);

    const arg = mockUpsert.mock.calls[0][0];
    expect(arg.update.encryptedRefreshToken).toBe("enc-refresh");
  });

  it("test_upsert_does_not_put_key_fields_in_update_payload", async () => {
    mockUpsert.mockResolvedValue({ id: "token-1", ...upsertInput });

    await repository.upsert(upsertInput);

    const arg = mockUpsert.mock.calls[0][0];
    expect(Object.keys(arg.update)).toEqual(expect.not.arrayContaining(["userId", "realm"]));
  });

  it("test_deleteByUserAndRealm_deletes_matching_token", async () => {
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await repository.deleteByUserAndRealm("user-1", "fpl");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", realm: "fpl" },
    });
  });
});
