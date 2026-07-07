import type { ReactNode } from "react";
import { SidebarLayout } from "@/components/layouts/SidebarLayout";
import type { NavGroup } from "@/components/layouts/SidebarNav";

const PILOT_NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "飛行管理",
    items: [
      { href: "/flight/aircraft", label: "機体管理" },
      { href: "/flight/plans", label: "飛行計画" },
      { href: "/flight/logs", label: "飛行日誌" },
    ],
  },
] as const;

// ADMIN が /flight/* を開いた場合は、管理コンソール (AdminLayout) へ
// ワンクリックで戻れるリンクを追加する。AdminLayout 側にも /flight/* への
// 案内リンクを追加済みで、両レイアウト間を行き来できるようにしている。
const ADMIN_NAV_GROUPS: readonly NavGroup[] = [
  ...PILOT_NAV_GROUPS,
  {
    title: "管理コンソール",
    items: [{ href: "/admin", label: "管理コンソールへ戻る" }],
  },
] as const;

interface FlightLayoutProps {
  /** ADMIN ロールで開いている場合は true。表示ラベルと戻り導線を切り替える */
  isAdmin: boolean;
  children: ReactNode;
}

export function FlightLayout({ isAdmin, children }: FlightLayoutProps) {
  return (
    <SidebarLayout
      navLabel="飛行管理メニュー"
      groups={isAdmin ? ADMIN_NAV_GROUPS : PILOT_NAV_GROUPS}
      userLabel={isAdmin ? "機関管理者" : "操縦者"}
      fallbackTitle="飛行管理"
    >
      {children}
    </SidebarLayout>
  );
}
