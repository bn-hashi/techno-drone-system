import { getPrisma } from "@/lib/db";
import { User, Prisma } from "@prisma/client";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

type PrismaLike = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

/**
 * ユーザーの永続化を担うリポジトリインターフェース。
 * Prisma 操作を抽象化し、Service 層がテストで差し替え可能にする。
 */
export interface IUserRepository {
  /** メールアドレスでユーザーを検索する */
  findByEmail(email: string): Promise<User | null>;
  /**
   * ユーザー一覧を取得する
   * @param filter - ロール・ステータスによる絞り込み条件
   * @param limit - 取得上限（デフォルト: 500、全件取得によるメモリ消費を防ぐ）
   */
  findAll(filter?: { status?: UserStatus; role?: UserRole }, limit?: number): Promise<User[]>;
  /** ID でユーザーを検索する */
  findById(id: string, tx?: PrismaLike): Promise<User | null>;
  /** ユーザーを新規作成する */
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    courseType: CourseType;
    role: UserRole;
    status: UserStatus;
  }): Promise<User>;
  /** ユーザーのステータスを更新する */
  updateStatus(id: string, status: UserStatus, tx?: PrismaLike): Promise<User>;
  /** ユーザーのパスワードハッシュを更新する */
  updatePassword(id: string, hashedPassword: string): Promise<User>;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(filter?: { status?: UserStatus; role?: UserRole }, limit = 500): Promise<User[]> {
    const prisma = getPrisma();
    const where: { status?: UserStatus; role?: UserRole } = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.role) where.role = filter.role;
    return prisma.user.findMany({ where: Object.keys(where).length > 0 ? where : undefined, take: limit });
  }

  async findById(id: string, tx?: PrismaLike): Promise<User | null> {
    const prisma = tx ?? getPrisma();
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

  async updateStatus(id: string, status: UserStatus, tx?: PrismaLike): Promise<User> {
    const prisma = tx ?? getPrisma();
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
