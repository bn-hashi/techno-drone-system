import type { ReactNode } from "react";
import { SidebarShell } from "@/components/layouts/SidebarShell";
import type { NavGroup } from "@/components/layouts/SidebarNav";

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

// Server Component: SidebarShell (Client Component) に children をそのまま渡す。
// レイアウトは Claude Design「登録講習機関 管理システム」のサイドバー+ヘッダー構成に準拠。
// モバイル (md未満) のドロワー開閉状態は SidebarShell 側で一元管理する。
export function SidebarLayout({
  navLabel,
  groups,
  rootHrefs,
  userLabel,
  fallbackTitle,
  children,
}: SidebarLayoutProps) {
  return (
    <SidebarShell
      navLabel={navLabel}
      groups={groups}
      rootHrefs={rootHrefs}
      userLabel={userLabel}
      fallbackTitle={fallbackTitle}
    >
      {children}
    </SidebarShell>
  );
}
