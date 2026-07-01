import type { ReactNode } from "react";
import { FlightLayout } from "@/components/layouts/FlightLayout";
import { requireFlightSession } from "@/lib/serverAuth";

interface FlightRootLayoutProps {
  children: ReactNode;
}

export default async function FlightRootLayout({ children }: FlightRootLayoutProps) {
  await requireFlightSession();
  return <FlightLayout>{children}</FlightLayout>;
}
