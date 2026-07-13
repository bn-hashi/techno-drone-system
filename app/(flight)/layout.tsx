import type { ReactNode } from "react";
import { FlightLayout } from "@/components/layouts/FlightLayout";
import { requireFlightSession } from "@/lib/serverAuth";
import { UserRole } from "@/types/prisma";

interface FlightRootLayoutProps {
  children: ReactNode;
}

export default async function FlightRootLayout({ children }: FlightRootLayoutProps) {
  const { role } = await requireFlightSession();
  return <FlightLayout isAdmin={role === UserRole.ADMIN}>{children}</FlightLayout>;
}
