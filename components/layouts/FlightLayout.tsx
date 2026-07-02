import type { ReactNode } from "react";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import type { NavGroup } from "@/components/layouts/SidebarNav";

const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "飛行管理",
    items: [
      { href: "/flight/aircraft", label: "機体管理" },
      { href: "/flight/plans", label: "飛行計画" },
      { href: "/flight/logs", label: "飛行日誌" },
    ],
  },
] as const;

interface FlightLayoutProps {
  children: ReactNode;
}

export function FlightLayout({ children }: FlightLayoutProps) {
  return (
    <SidebarLayout
      navLabel="飛行管理メニュー"
      groups={NAV_GROUPS}
      userLabel="操縦者"
      fallbackTitle="飛行管理"
    >
      {children}
    </SidebarLayout>
  );
}
