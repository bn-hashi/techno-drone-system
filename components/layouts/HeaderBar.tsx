"use client";

import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import type { NavGroup } from "@/components/layouts/SidebarNav";

interface HeaderBarProps {
  groups: readonly NavGroup[];
  /** ヘッダー右端に表示するユーザー種別ラベル (例: 機関管理者) */
  userLabel: string;
  /** パンくず・タイトルのフォールバック (ナビにないページ用) */
  fallbackTitle: string;
}

interface PageContext {
  crumb: string;
  title: string;
}

/** 現在のパスに最も長く一致するナビ項目からパンくずとページタイトルを導出する */
function resolvePageContext(
  pathname: string,
  groups: readonly NavGroup[],
  fallbackTitle: string
): PageContext {
  let best: { crumb: string; title: string; length: number } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) {
        best = { crumb: group.title, title: item.label, length: item.href.length };
      }
    }
  }
  if (best === null) return { crumb: "", title: fallbackTitle };
  return { crumb: best.crumb, title: best.title };
}

export function HeaderBar({ groups, userLabel, fallbackTitle }: HeaderBarProps) {
  const pathname = usePathname();
  const { crumb, title } = resolvePageContext(pathname, groups, fallbackTitle);

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-none items-center gap-4 border-b border-line bg-white px-6">
      <div>
        {crumb && <div className="text-[11px] text-faint">{crumb}</div>}
        <div className="text-lg font-bold leading-tight text-heading">{title}</div>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2.5 border-l border-line-soft pl-3.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">
          {userLabel.charAt(0)}
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-heading">{userLabel}</div>
        </div>
      </div>
      <LogoutButton />
    </header>
  );
}
