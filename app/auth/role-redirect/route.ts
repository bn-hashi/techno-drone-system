import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/types/prisma";

/**
 * Role-based redirect after successful login.
 *
 * NextAuth redirects here via callbackUrl after Credentials sign-in succeeds.
 * This handler reads the JWT token role and sends the user to the correct dashboard.
 *
 * Uses getToken() instead of getServerSession() because App Router Route Handlers
 * require the raw request to read cookies, which getServerSession() cannot access
 * reliably without the req/res pair from the Pages Router.
 */
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token.role === UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (token.role === UserRole.STUDENT) {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  if (token.role === UserRole.PILOT) {
    return NextResponse.redirect(new URL("/flight/aircraft", request.url));
  }

  // Unknown role — fail closed
  return NextResponse.redirect(new URL("/login", request.url));
}
