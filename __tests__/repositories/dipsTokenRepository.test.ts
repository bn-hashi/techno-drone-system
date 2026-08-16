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

  /**
   * req-007: realm 単位の解除・他ユーザー保護・冪等性を、呼び出し引数のアサーションだけで
   * なく実際の削除結果で証明する。mockDeleteMany に Prisma の deleteMany と同じ
   * (userId, realm) 複合フィルタで動くインメモリ実装を与え、削除前後の「テーブル」の
   * 中身を比較する。
   */
  describe("deleteByUserAndRealm (realm/user isolation・冪等性)", () => {
    type TokenRow = { userId: string; realm: string };

    /** deleteMany({ where: { userId, realm } }) を Prisma と同じ意味論で模した削除処理 */
    function makeInMemoryDeleteMany(table: TokenRow[]) {
      return vi.fn(async ({ where }: { where: { userId: string; realm: string } }) => {
        const before = table.length;
        const remaining = table.filter(
          (row) => !(row.userId === where.userId && row.realm === where.realm)
        );
        table.length = 0;
        table.push(...remaining);
        return { count: before - remaining.length };
      });
    }

    it("test_deleteByUserAndRealm_removes_only_target_realm_and_keeps_other_realms_of_same_user", async () => {
      const table: TokenRow[] = [
        { userId: "user-1", realm: "utm" },
        { userId: "user-1", realm: "fpl" },
        { userId: "user-1", realm: "req" },
      ];
      mockDeleteMany.mockImplementation(makeInMemoryDeleteMany(table));

      await repository.deleteByUserAndRealm("user-1", "utm");

      // utm の行だけが消え、同一ユーザーの fpl/req は残る
      expect(table).toEqual([
        { userId: "user-1", realm: "fpl" },
        { userId: "user-1", realm: "req" },
      ]);
    });

    it("test_deleteByUserAndRealm_does_not_remove_other_users_token_in_the_same_realm", async () => {
      const table: TokenRow[] = [
        { userId: "user-1", realm: "utm" },
        { userId: "user-2", realm: "utm" },
      ];
      mockDeleteMany.mockImplementation(makeInMemoryDeleteMany(table));

      await repository.deleteByUserAndRealm("user-1", "utm");

      // 他ユーザー (user-2) の同 realm トークンは残る
      expect(table).toEqual([{ userId: "user-2", realm: "utm" }]);
    });

    it("test_deleteByUserAndRealm_is_idempotent_when_no_token_exists", async () => {
      const table: TokenRow[] = [{ userId: "user-2", realm: "utm" }];
      mockDeleteMany.mockImplementation(makeInMemoryDeleteMany(table));

      // user-1 の utm トークンは元々存在しない
      await expect(repository.deleteByUserAndRealm("user-1", "utm")).resolves.not.toThrow();
      // 無関係な行は変化しない
      expect(table).toEqual([{ userId: "user-2", realm: "utm" }]);
    });
  });
});
