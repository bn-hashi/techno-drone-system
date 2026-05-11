import { UserRole, UserStatus } from "@/types/prisma";

declare module "next-auth" {
  interface Session {
    // user は role/status 検証失敗時に undefined になる（フェイルクローズ設計）
    user?: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      status: UserStatus;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
  }
}
