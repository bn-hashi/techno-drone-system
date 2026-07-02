"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: readonly NavItem[];
}

/**
 * href がダッシュボード等のルート (例: /admin) の場合は完全一致のみ、
 * それ以外は配下パス (例: /admin/users/new) もアクティブ扱いにする
 */
export function isActiveLink(pathname: string, href: string, isRootLink: boolean): boolean {
  if (isRootLink) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavProps {
  navLabel: string;
  groups: readonly NavGroup[];
  /** 完全一致でのみアクティブにする href (ダッシュボードなど他リンクの親パス) */
  rootHrefs?: readonly string[];
  /** モバイル (md未満) でドロワーとして開いているか */
  isMobileOpen: boolean;
  /** リンク遷移時に呼ばれる (モバイルドロワーを閉じる用途) */
  onNavigate: () => void;
}

export function SidebarNav({
  navLabel,
  groups,
  rootHrefs = [],
  isMobileOpen,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside
      aria-label={navLabel}
      className={`fixed inset-y-0 left-0 z-30 flex w-[252px] flex-none transform flex-col overflow-y-auto bg-sidebar px-3.5 py-[18px] transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-3 px-2 pb-4">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-accent text-lg text-white">
          ⌖
        </div>
        <div>
          <div className="text-[15px] font-bold leading-tight text-white">UAS 講習機関</div>
          <div className="text-[11px] text-sidebar-group">管理コンソール</div>
        </div>
      </div>

      <nav>
        {groups.map((group) => (
          <div key={group.title} className="mt-3.5">
            <div className="px-2.5 pb-1.5 text-[10.5px] font-bold tracking-[.08em] text-sidebar-group">
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = isActiveLink(pathname, item.href, rootHrefs.includes(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-[9px] px-[11px] py-2 text-[13.5px] ${
                    active
                      ? "bg-accent font-medium text-white"
                      : "text-sidebar-item hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`h-[5px] w-[5px] flex-none rounded-full ${
                      active ? "bg-white" : "bg-accent"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
