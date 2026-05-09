import { getPrisma } from "@/lib/db";
import { User } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

// User Repository Interface
// Prisma 操作を抽象化し、テストで注入可能にする
// Service 層はこのインターフェース経由でのみ DB にアクセスする
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  // limit: 全件取得によるメモリ消費を防ぐため上限を設ける（デフォルト: 500）
  findAll(filter?: { status?: UserStatus }, limit?: number): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    courseType: CourseType;
    role: UserRole;
    status: UserStatus;
  }): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
  updatePassword(id: string, hashedPassword: string): Promise<User>;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(filter?: { status?: UserStatus }, limit = 500): Promise<User[]> {
    const prisma = getPrisma();
    const where = filter?.status ? { status: filter.status } : undefined;
    return prisma.user.findMany({ where, take: limit });
  }

  async findById(id: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({ where: { id } });
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
    courseType: CourseType;
    role: UserRole;
    status: UserStatus;
  }): Promise<User> {
    const prisma = getPrisma();
    return prisma.user.create({ data });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    const prisma = getPrisma();
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    const prisma = getPrisma();
    return prisma.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    });
  }
}
