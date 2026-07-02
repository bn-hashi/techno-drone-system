import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layouts/SidebarNav";
import type { NavGroup } from "@/components/layouts/SidebarNav";
import { HeaderBar } from "@/components/layouts/HeaderBar";

interface SidebarLayoutProps {
  /** スクリーンリーダー向けナビゲーション領域のラベル */
  navLabel: string;
  groups: readonly NavGroup[];
  /** 完全一致でのみアクティブにする href (他リンクの親パスになるダッシュボード等) */
  rootHrefs?: readonly string[];
  /** ヘッダー右端のユーザー種別ラベル */
  userLabel: string;
  /** ナビ項目に一致しないページのヘッダータイトル */
  fallbackTitle: string;
  children: ReactNode;
}

// Server Component: SidebarNav / HeaderBar (Client Component) を子として含む。
// レイアウトは Claude Design「登録講習機関 管理システム」のサイドバー+ヘッダー構成に準拠。
export function SidebarLayout({
  navLabel,
  groups,
  rootHrefs,
  userLabel,
  fallbackTitle,
  children,
}: SidebarLayoutProps) {
  return (
    <div className="flex min-h-screen bg-surface text-body">
      <SidebarNav navLabel={navLabel} groups={groups} rootHrefs={rootHrefs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar groups={groups} userLabel={userLabel} fallbackTitle={fallbackTitle} />
        <main className="flex-1 p-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
