"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layouts/SidebarNav";
import type { NavGroup } from "@/components/layouts/SidebarNav";
import { HeaderBar } from "@/components/layouts/HeaderBar";

interface SidebarShellProps {
  navLabel: string;
  groups: readonly NavGroup[];
  rootHrefs?: readonly string[];
  userLabel: string;
  fallbackTitle: string;
  children: ReactNode;
}

/**
 * サイドバー+ヘッダーのインタラクティブなシェル。モバイル (md未満) では
 * SidebarNav をオフキャンバスドロワー化し、HeaderBar のハンバーガーボタンで
 * 開閉する。開閉状態はこのコンポーネントで一元管理する。
 */
export function SidebarShell({
  navLabel,
  groups,
  rootHrefs,
  userLabel,
  fallbackTitle,
  children,
}: SidebarShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface text-body">
      <SidebarNav
        navLabel={navLabel}
        groups={groups}
        rootHrefs={rootHrefs}
        isMobileOpen={isMobileNavOpen}
        onNavigate={() => setIsMobileNavOpen(false)}
      />
      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          groups={groups}
          rootHrefs={rootHrefs}
          userLabel={userLabel}
          fallbackTitle={fallbackTitle}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />
        <main className="flex-1 p-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
