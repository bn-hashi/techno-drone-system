import { UserRole } from "@/types/prisma";

export const FLIGHT_ROLES = [UserRole.ADMIN, UserRole.PILOT] as const;
export type FlightRole = (typeof FLIGHT_ROLES)[number];

export function hasFlightAccess(role: UserRole): role is FlightRole {
  return (FLIGHT_ROLES as readonly UserRole[]).includes(role);
}
