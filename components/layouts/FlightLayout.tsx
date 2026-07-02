import type { ReactNode } from "react";
import { AppLayout } from "@/components/layouts/AppLayout";

const NAVIGATION_LINKS = [
  { href: "/flight/aircraft", label: "機体管理" },
  { href: "/flight/plans", label: "飛行計画" },
  { href: "/flight/logs", label: "飛行日誌" },
] as const;

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
