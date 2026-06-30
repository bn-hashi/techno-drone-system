import type { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";

const NAVIGATION_LINKS = [{ href: "/flight/aircraft", label: "機体管理" }] as const;

interface FlightLayoutProps {
  children: ReactNode;
}

export function FlightLayout({ children }: FlightLayoutProps) {
  return (
    <AppLayout navLabel="飛行管理メニュー" links={NAVIGATION_LINKS}>
      {children}
    </AppLayout>
  );
}
