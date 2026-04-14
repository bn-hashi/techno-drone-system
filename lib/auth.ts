import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { UserRepository } from "@/repositories/userRepository";
import { AuthService } from "@/services/authService";
import { UserRole, UserStatus } from "@/types/prisma";

// Lazy initialization to avoid database connection at build time
let userRepository: UserRepository | null = null;
let authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (!userRepository) {
    userRepository = new UserRepository();
  }
  if (!authService) {
    authService = new AuthService(userRepository);
  }
  return authService;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        let result;
        try {
          result = await getAuthService().login(credentials.email, credentials.password);
        } catch {
          return null;
        }

        if (!result.success || !result.user) {
          return null;
        }

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          status: result.user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const userWithRole = user as { role: UserRole; status: UserStatus };
        token.role = userWithRole.role;
        token.status = userWithRole.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
