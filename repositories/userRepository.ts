import { getPrisma } from "@/lib/db";
import { User } from "@prisma/client";

/**
 * User Repository Interface
 * Prisma 操作を抽象化し、テストで注入可能にする
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
}

/**
 * User Repository Implementation
 * Prisma Client への唯一のアクセスポイント
 * Service 層はこのインターフェース経由でのみアクセス
 */
export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({
      where: { email },
    });
  }
}
