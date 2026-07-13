import { getPrisma } from "@/lib/db";
import type { DipsToken } from "@prisma/client";
import type { DipsRealm } from "@/lib/dips/config";

export interface UpsertDipsTokenInput {
  userId: string;
  realm: DipsRealm;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface IDipsTokenRepository {
  findByUserAndRealm(userId: string, realm: DipsRealm): Promise<DipsToken | null>;
  upsert(input: UpsertDipsTokenInput): Promise<DipsToken>;
  deleteByUserAndRealm(userId: string, realm: DipsRealm): Promise<void>;
}

export class DipsTokenRepository implements IDipsTokenRepository {
  async findByUserAndRealm(userId: string, realm: DipsRealm): Promise<DipsToken | null> {
    const prisma = getPrisma();
    return prisma.dipsToken.findUnique({
      where: { userId_realm: { userId, realm } },
    });
  }

  async upsert(input: UpsertDipsTokenInput): Promise<DipsToken> {
    const prisma = getPrisma();
    const { userId, realm, ...tokenFields } = input;
    return prisma.dipsToken.upsert({
      where: { userId_realm: { userId, realm } },
      create: { userId, realm, ...tokenFields },
      update: tokenFields,
    });
  }

  async deleteByUserAndRealm(userId: string, realm: DipsRealm): Promise<void> {
    const prisma = getPrisma();
    await prisma.dipsToken.deleteMany({ where: { userId, realm } });
  }
}
