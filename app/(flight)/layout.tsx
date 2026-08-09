import type { ReactNode } from "react";
import { FlightLayout } from "@/components/layouts/FlightLayout";
import { requireFlightSession } from "@/lib/auth/requireFlightSession";

interface FlightRootLayoutProps {
  children: ReactNode;
}

export default async function FlightRootLayout({ children }: FlightRootLayoutProps) {
  const { isAdmin } = await requireFlightSession();
  return <FlightLayout isAdmin={isAdmin}>{children}</FlightLayout>;
}
