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
 *
 * Redirect targets are built from APP_BASE_URL rather than request.url: under
 * `next start` behind a reverse proxy, request.url reflects the app's own bind
 * address (e.g. http://localhost:3000) regardless of the Host header the proxy
 * forwarded, so using it here would send users back to the internal address.
 */
function absoluteUrl(path: string): URL {
  return new URL(path, process.env.APP_BASE_URL);
}

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(absoluteUrl("/login"));
  }

  if (token.role === UserRole.ADMIN) {
    return NextResponse.redirect(absoluteUrl("/admin"));
  }

  if (token.role === UserRole.STUDENT) {
    return NextResponse.redirect(absoluteUrl("/student"));
  }

  if (token.role === UserRole.PILOT) {
    return NextResponse.redirect(absoluteUrl("/flight/aircraft"));
  }

  // Unknown role — fail closed
  return NextResponse.redirect(absoluteUrl("/login"));
}
