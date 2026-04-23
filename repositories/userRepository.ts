import { getPrisma } from "@/lib/db";
import { User } from "@prisma/client";
import { UserStatus, CourseType } from "@/types/prisma";

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findAll(filter?: { status?: UserStatus }): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    courseType: CourseType;
  }): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
}

export class UserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(filter?: { status?: UserStatus }): Promise<User[]> {
    const prisma = getPrisma();
    if (filter?.status) {
      return prisma.user.findMany({ where: { status: filter.status } });
    }
    return prisma.user.findMany({});
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
}
